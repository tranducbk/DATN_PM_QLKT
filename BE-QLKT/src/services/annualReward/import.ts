import { prisma } from '../../models';
import { safeRecalculateAnnualProfile } from '../../helpers/profileRecalcHelper';
import {
  parseAnnualRewardImport,
  buildAnnualRewardBatchMaps,
  buildAnnualRewardImportContext,
  type AnnualRewardImportContext,
} from '../../helpers/excel/annualRewardImportHelper';
import {
  formatDanhHieuList,
  getDanhHieuName,
  resolveDanhHieuCode,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import {
  parseBooleanValue,
  resolvePersonnelInfo,
  buildPendingKeys,
  validatePersonnelNameMatch,
} from '../../helpers/excel/excelHelper';
import type { DanhHieuHangNam, QuanNhan } from '../../generated/prisma';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import type {
  ImportResult,
  PreviewError,
  PreviewValidItem,
  PreviewResult,
  ConfirmImportItem,
} from './types';

async function resolveAnnualRewardImportContext(buffer: Buffer): Promise<AnnualRewardImportContext> {
  const parsed = await parseAnnualRewardImport(buffer);

  const [personnelList, existingRewards] = await Promise.all([
    prisma.quanNhan.findMany({
      where: { id: { in: parsed.personnelIds } },
      include: { ChucVu: { select: { ten_chuc_vu: true } } },
    }),
    prisma.danhHieuHangNam.findMany({
      where: { quan_nhan_id: { in: parsed.personnelIds } },
    }),
  ]);

  const batchMaps = buildAnnualRewardBatchMaps(personnelList, existingRewards);
  return buildAnnualRewardImportContext(parsed, batchMaps);
}

export async function importFromExcelBuffer(buffer: Buffer): Promise<ImportResult> {
  const { worksheet, columns, batchMaps, allYears, currentYear, validDanhHieu } =
    await resolveAnnualRewardImportContext(buffer);
  const {
    idCol,
    hoTenCol,
    namCol,
    danhHieuCol,
    capBacCol,
    chucVuCol,
    ghiChuCol,
    bkbqpCol,
    cstdtqCol,
    bkttcpCol,
  } = columns;
  const { personnelMap: personnelById, existingAwardKeys, existingRewardByKey } = batchMaps;

  const pendingProposals = await prisma.bangDeXuat.findMany({
    where: {
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: { in: [...allYears] },
      status: PROPOSAL_STATUS.PENDING,
    },
  });
  const proposalsByYear = new Map<number, typeof pendingProposals>();
  for (const proposal of pendingProposals) {
    if (proposal.nam == null) continue;
    const list = proposalsByYear.get(proposal.nam) ?? [];
    list.push(proposal);
    proposalsByYear.set(proposal.nam, list);
  }

  const errors: string[] = [];
  const selectedPersonnelIdSet = new Set<string>();
  const titleData: Record<string, unknown>[] = [];
  let total = 0;

  const rowsToProcess: {
    personnel: QuanNhan;
    nam: number;
    danh_hieu: string;
    cap_bac: string | null;
    chuc_vu: string | null;
    ghi_chu: string | null;
    ho_ten: string;
    nhan_bkbqp: boolean;
    nhan_cstdtq: boolean;
    nhan_bkttcp: boolean;
  }[] = [];
  const seenInFile = new Set<string>();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value || '').trim() : '';
    const namVal = row.getCell(namCol).value;
    const danh_hieu_raw = String(row.getCell(danhHieuCol).value || '').trim();
    const cap_bac = capBacCol ? String(row.getCell(capBacCol).value || '').trim() : null;
    const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value || '').trim() : null;
    const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : null;
    const nhan_bkbqp = bkbqpCol ? parseBooleanValue(row.getCell(bkbqpCol).value) : false;
    const nhan_cstdtq = cstdtqCol ? parseBooleanValue(row.getCell(cstdtqCol).value) : false;
    const nhan_bkttcp = bkttcpCol ? parseBooleanValue(row.getCell(bkttcpCol).value) : false;

    if (!idValue && !namVal && !danh_hieu_raw) continue;

    total++;

    const missingFields: string[] = [];
    if (!idValue) missingFields.push('mã quân nhân');
    if (!namVal) missingFields.push('năm');
    if (!danh_hieu_raw) missingFields.push('danh hiệu');
    if (missingFields.length > 0) {
      errors.push(`Dòng ${rowNumber}: Thiếu ${missingFields.join(', ')}`);
      continue;
    }

    const personnelId = String(idValue).trim();
    if (!personnelId) {
      errors.push(`Dòng ${rowNumber}: Mã quân nhân không hợp lệ.`);
      continue;
    }
    const personnel = personnelById.get(personnelId);
    if (!personnel) {
      errors.push(`Dòng ${rowNumber}: Không tìm thấy quân nhân với ID ${personnelId}`);
      continue;
    }

    const nam = parseInt(String(namVal), 10);
    if (!Number.isInteger(nam)) {
      errors.push(`Dòng ${rowNumber}: Giá trị năm không hợp lệ`);
      continue;
    }

    if (nam < 1900 || nam > currentYear) {
      errors.push(`Dòng ${rowNumber}: Năm phải từ 1900 đến ${currentYear} (nhận được: ${nam})`);
      continue;
    }

    const resolvedDanhHieu = resolveDanhHieuCode(danh_hieu_raw);
    if (!validDanhHieu.has(resolvedDanhHieu)) {
      errors.push(
        `Dòng ${rowNumber}: Danh hiệu "${danh_hieu_raw}" không đúng. Chỉ được nhập: ${formatDanhHieuList([...validDanhHieu])}`
      );
      continue;
    }
    const danh_hieu = resolvedDanhHieu;

    const fileKey = `${personnel.id}_${nam}`;
    if (seenInFile.has(fileKey)) {
      errors.push(
        `Dòng ${rowNumber}: Quân nhân "${ho_ten}" đã xuất hiện ở dòng trước cho năm ${nam} (trùng lặp trong file)`
      );
      continue;
    }
    seenInFile.add(fileKey);

    if (danh_hieu) {
      if (existingAwardKeys.has(`${personnel.id}_${nam}_${danh_hieu}`)) {
        errors.push(
          `Dòng ${rowNumber}: ${ho_ten} đã có ${getDanhHieuName(danh_hieu)} năm ${nam} (đã được duyệt trước đó)`
        );
        continue;
      }
      const proposalsForYear = proposalsByYear.get(nam) ?? [];
      const hasPendingProposal = proposalsForYear.some(p => {
        const dataDanhHieu = (p.data_danh_hieu as Array<Record<string, unknown>>) ?? [];
        return dataDanhHieu.some(
          item => item.personnel_id === personnel.id && item.danh_hieu === danh_hieu
        );
      });
      if (hasPendingProposal) {
        errors.push(
          `Dòng ${rowNumber}: ${ho_ten} đã có ${getDanhHieuName(danh_hieu)} năm ${nam} (đã được duyệt trước đó)`
        );
        continue;
      }
    }

    const {
      hoTen,
      capBac,
      chucVu,
      missingFields: missingInfoFields,
    } = resolvePersonnelInfo({ ho_ten, cap_bac, chuc_vu }, personnel);
    if (missingInfoFields.length > 0) {
      errors.push(
        `Dòng ${rowNumber}: Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`
      );
      continue;
    }

    rowsToProcess.push({
      personnel,
      nam,
      danh_hieu,
      cap_bac: capBac,
      chuc_vu: chucVu,
      ghi_chu,
      ho_ten: hoTen,
      nhan_bkbqp,
      nhan_cstdtq,
      nhan_bkttcp,
    });
  }

  const { created, updated } = await prisma.$transaction(
    async prismaTx => {
      const txCreated: string[] = [];
      const txUpdated: string[] = [];

      for (const rowData of rowsToProcess) {
        const {
          personnel,
          nam,
          danh_hieu,
          cap_bac,
          chuc_vu,
          ghi_chu,
          nhan_bkbqp,
          nhan_cstdtq,
          nhan_bkttcp,
        } = rowData;

        const existing = existingRewardByKey.get(`${personnel.id}_${nam}`) ?? null;

        if (!existing) {
          const createdReward = await prismaTx.danhHieuHangNam.create({
            data: {
              quan_nhan_id: personnel.id,
              nam,
              danh_hieu,
              cap_bac: cap_bac || null,
              chuc_vu: chuc_vu || null,
              ghi_chu: ghi_chu || null,
              nhan_bkbqp: nhan_bkbqp || false,
              nhan_cstdtq: nhan_cstdtq || false,
              nhan_bkttcp: nhan_bkttcp || false,
            },
          });
          txCreated.push(createdReward.id);
        } else {
          await prismaTx.danhHieuHangNam.update({
            where: { id: existing.id },
            data: {
              danh_hieu,
              cap_bac: cap_bac !== undefined ? cap_bac : existing.cap_bac,
              chuc_vu: chuc_vu !== undefined ? chuc_vu : existing.chuc_vu,
              ghi_chu: ghi_chu !== undefined ? ghi_chu : existing.ghi_chu,
              nhan_bkbqp: nhan_bkbqp || existing.nhan_bkbqp,
              nhan_cstdtq: nhan_cstdtq || existing.nhan_cstdtq,
              nhan_bkttcp: nhan_bkttcp || existing.nhan_bkttcp,
            },
          });
          txUpdated.push(existing.id);
        }

        selectedPersonnelIdSet.add(personnel.id);

        titleData.push({
          personnelId: personnel.id,
          quan_nhan_id: personnel.id,
          danh_hieu: danh_hieu,
          nam: nam,
          cap_bac: cap_bac || null,
          chuc_vu: chuc_vu || null,
          ghi_chu: ghi_chu || null,
          nhan_bkbqp: nhan_bkbqp || false,
          nhan_cstdtq: nhan_cstdtq || false,
          nhan_bkttcp: nhan_bkttcp || false,
          so_quyet_dinh: null,
        });
      }

      return { created: txCreated, updated: txUpdated };
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT }
  );

  const selectedPersonnelIds = [...selectedPersonnelIdSet];

  for (const personnelId of selectedPersonnelIds) {
    await safeRecalculateAnnualProfile(personnelId);
  }

  const imported = created.length + updated.length;
  writeSystemLog({
    action: 'IMPORT',
    resource: 'annual-rewards',
    description: `[Import danh hiệu] Hoàn tất: ${imported}/${total} thành công, ${errors.length} lỗi`,
    payload: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
  });

  return {
    imported,
    total,
    errors,
    selectedPersonnelIds,
    titleData,
  };
}

export async function previewImport(buffer: Buffer): Promise<PreviewResult> {
  const { worksheet, columns, batchMaps, allYears, currentYear, validDanhHieu } =
    await resolveAnnualRewardImportContext(buffer);
  const {
    idCol,
    hoTenCol,
    namCol,
    danhHieuCol,
    capBacCol,
    chucVuCol,
    ghiChuCol,
    bkbqpCol,
    cstdtqCol,
    bkttcpCol,
    soQuyetDinhCol,
  } = columns;
  const { personnelMap, existingRewardByKey: rewardByKey, rewardsByPersonnel } = batchMaps;

  // Preview checks against PENDING proposals + existing decisions
  const [pendingProposals, existingDecisions] = await Promise.all([
    prisma.bangDeXuat.findMany({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: { in: [...allYears] },
      },
    }),
    prisma.fileQuyetDinh.findMany({ select: { so_quyet_dinh: true } }),
  ]);

  const pendingKeys = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_danh_hieu',
    (item, proposal) => (item.personnel_id ? `${item.personnel_id}_${proposal.nam}` : null)
  );
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  const errors: PreviewError[] = [];
  const valid: PreviewValidItem[] = [];
  let total = 0;
  const seenInFile = new Set<string>();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value || '').trim() : '';
    const namVal = row.getCell(namCol).value;
    const danh_hieu_raw = String(row.getCell(danhHieuCol).value || '').trim();
    const cap_bac = capBacCol ? String(row.getCell(capBacCol).value || '').trim() : null;
    const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value || '').trim() : null;
    const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : null;
    const so_quyet_dinh = soQuyetDinhCol
      ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
      : null;

    const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value ?? '').trim() : '';
    const cstdtqRaw = cstdtqCol ? String(row.getCell(cstdtqCol).value ?? '').trim() : '';
    const bkttcpRaw = bkttcpCol ? String(row.getCell(bkttcpCol).value ?? '').trim() : '';

    if (!idValue && !namVal && !danh_hieu_raw) continue;

    if (idValue && !danh_hieu_raw) {
      const skipName = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      errors.push({
        row: rowNumber,
        ho_ten: skipName,
        nam: namVal,
        danh_hieu: '',
        message: 'Bỏ qua — không có danh hiệu nào được điền',
      });
      continue;
    }

    total++;

    if (parseBooleanValue(bkbqpRaw)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: `${getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP)} không import qua Excel — vui lòng nhập trên màn hình.`,
      });
      continue;
    }
    if (parseBooleanValue(cstdtqRaw)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: `${getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ)} không import qua Excel — vui lòng nhập trên màn hình.`,
      });
      continue;
    }
    if (parseBooleanValue(bkttcpRaw)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: `${getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP)} không import qua Excel — vui lòng nhập trên màn hình.`,
      });
      continue;
    }

    const missingFields: string[] = [];
    if (!idValue) missingFields.push('mã quân nhân');
    if (!namVal) missingFields.push('năm');
    if (!danh_hieu_raw) missingFields.push('danh hiệu');
    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: `Thiếu ${missingFields.join(', ')}`,
      });
      continue;
    }

    const personnelId = String(idValue).trim();
    if (!personnelId) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: 'Mã quân nhân không hợp lệ.',
      });
      continue;
    }
    const personnel = personnelMap.get(personnelId);
    if (!personnel) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: `Không tìm thấy quân nhân với ID ${personnelId}`,
      });
      continue;
    }

    const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
    if (nameMismatch) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: nameMismatch,
      });
      continue;
    }

    const nam = parseInt(String(namVal), 10);
    if (!Number.isInteger(nam)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        danh_hieu: danh_hieu_raw,
        message: `Giá trị năm không hợp lệ: ${namVal}`,
      });
      continue;
    }
    if (nam < 1900 || nam > currentYear) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu: danh_hieu_raw,
        message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
      });
      continue;
    }

    const resolvedDanhHieu = resolveDanhHieuCode(danh_hieu_raw);
    if (!validDanhHieu.has(resolvedDanhHieu)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu: danh_hieu_raw,
        message: `Danh hiệu "${danh_hieu_raw}" không đúng. Chỉ được nhập: ${formatDanhHieuList([...validDanhHieu])}`,
      });
      continue;
    }
    const danh_hieu = resolvedDanhHieu;

    if (!so_quyet_dinh) {
      errors.push({ row: rowNumber, ho_ten, nam, danh_hieu, message: 'Thiếu số quyết định' });
      continue;
    }
    if (!validDecisionNumbers.has(so_quyet_dinh)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
      });
      continue;
    }

    const fileKey = `${personnel.id}_${nam}`;
    if (seenInFile.has(fileKey)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: `Trùng lặp trong file — cùng quân nhân, năm ${nam}`,
      });
      continue;
    }
    seenInFile.add(fileKey);

    // Check duplicate in DB (using pre-fetched Map)
    const existingReward = rewardByKey.get(`${personnel.id}_${nam}`);
    if (existingReward && existingReward.danh_hieu === danh_hieu) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: `Đã có ${getDanhHieuName(danh_hieu)} cho năm ${nam}.`,
      });
      continue;
    }

    if (pendingKeys.has(`${personnel.id}_${nam}`)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: `Quân nhân đang có đề xuất khen thưởng năm ${nam} chờ duyệt`,
      });
      continue;
    }

    // Build history from pre-fetched data (last 5 records sorted by nam desc)
    const allRecords = rewardsByPersonnel.get(personnel.id) || [];
    const history = [...allRecords]
      .sort((a, b) => b.nam - a.nam)
      .slice(0, 5)
      .map(r => ({
        nam: r.nam,
        danh_hieu: r.danh_hieu,
        nhan_bkbqp: r.nhan_bkbqp,
        nhan_cstdtq: r.nhan_cstdtq,
        nhan_bkttcp: r.nhan_bkttcp,
        so_quyet_dinh: r.so_quyet_dinh,
      }));

    const {
      hoTen,
      capBac,
      chucVu,
      missingFields: missingInfoFields,
    } = resolvePersonnelInfo({ ho_ten, cap_bac, chuc_vu }, personnel);
    if (missingInfoFields.length > 0) {
      errors.push({
        row: rowNumber,
        ho_ten: hoTen,
        nam,
        danh_hieu,
        message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
      });
      continue;
    }

    valid.push({
      row: rowNumber,
      personnel_id: personnel.id,
      ho_ten: hoTen,
      cap_bac: capBac,
      chuc_vu: chucVu,
      nam,
      danh_hieu,
      so_quyet_dinh,
      ghi_chu,
      history: history as unknown as Record<string, unknown>[],
    });
  }

  return { total, valid, errors };
}

export async function confirmImport(
  validItems: ConfirmImportItem[]
): Promise<{ imported: number }> {
  const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];
  const uniqueYears = [...new Set(validItems.map(item => item.nam))];

  const [pendingProposals, existingRecords, personnelList] = await Promise.all([
    prisma.bangDeXuat.findMany({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: { in: uniqueYears },
      },
    }),
    prisma.danhHieuHangNam.findMany({
      where: {
        quan_nhan_id: { in: personnelIds },
        nam: { in: uniqueYears },
      },
      select: { quan_nhan_id: true, nam: true, danh_hieu: true, nhan_bkbqp: true, nhan_cstdtq: true, nhan_bkttcp: true },
    }),
    prisma.quanNhan.findMany({
      where: { id: { in: personnelIds } },
      select: { id: true, ho_ten: true },
    }),
  ]);
  const hoTenMap = new Map(personnelList.map(p => [p.id, p.ho_ten]));

  const pendingKeys = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_danh_hieu',
    (item, proposal) => (item.personnel_id ? `${item.personnel_id}_${proposal.nam}` : null)
  );
  const pendingConflicts: string[] = [];
  for (const item of validItems) {
    if (pendingKeys.has(`${item.personnel_id}_${item.nam}`)) {
      pendingConflicts.push(`${hoTenMap.get(item.personnel_id) || item.ho_ten || item.personnel_id} năm ${item.nam}: đang có đề xuất chờ duyệt`);
    }
  }
  if (pendingConflicts.length > 0) {
    throw new ValidationError(pendingConflicts.join('; '));
  }
  const existingMap = new Map(existingRecords.map(r => [`${r.quan_nhan_id}|${r.nam}`, r]));

  const conflicts: string[] = [];
  for (const item of validItems) {
    const existing = existingMap.get(`${item.personnel_id}|${item.nam}`);
    if (!existing) continue;
    // Only conflict when existing has a different base title (CSTDCS vs CSTT)
    if (existing.danh_hieu && existing.danh_hieu !== item.danh_hieu) {
      const hoTen = hoTenMap.get(item.personnel_id) || item.ho_ten || item.personnel_id;
      conflicts.push(
        `${hoTen} năm ${item.nam}: đã có ${getDanhHieuName(existing.danh_hieu)}, không thể ghi đè bằng ${getDanhHieuName(item.danh_hieu)}`
      );
    }
  }
  if (conflicts.length > 0) {
    throw new ValidationError(conflicts.join('; '));
  }

  const decisionErrors: string[] = [];
  for (const item of validItems) {
    const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(item.danh_hieu);
    const nhanBKBQP = item.nhan_bkbqp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
    const nhanCSTDTQ = item.nhan_cstdtq || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
    const nhanBKTTCP = item.nhan_bkttcp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
    const sharedDecision = item.so_quyet_dinh ?? null;
    const errs = validateDecisionNumbers(
      {
        danh_hieu: isBangKhen ? null : item.danh_hieu,
        so_quyet_dinh: isBangKhen ? null : sharedDecision,
        nhan_bkbqp: nhanBKBQP,
        so_quyet_dinh_bkbqp: item.so_quyet_dinh_bkbqp || sharedDecision,
        nhan_cstdtq: nhanCSTDTQ,
        so_quyet_dinh_cstdtq: item.so_quyet_dinh_cstdtq || sharedDecision,
        nhan_bkttcp: nhanBKTTCP,
        so_quyet_dinh_bkttcp: item.so_quyet_dinh_bkttcp || sharedDecision,
      },
      {
        entityType: 'personal',
        entityName: hoTenMap.get(item.personnel_id) || item.ho_ten || item.personnel_id,
      }
    );
    decisionErrors.push(...errs);
  }
  if (decisionErrors.length > 0) {
    throw new ValidationError(decisionErrors.join('\n'));
  }

  return await prisma.$transaction(
    async prismaTx => {
      const results: DanhHieuHangNam[] = [];
      for (const item of validItems) {
        const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(item.danh_hieu);
        const nhanBKBQP = item.nhan_bkbqp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
        const nhanCSTDTQ =
          item.nhan_cstdtq || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
        const nhanBKTTCP =
          item.nhan_bkttcp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
        const finalDanhHieu = isBangKhen ? null : item.danh_hieu;

        const sharedData = {
          cap_bac: item.cap_bac ?? null,
          chuc_vu: item.chuc_vu ?? null,
          ghi_chu: isBangKhen ? undefined : (item.ghi_chu ?? null),
          so_quyet_dinh: isBangKhen ? undefined : (item.so_quyet_dinh ?? null),
          ...(nhanBKBQP && {
            nhan_bkbqp: true,
            so_quyet_dinh_bkbqp: item.so_quyet_dinh_bkbqp || item.so_quyet_dinh || null,
            ...(item.ghi_chu && { ghi_chu_bkbqp: item.ghi_chu }),
          }),
          ...(nhanCSTDTQ && {
            nhan_cstdtq: true,
            so_quyet_dinh_cstdtq: item.so_quyet_dinh_cstdtq || item.so_quyet_dinh || null,
            ...(item.ghi_chu && { ghi_chu_cstdtq: item.ghi_chu }),
          }),
          ...(nhanBKTTCP && {
            nhan_bkttcp: true,
            so_quyet_dinh_bkttcp: item.so_quyet_dinh_bkttcp || item.so_quyet_dinh || null,
            ...(item.ghi_chu && { ghi_chu_bkttcp: item.ghi_chu }),
          }),
        };

        const result = await prismaTx.danhHieuHangNam.upsert({
          where: {
            quan_nhan_id_nam: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
            },
          },
          update: {
            danh_hieu: finalDanhHieu,
            ...sharedData,
          },
          create: {
            quan_nhan_id: item.personnel_id,
            nam: item.nam,
            danh_hieu: finalDanhHieu,
            ...sharedData,
          },
        });
        results.push(result);
      }
      return { imported: results.length, data: results };
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT }
  );
}
