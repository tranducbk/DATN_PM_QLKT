import { prisma } from '../../models';
import { calculateServiceMonths, formatServiceDuration, buildCutoffDate } from '../../helpers/serviceYearsHelper';
import annualRewardService from '../annualReward.service';
import unitAnnualAwardService from '../unitAnnualAward.service';
import scientificAchievementService from '../scientificAchievement.service';
import {
  formatDanhHieuList,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_HCBVTQ,
  CONG_HIEN_HE_SO_GROUPS,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';
import { GENDER } from '../../constants/gender.constants';
import { NotFoundError } from '../../middlewares/errorHandler';
import { validateHCCSVVRankOrder } from '../../helpers/awardValidation/tenureMedalRankOrder';
import { validateHCBVTQRankUpgrade } from '../../helpers/awardValidation/contributionMedalRankUpgrade';
import { validateHCBVTQHighestRank, type PositionMonthsByGroup } from '../../helpers/awardValidation/contributionMedalHighestRank';
import {
  evaluateHCBVTQRank,
  requiredCongHienMonths,
} from '../eligibility/hcbvtqEligibility';
import { aggregatePositionMonthsByGroup } from '../eligibility/congHienMonthsAggregator';
import type { QuanNhan, Prisma } from '../../generated/prisma';
import type { ServiceTimeJson } from '../../types/proposal';
import type { BulkCreateContext, CreateHandler, TitleDataItem } from './types';
import { throwValidationErrors } from './validation';

/** Build the JSON service-time payload stored on award rows. */
export function calculateThoiGian(quanNhan: QuanNhan): ServiceTimeJson | null {
  if (!quanNhan.ngay_nhap_ngu) return null;

  const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
  const ngayKetThuc = quanNhan.ngay_xuat_ngu ? new Date(quanNhan.ngay_xuat_ngu) : new Date();

  const months = calculateServiceMonths(ngayNhapNgu, ngayKetThuc);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return {
    total_months: months,
    years,
    months: remainingMonths,
    display: months === 0 ? '-' : formatServiceDuration(months),
  };
}

/** Upsert medal awards in a single transaction for one-time or keyed-by-danh-hieu medal types. */
async function bulkUpsertMedalAward(
  // Prisma's per-model upsert args differ by table — caller passes a concrete delegate; loose typing here keeps the helper generic.
  model: { upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown> },
  buildWhere: (personnelId: string, danhHieu: string) => Record<string, unknown>,
  titleData: TitleDataItem[],
  personnelMap: Map<string, QuanNhan>,
  nam: number,
  ghiChu: string | null | undefined,
  extraDataBuilder?: (item: TitleDataItem) => Record<string, unknown>,
  thang?: number | null
): Promise<{ importedCount: number; affectedPersonnelIds: Set<string> }> {
  const importedCount = { value: 0 };
  const affectedPersonnelIds = new Set<string>();

  for (const item of titleData) {
    const quanNhan = personnelMap.get(item.personnel_id);

    if (!quanNhan) {
      throw new NotFoundError(`Quân nhân (ID: ${item.personnel_id})`);
    }

    const thoiGian = calculateThoiGian(quanNhan);
    const where = buildWhere(item.personnel_id, item.danh_hieu);
    const extraData = extraDataBuilder ? extraDataBuilder(item) : {};

    const baseData: Record<string, unknown> = {
      quan_nhan_id: item.personnel_id,
      nam,
      cap_bac: item.cap_bac || null,
      chuc_vu: item.chuc_vu || null,
      ghi_chu: ghiChu || null,
      so_quyet_dinh: item.so_quyet_dinh || null,
      thoi_gian: thoiGian,
      ...extraData,
    };
    if (thang != null) baseData.thang = thang;

    await model.upsert({
      where,
      create: baseData,
      update: baseData,
    });

    importedCount.value++;
    affectedPersonnelIds.add(item.personnel_id);
  }

  return { importedCount: importedCount.value, affectedPersonnelIds };
}

async function handleCaNhanHangNam(ctx: BulkCreateContext): Promise<void> {
  const { titleData, selectedPersonnel, nam, ghiChu } = ctx;
  const personnelRewardsData = titleData.map(item => ({
    personnel_id: item.personnel_id,
    so_quyet_dinh: item.so_quyet_dinh || null,
    cap_bac: item.cap_bac || null,
    chuc_vu: item.chuc_vu || null,
  }));

  const firstItem = titleData[0];
  const result = await annualRewardService.bulkCreateAnnualRewards({
    personnel_ids: selectedPersonnel,
    personnel_rewards_data: personnelRewardsData,
    nam,
    danh_hieu: firstItem.danh_hieu,
    ghi_chu: ghiChu,
  });

  ctx.importedCount.value = result.details.created.length;
  ctx.createdRecords.push(...result.details.created);
  if (result.details.errors.length > 0) {
    ctx.errorDetails.push(...result.details.errors);
    ctx.errors.push(...result.details.errors.map(e => e.error));
  }
  selectedPersonnel.forEach(id => ctx.affectedPersonnelIds.add(id));
}

async function handleDonViHangNam(ctx: BulkCreateContext): Promise<void> {
  const { titleData, nam, ghiChu, adminId } = ctx;
  for (const item of titleData) {
    try {
      const record = await unitAnnualAwardService.upsert({
        don_vi_id: item.don_vi_id,
        nam,
        danh_hieu: item.danh_hieu,
        so_quyet_dinh: item.so_quyet_dinh || null,
        ghi_chu: ghiChu || null,
        nguoi_tao_id: adminId,
      });
      ctx.createdRecords.push(record);
      ctx.importedCount.value++;
      if (item.don_vi_id) {
        ctx.affectedUnitIds.add(item.don_vi_id);
      }
    } catch (error) {
      const unitMsg = `Lỗi khi thêm khen thưởng cho đơn vị ${item.don_vi_id}: ${(error as Error).message}`;
      console.error('[bulkCreateAwards]', unitMsg, error);
      ctx.errors.push(unitMsg);
      ctx.errorDetails.push({ personnelId: item.don_vi_id || '', error: unitMsg });
    }
  }
}

async function handleNCKH(ctx: BulkCreateContext): Promise<void> {
  const { titleData, nam, ghiChu } = ctx;
  for (const item of titleData) {
    try {
      const record = await scientificAchievementService.createAchievement({
        personnel_id: item.personnel_id,
        nam,
        loai: item.loai,
        mo_ta: item.mo_ta,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        so_quyet_dinh: item.so_quyet_dinh || null,
        ghi_chu: ghiChu || null,
      });
      ctx.createdRecords.push(record);
      ctx.importedCount.value++;
      ctx.affectedPersonnelIds.add(item.personnel_id);
    } catch (error) {
      const nckhMsg = `Lỗi khi thêm thành tích cho quân nhân ${item.personnel_id}: ${(error as Error).message}`;
      console.error('[bulkCreateAwards]', nckhMsg, error);
      ctx.errors.push(nckhMsg);
      ctx.errorDetails.push({ personnelId: item.personnel_id || '', error: nckhMsg });
    }
  }
}

async function handleHCQKQT(ctx: BulkCreateContext): Promise<void> {
  const { titleData, personnelMap, nam, ghiChu, thang } = ctx;
  await prisma.$transaction(async prismaTx => {
    const result = await bulkUpsertMedalAward(
      prismaTx.huanChuongQuanKyQuyetThang,
      personnelId => ({ quan_nhan_id: personnelId }),
      titleData,
      personnelMap,
      nam,
      ghiChu,
      undefined,
      thang
    );
    ctx.importedCount.value += result.importedCount;
    result.affectedPersonnelIds.forEach(id => ctx.affectedPersonnelIds.add(id));
  });
}

async function handleKNC(ctx: BulkCreateContext): Promise<void> {
  const { titleData, personnelMap, nam, ghiChu, thang } = ctx;
  await prisma.$transaction(async prismaTx => {
    const result = await bulkUpsertMedalAward(
      prismaTx.kyNiemChuongVSNXDQDNDVN,
      personnelId => ({ quan_nhan_id: personnelId }),
      titleData,
      personnelMap,
      nam,
      ghiChu,
      undefined,
      thang
    );
    ctx.importedCount.value += result.importedCount;
    result.affectedPersonnelIds.forEach(id => ctx.affectedPersonnelIds.add(id));
  });
}

async function handleNienHan(ctx: BulkCreateContext): Promise<void> {
  const { titleData, personnelMap, nam, thang, ghiChu, type, adminId, errors } = ctx;
  const allowedDanhHieus: string[] = Object.values(DANH_HIEU_HCCSVV);
  for (const item of titleData) {
    if (!item.danh_hieu) {
      errors.push(`Huy chương CSVV thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
    } else if (!allowedDanhHieus.includes(item.danh_hieu)) {
      errors.push(
        `Danh hiệu "${item.danh_hieu}" không hợp lệ. Chỉ cho phép: ${formatDanhHieuList(allowedDanhHieus)}`
      );
    }
  }
  if (errors.length > 0) {
    throwValidationErrors(errors, type, nam, adminId);
  }

  const nienHanPersonnelIds = titleData.map(item => item.personnel_id).filter(Boolean);
  const existingHCCSVV = await prisma.khenThuongHCCSVV.findMany({
    where: { quan_nhan_id: { in: nienHanPersonnelIds } },
    select: { quan_nhan_id: true, danh_hieu: true, nam: true },
  });
  const hccsvvByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
  for (const r of existingHCCSVV) {
    const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
    list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
    hccsvvByPersonnel.set(r.quan_nhan_id, list);
  }
  for (const item of titleData) {
    const existing = hccsvvByPersonnel.get(item.personnel_id) || [];
    const orderError = validateHCCSVVRankOrder(item.danh_hieu, nam, existing);
    if (orderError) {
      const qn = personnelMap.get(item.personnel_id);
      const name = qn?.ho_ten || item.personnel_id;
      errors.push(`${name}: ${orderError}`);
    }
  }
  if (errors.length > 0) {
    throwValidationErrors(errors, type, nam, adminId);
  }

  await prisma.$transaction(async prismaTx => {
    const result = await bulkUpsertMedalAward(
      prismaTx.khenThuongHCCSVV,
      (personnelId, danhHieu) => ({
        quan_nhan_id_danh_hieu: { quan_nhan_id: personnelId, danh_hieu: danhHieu },
      }),
      titleData,
      personnelMap,
      nam,
      ghiChu,
      item => ({ danh_hieu: item.danh_hieu }),
      thang
    );
    ctx.importedCount.value += result.importedCount;
    result.affectedPersonnelIds.forEach(id => ctx.affectedPersonnelIds.add(id));
  });
}

async function handleCongHien(ctx: BulkCreateContext): Promise<void> {
  const { titleData, nam, thang, ghiChu, type, adminId, errors } = ctx;
  const allowedDanhHieus: string[] = Object.values(DANH_HIEU_HCBVTQ);
  for (const item of titleData) {
    if (!item.danh_hieu) {
      errors.push(`HC BVTQ thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
    } else if (!allowedDanhHieus.includes(item.danh_hieu)) {
      errors.push(
        `Danh hiệu "${item.danh_hieu}" không hợp lệ. Chỉ cho phép: ${formatDanhHieuList(allowedDanhHieus)}`
      );
    }
  }
  if (errors.length > 0) {
    throwValidationErrors(errors, type, nam, adminId);
  }

  const congHienPersonnelIds = titleData.map(item => item.personnel_id).filter(Boolean);

  const [congHienPersonnel, allPositionHistories] = await Promise.all([
    prisma.quanNhan.findMany({
      where: { id: { in: congHienPersonnelIds } },
      select: { id: true, ho_ten: true, gioi_tinh: true },
    }),
    prisma.lichSuChucVu.findMany({
      where: { quan_nhan_id: { in: congHienPersonnelIds } },
      select: {
        quan_nhan_id: true,
        he_so_chuc_vu: true,
        so_thang: true,
        ngay_bat_dau: true,
        ngay_ket_thuc: true,
      },
    }),
  ]);

  const personnelGenderMap = new Map<string, { gioi_tinh: string | null; ho_ten: string }>();
  for (const p of congHienPersonnel) {
    personnelGenderMap.set(p.id, { gioi_tinh: p.gioi_tinh, ho_ten: p.ho_ten });
  }

  const historiesByPersonnel = new Map<string, typeof allPositionHistories>();
  for (const h of allPositionHistories) {
    const list = historiesByPersonnel.get(h.quan_nhan_id) ?? [];
    list.push(h);
    historiesByPersonnel.set(h.quan_nhan_id, list);
  }

  // Cap recalculated months at the proposal cutoff date so admin bulk respects
  // the same eligibility window as submit/approve (drift unification — see Phase 5b).
  const cutoffDate = buildCutoffDate(nam, thang ?? null);
  const monthsByPersonnel = new Map<string, PositionMonthsByGroup>();
  for (const [personnelId, histories] of historiesByPersonnel) {
    monthsByPersonnel.set(personnelId, aggregatePositionMonthsByGroup(histories, cutoffDate));
  }

  const getTotalMonthsByGroup = (personnelId: string, group: string) => {
    const months = monthsByPersonnel.get(personnelId);
    if (!months) return 0;
    return months[group as keyof PositionMonthsByGroup] ?? 0;
  };

  const eligibleTitleData: TitleDataItem[] = [];
  for (const item of titleData) {
    if (!item.danh_hieu || !item.personnel_id) {
      eligibleTitleData.push(item);
      continue;
    }

    const info = personnelGenderMap.get(item.personnel_id);
    const hoTen = (info && info.ho_ten) || item.personnel_id;
    const gioiTinh = info && info.gioi_tinh;

    const months: PositionMonthsByGroup = {
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_07),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_08),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10),
    };
    const result = evaluateHCBVTQRank(item.danh_hieu, months, gioiTinh);

    if (!result.rank) {
      eligibleTitleData.push(item);
      continue;
    }

    if (!result.eligible) {
      const totalYearsText = formatServiceDuration(result.totalMonths);
      const requiredYearsText = formatServiceDuration(result.requiredMonths);
      const genderText = gioiTinh === GENDER.FEMALE ? ' (Nữ giảm 1/3 thời gian)' : '';

      errors.push(
        `Quân nhân "${hoTen}" không đủ điều kiện Huân chương Bảo vệ Tổ quốc ${result.rankName}. ` +
          `Yêu cầu: ít nhất ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}.`
      );
      continue;
    }

    eligibleTitleData.push(item);
  }

  // Defensive guard: even if checkDuplicateAwards already blocked existing HCBVTQ
  // owners, re-query and refuse downgrades/dupes here so the upsert below cannot
  // silently overwrite a higher rank (e.g. HANG_NHAT -> HANG_BA).
  const hcbvtqPersonnelIds = eligibleTitleData
    .map(it => it.personnel_id)
    .filter(Boolean);
  if (hcbvtqPersonnelIds.length > 0) {
    const existingHCBVTQ = await prisma.khenThuongHCBVTQ.findMany({
      where: { quan_nhan_id: { in: hcbvtqPersonnelIds } },
      select: { quan_nhan_id: true, danh_hieu: true },
    });
    const existingRankMap = new Map(
      existingHCBVTQ.map(r => [r.quan_nhan_id, r.danh_hieu])
    );
    const guardedTitleData: TitleDataItem[] = [];
    for (const item of eligibleTitleData) {
      const existingRank = existingRankMap.get(item.personnel_id);
      const rankError = validateHCBVTQRankUpgrade(existingRank, item.danh_hieu);
      if (rankError) {
        const info = personnelGenderMap.get(item.personnel_id);
        const hoTen = (info && info.ho_ten) || item.personnel_id;
        errors.push(`Quân nhân "${hoTen}": ${rankError}`);
        continue;
      }
      guardedTitleData.push(item);
    }
    eligibleTitleData.length = 0;
    eligibleTitleData.push(...guardedTitleData);
  }

  const highestRankFiltered: TitleDataItem[] = [];
  for (const item of eligibleTitleData) {
    if (!item.danh_hieu || !item.personnel_id) {
      highestRankFiltered.push(item);
      continue;
    }
    const months: PositionMonthsByGroup = {
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_07),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_08),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10),
    };
    const info = personnelGenderMap.get(item.personnel_id);
    const requiredMonths = requiredCongHienMonths(info?.gioi_tinh ?? null);
    const downgradeError = validateHCBVTQHighestRank(item.danh_hieu, months, requiredMonths);
    if (downgradeError) {
      const hoTen = (info && info.ho_ten) || item.personnel_id;
      errors.push(`Quân nhân "${hoTen}": ${downgradeError}`);
      continue;
    }
    highestRankFiltered.push(item);
  }
  eligibleTitleData.length = 0;
  eligibleTitleData.push(...highestRankFiltered);

  if (eligibleTitleData.length === 0 && errors.length > 0) {
    throwValidationErrors(errors, type, nam, adminId);
  }

  await prisma.$transaction(async prismaTx => {
    for (const item of eligibleTitleData) {
      await prismaTx.khenThuongHCBVTQ.upsert({
        where: { quan_nhan_id: item.personnel_id },
        create: {
          quan_nhan_id: item.personnel_id,
          danh_hieu: item.danh_hieu,
          nam,
          thang: thang as number,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          ghi_chu: ghiChu || null,
          so_quyet_dinh: item.so_quyet_dinh || null,
          thoi_gian_nhom_0_7: item.thoi_gian_nhom_0_7 || undefined,
          thoi_gian_nhom_0_8: item.thoi_gian_nhom_0_8 || undefined,
          thoi_gian_nhom_0_9_1_0: item.thoi_gian_nhom_0_9_1_0 || undefined,
        } as Prisma.KhenThuongHCBVTQUncheckedCreateInput,
        update: {
          danh_hieu: item.danh_hieu,
          nam,
          thang: thang as number,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          ghi_chu: ghiChu || null,
          so_quyet_dinh: item.so_quyet_dinh || null,
          thoi_gian_nhom_0_7: item.thoi_gian_nhom_0_7
            ? (item.thoi_gian_nhom_0_7 as unknown as Prisma.InputJsonValue)
            : null,
          thoi_gian_nhom_0_8: item.thoi_gian_nhom_0_8
            ? (item.thoi_gian_nhom_0_8 as unknown as Prisma.InputJsonValue)
            : null,
          thoi_gian_nhom_0_9_1_0: item.thoi_gian_nhom_0_9_1_0
            ? (item.thoi_gian_nhom_0_9_1_0 as unknown as Prisma.InputJsonValue)
            : null,
        },
      });

      ctx.importedCount.value++;
      ctx.affectedPersonnelIds.add(item.personnel_id);
    }
  });
}

export const CREATE_HANDLERS: Partial<Record<ProposalType, CreateHandler>> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: handleCaNhanHangNam,
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: handleDonViHangNam,
  [PROPOSAL_TYPES.NCKH]: handleNCKH,
  [PROPOSAL_TYPES.HC_QKQT]: handleHCQKQT,
  [PROPOSAL_TYPES.NIEN_HAN]: handleNienHan,
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: handleKNC,
  [PROPOSAL_TYPES.CONG_HIEN]: handleCongHien,
};
