import { prisma } from '../../models';
import { promises as fs } from 'fs';
import path from 'path';
import type { BangDeXuat, TaiKhoan } from '../../generated/prisma';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import profileService from '../profile.service';
import unitAnnualAwardService from '../unitAnnualAward.service';
import { getDanhHieuName } from '../../constants/danhHieu.constants';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { sanitizeFilename } from './helpers';
import { checkDuplicateAward } from './validation';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { writeSystemLog } from '../../helpers/systemLogHelper';

/** Normalizes `Json?` columns (`data_*` on `bang_de_xuat`) into an array of objects. */
function asJsonObjectArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** `bang_de_xuat.id` — VarChar(30), cuid */
type ProposalId = BangDeXuat['id'];
/** `tai_khoan.id` — VarChar(30), cuid (approver/admin). */
type AdminAccountId = TaiKhoan['id'];

/**
 * Edited payload mapped to `BangDeXuat` JSON columns (`data_*`).
 * Elements are business JSON objects and are not strictly typed at DB level.
 */
export type EditedProposalPayload = {
  data_danh_hieu?: any[] | null;
  data_thanh_tich?: any[] | null;
  data_nien_han?: any[] | null;
  data_cong_hien?: any[] | null;
};

/**
 * Approves a proposal and imports its data into the main tables.
 * @param proposalId - `bang_de_xuat.id`
 * @param editedData - Edited JSON arrays for `BangDeXuat.data_*`
 * @param adminId - Approver account id (`tai_khoan.id`)
 */
async function approveProposal(
  proposalId: ProposalId,
  editedData: EditedProposalPayload,
  adminId: AdminAccountId,
  decisions: Record<string, any> = {},
  pdfFiles: Record<string, any> = {},
  ghiChu: string | null = null
) {
  try {
    const proposal = await prisma.bangDeXuat.findUnique({
      where: { id: proposalId },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        NguoiDeXuat: {
          include: {
            QuanNhan: true,
          },
        },
        NguoiDuyet: {
          include: {
            QuanNhan: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('Đề xuất');
    }

    if (proposal.status === PROPOSAL_STATUS.APPROVED) {
      throw new ValidationError('Đề xuất này đã được phê duyệt trước đó');
    }

    // Import source: prefer edited payload, fall back to stored JSON.
    const danhHieuData = asJsonObjectArray(editedData.data_danh_hieu ?? proposal.data_danh_hieu);
    const thanhTichData = asJsonObjectArray(editedData.data_thanh_tich ?? proposal.data_thanh_tich);
    const nienHanData = asJsonObjectArray(editedData.data_nien_han ?? proposal.data_nien_han);
    const congHienData = asJsonObjectArray(editedData.data_cong_hien ?? proposal.data_cong_hien);

    // Duplicate validation (same year + same award/title).
    const duplicateErrors = [];
    const proposalYear = proposal.nam;
    const proposalType = proposal.loai_de_xuat;

    // Annual personal titles (CA_NHAN_HANG_NAM).
    if (
      proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM &&
      danhHieuData &&
      danhHieuData.length > 0
    ) {
      for (const item of danhHieuData) {
        if (item.personnel_id && item.danh_hieu) {
          const checkResult = await checkDuplicateAward(
            item.personnel_id,
            proposalYear,
            item.danh_hieu,
            proposalType,
            PROPOSAL_STATUS.APPROVED,
            proposalId
          );
          if (checkResult.exists) {
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
              select: { ho_ten: true },
            });
            duplicateErrors.push(
              `${quanNhan?.ho_ten || item.personnel_id}: ${checkResult.message}`
            );
          }
        }
      }
    }

    // Tenure-based awards (NIEN_HAN / HC_QKQT / KNC_VSNXD_QDNDVN).
    if (
      (proposalType === PROPOSAL_TYPES.NIEN_HAN ||
        proposalType === PROPOSAL_TYPES.HC_QKQT ||
        proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN ||
        proposalType === 'HCCSVV') &&
      nienHanData &&
      nienHanData.length > 0
    ) {
      for (const item of nienHanData) {
        if (item.personnel_id && item.danh_hieu) {
          const checkResult = await checkDuplicateAward(
            item.personnel_id,
            proposalYear,
            item.danh_hieu,
            proposalType,
            PROPOSAL_STATUS.APPROVED,
            proposalId
          );
          if (checkResult.exists) {
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
              select: { ho_ten: true },
            });
            duplicateErrors.push(
              `${quanNhan?.ho_ten || item.personnel_id}: ${checkResult.message}`
            );
          }
        }
      }
    }

    // Contribution awards (CONG_HIEN).
    if (proposalType === PROPOSAL_TYPES.CONG_HIEN && nienHanData && nienHanData.length > 0) {
      for (const item of nienHanData) {
        if (item.personnel_id && item.danh_hieu) {
          const checkResult = await checkDuplicateAward(
            item.personnel_id,
            proposalYear,
            item.danh_hieu,
            proposalType,
            null,
            proposalId
          );
          if (checkResult.exists) {
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
              select: { ho_ten: true },
            });
            duplicateErrors.push(
              `${quanNhan?.ho_ten || item.personnel_id}: ${checkResult.message}`
            );
          }
        }
      }
    }

    // If any duplicates were found, stop early.
    if (duplicateErrors.length > 0) {
      throw new ValidationError(
        `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
      );
    }

    // Re-validate eligibility rules before approving.
    // HC_QKQT: requires >= 25 years of service.
    if (proposalType === PROPOSAL_TYPES.HC_QKQT && nienHanData && nienHanData.length > 0) {
      const personnelIds = nienHanData.map(item => item.personnel_id).filter(Boolean);

      for (const personnelId of personnelIds) {
        try {
          const quanNhan = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: {
              id: true,
              ho_ten: true,
              ngay_nhap_ngu: true,
              ngay_xuat_ngu: true,
            },
          });

          if (!quanNhan) {
            duplicateErrors.push(`${personnelId}: Không tìm thấy quân nhân`);
            continue;
          }

          if (!quanNhan.ngay_nhap_ngu) {
            duplicateErrors.push(`${quanNhan.ho_ten}: Chưa có thông tin ngày nhập ngũ`);
            continue;
          }

          const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
          const ngayKetThuc = quanNhan.ngay_xuat_ngu
            ? new Date(quanNhan.ngay_xuat_ngu)
            : new Date();

          let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
          months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
          if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
            months--;
          }
          months = Math.max(0, months);

          const years = Math.floor(months / 12);

          if (years < 25) {
            duplicateErrors.push(
              `${quanNhan.ho_ten}: Chưa đủ 25 năm phục vụ để nhận HC QKQT (hiện tại: ${years} năm)`
            );
          }
        } catch (error) {
          duplicateErrors.push(`${personnelId}: Lỗi kiểm tra điều kiện HC_QKQT: ${error.message}`);
        }
      }
    }

    // KNC_VSNXD_QDNDVN: female >= 20 years, male >= 25 years.
    if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN && nienHanData && nienHanData.length > 0) {
      const personnelIds = nienHanData.map(item => item.personnel_id).filter(Boolean);

      for (const personnelId of personnelIds) {
        try {
          const quanNhan = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: {
              id: true,
              ho_ten: true,
              gioi_tinh: true,
              ngay_nhap_ngu: true,
              ngay_xuat_ngu: true,
            },
          });

          if (!quanNhan) {
            duplicateErrors.push(`${personnelId}: Không tìm thấy quân nhân`);
            continue;
          }

          if (
            !quanNhan.gioi_tinh ||
            (quanNhan.gioi_tinh !== 'NAM' && quanNhan.gioi_tinh !== 'NU')
          ) {
            duplicateErrors.push(`${quanNhan.ho_ten}: Chưa cập nhật thông tin giới tính`);
            continue;
          }

          if (!quanNhan.ngay_nhap_ngu) {
            duplicateErrors.push(`${quanNhan.ho_ten}: Chưa có thông tin ngày nhập ngũ`);
            continue;
          }

          const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
          const ngayKetThuc = quanNhan.ngay_xuat_ngu
            ? new Date(quanNhan.ngay_xuat_ngu)
            : new Date();

          let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
          months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
          if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
            months--;
          }
          months = Math.max(0, months);

          const years = Math.floor(months / 12);
          const requiredYears = quanNhan.gioi_tinh === 'NU' ? 20 : 25;

          if (years < requiredYears) {
            duplicateErrors.push(
              `${quanNhan.ho_ten}: Chưa đủ ${requiredYears} năm phục vụ để nhận KNC VSNXD QĐNDVN (hiện tại: ${years} năm)`
            );
          }
        } catch (error) {
          duplicateErrors.push(
            `${personnelId}: Lỗi kiểm tra điều kiện KNC_VSNXD_QDNDVN: ${error.message}`
          );
        }
      }
    }

    // CONG_HIEN: requires minimum contribution time (by position coefficient group).
    if (proposalType === PROPOSAL_TYPES.CONG_HIEN && congHienData && congHienData.length > 0) {
      const baseRequiredMonths = 10 * 12; // 120 months (10 yrs) for male
      // 2/3 of male requirement = 80 months for female
      const femaleRequiredMonths = Math.round(baseRequiredMonths * (2 / 3));

      const personnelIds = congHienData.map(item => item.personnel_id).filter(Boolean);
      const positionHistoriesMap = {};
      const personnelGenderMap = {};

      for (const personnelId of personnelIds) {
        try {
          const quanNhan = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: {
              id: true,
              ho_ten: true,
              gioi_tinh: true,
            },
          });

          if (quanNhan) {
            personnelGenderMap[personnelId] = quanNhan.gioi_tinh;
          }

          const histories = await prisma.lichSuChucVu.findMany({
            where: { quan_nhan_id: personnelId },
            select: {
              he_so_chuc_vu: true,
              so_thang: true,
              ngay_bat_dau: true,
              ngay_ket_thuc: true,
            },
          });

          const today = new Date();
          const updatedHistories = histories.map(item => {
            if (item.so_thang === null || item.so_thang === undefined) {
              if (item.ngay_bat_dau && !item.ngay_ket_thuc) {
                const ngayBatDau = new Date(item.ngay_bat_dau);
                let months = (today.getFullYear() - ngayBatDau.getFullYear()) * 12;
                months += today.getMonth() - ngayBatDau.getMonth();
                if (today.getDate() < ngayBatDau.getDate()) {
                  months--;
                }
                return {
                  ...item,
                  so_thang: Math.max(0, months),
                };
              }
            }
            return item;
          });

          positionHistoriesMap[personnelId] = updatedHistories;
        } catch (error) {
          console.error('ProposalApprove.buildPositionHistories failed', { personnelId, error });
          positionHistoriesMap[personnelId] = [];
        }
      }

      const getTotalMonthsByGroup = (personnelId, group) => {
        const histories = positionHistoriesMap[personnelId] || [];
        let totalMonths = 0;

        histories.forEach(history => {
          const heSo = Number(history.he_so_chuc_vu) || 0;
          let belongsToGroup = false;

          if (group === '0.7') {
            belongsToGroup = heSo >= 0.7 && heSo < 0.8;
          } else if (group === '0.8') {
            belongsToGroup = heSo >= 0.8 && heSo < 0.9;
          } else if (group === '0.9-1.0') {
            belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
          }

          if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
            totalMonths += Number(history.so_thang);
          }
        });

        return totalMonths;
      };

      const getRequiredMonths = personnelId => {
        const gioiTinh = personnelGenderMap[personnelId];
        return gioiTinh === 'NU' ? femaleRequiredMonths : baseRequiredMonths;
      };

      const checkEligibleForRank = (personnelId, rank) => {
        const months0_9_1_0 = getTotalMonthsByGroup(personnelId, '0.9-1.0');
        const months0_8 = getTotalMonthsByGroup(personnelId, '0.8');
        const months0_7 = getTotalMonthsByGroup(personnelId, '0.7');
        const requiredMonths = getRequiredMonths(personnelId);

        if (rank === 'HANG_NHAT') {
          return months0_9_1_0 >= requiredMonths;
        } else if (rank === 'HANG_NHI') {
          return months0_8 + months0_9_1_0 >= requiredMonths;
        } else if (rank === 'HANG_BA') {
          return months0_7 + months0_8 + months0_9_1_0 >= requiredMonths;
        }

        return false;
      };

      for (const item of congHienData) {
        if (!item.danh_hieu || !item.personnel_id) continue;

        const quanNhan = await prisma.quanNhan.findUnique({
          where: { id: item.personnel_id },
          select: { ho_ten: true },
        });
        const hoTen = quanNhan?.ho_ten || item.personnel_id;
        const gioiTinh = personnelGenderMap[item.personnel_id];
        const requiredMonths = getRequiredMonths(item.personnel_id);

        let eligible = false;
        let rankName = '';

        if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
          eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHAT');
          rankName = 'Hạng Nhất';
        } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
          eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHI');
          rankName = 'Hạng Nhì';
        } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
          eligible = checkEligibleForRank(item.personnel_id, 'HANG_BA');
          rankName = 'Hạng Ba';
        }

        if (!eligible) {
          const months0_9_1_0 = getTotalMonthsByGroup(item.personnel_id, '0.9-1.0');
          const months0_8 = getTotalMonthsByGroup(item.personnel_id, '0.8');
          const months0_7 = getTotalMonthsByGroup(item.personnel_id, '0.7');

          let totalMonths = 0;
          if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
            totalMonths = months0_9_1_0;
          } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
            totalMonths = months0_8 + months0_9_1_0;
          } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
            totalMonths = months0_7 + months0_8 + months0_9_1_0;
          }

          const totalYears = Math.floor(totalMonths / 12);
          const remainingMonths = totalMonths % 12;
          const totalYearsText =
            totalYears > 0 && remainingMonths > 0
              ? `${totalYears} năm ${remainingMonths} tháng`
              : totalYears > 0
                ? `${totalYears} năm`
                : `${remainingMonths} tháng`;

          const requiredYears = Math.floor(requiredMonths / 12);
          const requiredRemainingMonths = requiredMonths % 12;
          const requiredYearsText =
            requiredYears > 0 && requiredRemainingMonths > 0
              ? `${requiredYears} năm ${requiredRemainingMonths} tháng`
              : requiredYears > 0
                ? `${requiredYears} năm`
                : `${requiredRemainingMonths} tháng`;

          const genderText = gioiTinh === 'NU' ? ' (Nữ giảm 1/3 thời gian)' : '';

          duplicateErrors.push(
            `${hoTen}: Không đủ điều kiện Huân chương Bảo vệ Tổ quốc ${rankName}. ` +
              `Yêu cầu: ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}.`
          );
        }
      }
    }

    // Stop if eligibility re-check failed.
    if (duplicateErrors.length > 0) {
      throw new ValidationError(
        `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${duplicateErrors.join('\n')}`
      );
    }

    let importedDanhHieu = 0;
    let importedThanhTich = 0;
    let importedNienHan = 0;
    const errors = [];
    const affectedPersonnelIds = new Set(); // Track affected personnel ids.

    // Save decision PDFs to uploads (if provided).
    const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'decisions');
    await fs.mkdir(uploadsDir, { recursive: true });

    const pdfPaths: Record<string, string | undefined> = {};

    // Generates a unique filename (sanitized) and appends a counter when needed.
    const getUniqueFilename = async originalName => {
      let processedName = originalName || 'file';
      try {
        if (Buffer.isBuffer(processedName)) {
          processedName = processedName.toString('utf8');
        } else if (typeof processedName === 'string') {
          processedName = Buffer.from(processedName, 'latin1').toString('utf8');
        }
      } catch (e) {
        processedName = 'file';
      }

      const sanitized = sanitizeFilename(processedName);
      const ext = path.extname(sanitized);
      const baseName = path.basename(sanitized, ext);
      let filename = sanitized;
      let counter = 1;

      while (
        await fs
          .access(path.join(uploadsDir, filename))
          .then(() => true)
          .catch(() => false)
      ) {
        filename = `${baseName}(${counter})${ext}`;
        counter++;
      }

      return filename;
    };

    // Returns existing file_path for a decision number (if any).
    const getFilePathFromDB = async (soQuyetDinh: string | null | undefined) => {
      if (!soQuyetDinh) return null;
      try {
        const decision = await prisma.fileQuyetDinh.findUnique({
          where: { so_quyet_dinh: soQuyetDinh },
          select: { file_path: true },
        });
        return decision?.file_path || null;
      } catch (error) {
        console.error('ProposalApprove.getFilePathFromDB failed', { soQuyetDinh, error });
        return null;
      }
    };

    // Maps uploaded PDF keys to their decision numbers.
    const pdfFileToDecisionMap = {
      file_pdf_ca_nhan_hang_nam: decisions.so_quyet_dinh_ca_nhan_hang_nam,
      file_pdf_don_vi_hang_nam: decisions.so_quyet_dinh_don_vi_hang_nam,
      file_pdf_nien_han: decisions.so_quyet_dinh_nien_han,
      file_pdf_cong_hien: decisions.so_quyet_dinh_cong_hien,
      file_pdf_dot_xuat: decisions.so_quyet_dinh_dot_xuat,
      file_pdf_nckh: decisions.so_quyet_dinh_nckh,
    };

    // Save PDFs for each category.
    for (const [key, file] of Object.entries(pdfFiles)) {
      if (file && file.buffer) {
        const soQuyetDinh = pdfFileToDecisionMap[key];

        const existingFilePath = await getFilePathFromDB(soQuyetDinh);

        if (existingFilePath) {
          pdfPaths[key] = existingFilePath;
        } else {
          const filename = await getUniqueFilename(file.originalname);
          const filepath = path.join(uploadsDir, filename);
          await fs.writeFile(filepath, file.buffer);
          pdfPaths[key] = `uploads/decisions/${filename}`;
        }
      }
    }

    // Save PDF for scientific achievement (if provided).
    if (pdfFiles.file_pdf_nckh && pdfFiles.file_pdf_nckh.buffer) {
      const soQuyetDinh = decisions.so_quyet_dinh_nckh;
      const existingFilePath = await getFilePathFromDB(soQuyetDinh);

      if (existingFilePath) {
        pdfPaths.file_pdf_nckh = existingFilePath;
      } else {
        const filename = await getUniqueFilename(pdfFiles.file_pdf_nckh.originalname);
        const filepath = path.join(uploadsDir, filename);
        await fs.writeFile(filepath, pdfFiles.file_pdf_nckh.buffer);
        pdfPaths.file_pdf_nckh = `uploads/decisions/${filename}`;
      }
    }

    // Decision mapping (award/title -> decision metadata).
    const decisionMapping = {
      CSTT: {
        so_quyet_dinh: decisions.so_quyet_dinh_cstt,
        file_pdf: pdfPaths.file_pdf_cstt,
      },
      CSTDCS: {
        so_quyet_dinh: decisions.so_quyet_dinh_cstdcs,
        file_pdf: pdfPaths.file_pdf_cstdcs,
      },
      ĐVQT: {
        so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
        file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
      },
      ĐVTT: {
        so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
        file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
      },
      HCCSVV_HANG_BA: {
        so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
        file_pdf: pdfPaths.file_pdf_nien_han,
      },
      HCCSVV_HANG_NHI: {
        so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
        file_pdf: pdfPaths.file_pdf_nien_han,
      },
      HCCSVV_HANG_NHAT: {
        so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
        file_pdf: pdfPaths.file_pdf_nien_han,
      },
      HC_QKQT: {
        so_quyet_dinh: decisions.so_quyet_dinh_hc_qkqt || decisions.so_quyet_dinh_nien_han,
        file_pdf: pdfPaths.file_pdf_hc_qkqt || pdfPaths.file_pdf_nien_han,
      },
      KNC_VSNXD_QDNDVN: {
        so_quyet_dinh: decisions.so_quyet_dinh_knc_vsnxd || decisions.so_quyet_dinh_nien_han,
        file_pdf: pdfPaths.file_pdf_knc_vsnxd || pdfPaths.file_pdf_nien_han,
      },
    };

    const specialDecisionMapping = {
      BKBQP: {
        so_quyet_dinh: decisions.so_quyet_dinh_bkbqp,
        file_pdf: pdfPaths.file_pdf_bkbqp,
      },
      CSTDTQ: {
        so_quyet_dinh: decisions.so_quyet_dinh_cstdtq,
        file_pdf: pdfPaths.file_pdf_cstdtq,
      },
      BKTTCP: {
        so_quyet_dinh: decisions.so_quyet_dinh_bkttcp,
        file_pdf: pdfPaths.file_pdf_bkttcp,
      },
    };

    // TRANSACTION: Wrap all database writes in a transaction
    await prisma.$transaction(
      async tx => {
        // Unit annual titles import.
        if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          for (const item of danhHieuData) {
            try {
              if (!item.don_vi_id || !item.don_vi_type) {
                errors.push(`Thiếu thông tin đơn vị trong dữ liệu: ${JSON.stringify(item)}`);
                continue;
              }

              const coQuanDonViId = item.don_vi_type === 'CO_QUAN_DON_VI' ? item.don_vi_id : null;
              const donViTrucThuocId =
                item.don_vi_type === 'DON_VI_TRUC_THUOC' ? item.don_vi_id : null;

              const namValue = typeof item.nam === 'string' ? parseInt(item.nam, 10) : item.nam;

              if (!item.danh_hieu || item.danh_hieu.trim() === '') {
                continue;
              }

              const decisionInfo = decisionMapping[item.danh_hieu] || {};
              const soQuyetDinh = item.so_quyet_dinh || decisionInfo.so_quyet_dinh || null;
              const fileQuyetDinh = item.file_quyet_dinh || decisionInfo.file_pdf || null;

              const nhanBKBQP = item.nhan_bkbqp || false;
              const soQuyetDinhBKBQP =
                item.so_quyet_dinh_bkbqp ||
                (nhanBKBQP ? specialDecisionMapping.BKBQP?.so_quyet_dinh : null) ||
                (nhanBKBQP ? item.so_quyet_dinh : null);
              const fileQuyetDinhBKBQP =
                item.file_quyet_dinh_bkbqp ||
                (nhanBKBQP ? specialDecisionMapping.BKBQP?.file_pdf : null) ||
                (nhanBKBQP ? item.file_quyet_dinh : null);

              const nhanBKTTCP = item.nhan_bkttcp || false;
              const soQuyetDinhBKTTCP =
                item.so_quyet_dinh_bkttcp ||
                (nhanBKTTCP ? specialDecisionMapping.CSTDTQ?.so_quyet_dinh : null) ||
                (nhanBKTTCP ? item.so_quyet_dinh : null);
              const fileQuyetDinhBKTTCP =
                item.file_quyet_dinh_bkttcp ||
                (nhanBKTTCP ? specialDecisionMapping.CSTDTQ?.file_pdf : null) ||
                (nhanBKTTCP ? item.file_quyet_dinh : null);

              const whereCondition = {
                nam: namValue,
                OR: [
                  ...(coQuanDonViId ? [{ co_quan_don_vi_id: coQuanDonViId }] : []),
                  ...(donViTrucThuocId ? [{ don_vi_truc_thuoc_id: donViTrucThuocId }] : []),
                ],
              };

              const existingAward = await tx.danhHieuDonViHangNam.findFirst({
                where: whereCondition,
              });

              const data: Record<string, any> = {};

              if (item.danh_hieu === 'ĐVQT' || item.danh_hieu === 'ĐVTT') {
                data.danh_hieu = item.danh_hieu;
                data.so_quyet_dinh = soQuyetDinh;
              }
              if (item.danh_hieu === 'BKBQP') {
                data.nhan_bkbqp = nhanBKBQP;
                data.so_quyet_dinh_bkbqp = soQuyetDinhBKBQP;
              }

              if (item.danh_hieu === 'BKTTCP') {
                data.nhan_bkttcp = nhanBKTTCP;
                data.so_quyet_dinh_bkttcp = soQuyetDinhBKTTCP;
              }
              data.status = PROPOSAL_STATUS.APPROVED;
              data.nguoi_duyet_id = adminId;
              data.ngay_duyet = new Date();
              data.ghi_chu = item.ghi_chu || null;

              let savedAward;
              if (existingAward) {
                savedAward = await tx.danhHieuDonViHangNam.update({
                  where: { id: existingAward.id },
                  data: data,
                });
              } else {
                savedAward = await tx.danhHieuDonViHangNam.create({
                  data: {
                    ...(coQuanDonViId && {
                      CoQuanDonVi: { connect: { id: coQuanDonViId } },
                    }),
                    ...(donViTrucThuocId && {
                      DonViTrucThuoc: { connect: { id: donViTrucThuocId } },
                    }),
                    nam: namValue,
                    danh_hieu:
                      item.danh_hieu === 'ĐVQT' || item.danh_hieu === 'ĐVTT'
                        ? item.danh_hieu
                        : null,
                    so_quyet_dinh:
                      item.danh_hieu === 'ĐVQT' || item.danh_hieu === 'ĐVTT' ? soQuyetDinh : null,
                    nhan_bkbqp: nhanBKBQP,
                    so_quyet_dinh_bkbqp: soQuyetDinhBKBQP,
                    nhan_bkttcp: nhanBKTTCP,
                    so_quyet_dinh_bkttcp: soQuyetDinhBKTTCP,
                    status: PROPOSAL_STATUS.APPROVED,
                    nguoi_tao_id: adminId,
                    nguoi_duyet_id: adminId,
                    ngay_duyet: new Date(),
                    ghi_chu: item.ghi_chu || null,
                  },
                });
              }
              importedDanhHieu++;
            } catch (error) {
              errors.push(
                `Lỗi import khen thưởng đơn vị ${item.ten_don_vi || item.don_vi_id}: ${error.message}`
              );
            }
          }
        } else if (proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
          // Contribution proposals import into KhenThuongCongHien.
          for (const item of congHienData) {
            try {
              if (!item.personnel_id) {
                errors.push(`Thiếu personnel_id trong dữ liệu danh hiệu: ${JSON.stringify(item)}`);
                continue;
              }

              const quanNhan = await tx.quanNhan.findUnique({
                where: { id: item.personnel_id },
              });

              if (!quanNhan) {
                errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
                continue;
              }

              const soQuyetDinhDanhHieu =
                item.so_quyet_dinh || decisions.so_quyet_dinh_cong_hien || null;
              const filePdfDanhHieu = item.file_quyet_dinh || pdfPaths.file_pdf_cong_hien || null;

              const namLuu = proposal.nam;

              const thoiGianNhom0_7 = item.thoi_gian_nhom_0_7 || null;
              const thoiGianNhom0_8 = item.thoi_gian_nhom_0_8 || null;
              const thoiGianNhom0_9_1_0 = item.thoi_gian_nhom_0_9_1_0 || null;

              const existingCongHien = await tx.khenThuongCongHien.findUnique({
                where: {
                  quan_nhan_id: quanNhan.id,
                },
              });

              if (existingCongHien) {
                const rankOrder = {
                  HCBVTQ_HANG_BA: 1,
                  HCBVTQ_HANG_NHI: 2,
                  HCBVTQ_HANG_NHAT: 3,
                };

                const existingRank = rankOrder[existingCongHien.danh_hieu] || 0;
                const newRank = rankOrder[item.danh_hieu] || 0;

                if (newRank > existingRank) {
                  await tx.khenThuongCongHien.update({
                    where: { id: existingCongHien.id },
                    data: {
                      danh_hieu: item.danh_hieu,
                      nam: namLuu,
                      cap_bac: item.cap_bac || null,
                      chuc_vu: item.chuc_vu || null,
                      ghi_chu: item.ghi_chu || null,
                      so_quyet_dinh: soQuyetDinhDanhHieu,
                      thoi_gian_nhom_0_7: thoiGianNhom0_7,
                      thoi_gian_nhom_0_8: thoiGianNhom0_8,
                      thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
                    },
                  });
                  importedDanhHieu++;
                  affectedPersonnelIds.add(quanNhan.id);
                } else {
                  const existingDanhHieuName = getDanhHieuName(existingCongHien.danh_hieu);
                  const newDanhHieuName = getDanhHieuName(item.danh_hieu);

                  errors.push(
                    `Quân nhân "${quanNhan.ho_ten}" đã có Huân chương Bảo vệ Tổ quốc "${existingDanhHieuName}" (năm ${existingCongHien.nam}). ` +
                      `Không thể lưu danh hiệu "${newDanhHieuName}" vì hạng thấp hơn hoặc bằng.`
                  );
                }
              } else {
                await tx.khenThuongCongHien.create({
                  data: {
                    quan_nhan_id: quanNhan.id,
                    danh_hieu: item.danh_hieu,
                    nam: namLuu,
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinhDanhHieu,
                    thoi_gian_nhom_0_7: thoiGianNhom0_7,
                    thoi_gian_nhom_0_8: thoiGianNhom0_8,
                    thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
                  },
                });
                importedDanhHieu++;
                affectedPersonnelIds.add(quanNhan.id);
              }
            } catch (error) {
              errors.push(
                `Lỗi import Huân chương Bảo vệ Tổ quốc personnel_id ${item.personnel_id || ' '}: ${error.message}`
              );
            }
          }
        } else {
          // Other proposal types (CA_NHAN_HANG_NAM, DOT_XUAT).
          for (const item of danhHieuData) {
            try {
              if (!item.personnel_id) {
                errors.push(`Thiếu personnel_id trong dữ liệu danh hiệu: ${JSON.stringify(item)}`);
                continue;
              }

              const quanNhan = await tx.quanNhan.findUnique({
                where: { id: item.personnel_id },
              });

              if (!quanNhan) {
                errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
                continue;
              }

              const namLuu = proposal.nam;

              let soQuyetDinhDanhHieu = null;
              let filePdfDanhHieu = null;

              const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
              soQuyetDinhDanhHieu = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
              filePdfDanhHieu = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

              let soQuyetDinhBKBQP = item.so_quyet_dinh_bkbqp;
              let filePdfBKBQP = item.file_quyet_dinh_bkbqp || null;
              let nhanBKBQP = item.nhan_bkbqp || false;

              if (soQuyetDinhBKBQP || filePdfBKBQP) {
                nhanBKBQP = true;
              }

              if (nhanBKBQP) {
                soQuyetDinhBKBQP =
                  soQuyetDinhBKBQP ||
                  specialDecisionMapping.BKBQP.so_quyet_dinh ||
                  item.so_quyet_dinh;
                filePdfBKBQP =
                  filePdfBKBQP || specialDecisionMapping.BKBQP.file_pdf || item.file_quyet_dinh;
              }

              let soQuyetDinhCSTDTQ = item.so_quyet_dinh_cstdtq;
              let filePdfCSTDTQ = item.file_quyet_dinh_cstdtq || null;
              let nhanCSTDTQ = item.nhan_cstdtq || false;

              if (soQuyetDinhCSTDTQ || filePdfCSTDTQ) {
                nhanCSTDTQ = true;
              }

              if (nhanCSTDTQ) {
                soQuyetDinhCSTDTQ =
                  soQuyetDinhCSTDTQ ||
                  specialDecisionMapping.CSTDTQ.so_quyet_dinh ||
                  item.so_quyet_dinh;
                filePdfCSTDTQ =
                  filePdfCSTDTQ || specialDecisionMapping.CSTDTQ.file_pdf || item.file_quyet_dinh;
              }

              let soQuyetDinhBKTTCP = item.so_quyet_dinh_bkttcp;
              let filePdfBKTTCP = item.file_quyet_dinh_bkttcp || null;
              let nhanBKTTCP = item.nhan_bkttcp || false;

              if (soQuyetDinhBKTTCP || filePdfBKTTCP) {
                nhanBKTTCP = true;
              }

              if (nhanBKTTCP) {
                soQuyetDinhBKTTCP =
                  soQuyetDinhBKTTCP ||
                  specialDecisionMapping.BKTTCP.so_quyet_dinh ||
                  item.so_quyet_dinh;
                filePdfBKTTCP =
                  filePdfBKTTCP || specialDecisionMapping.BKTTCP.file_pdf || item.file_quyet_dinh;
              }

              const data: Record<string, any> = {};

              data.cap_bac = item.cap_bac || null;
              data.chuc_vu = item.chuc_vu || null;
              data.ghi_chu = item.ghi_chu || null;

              if (item.danh_hieu === 'CSTT' || item.danh_hieu === 'CSTDCS') {
                data.danh_hieu = item.danh_hieu;
                data.so_quyet_dinh = soQuyetDinhDanhHieu;
              }

              if (item.danh_hieu === 'BKBQP') {
                data.nhan_bkbqp = nhanBKBQP;
                data.so_quyet_dinh_bkbqp = soQuyetDinhBKBQP;
              }

              if (item.danh_hieu === 'CSTDTQ') {
                data.nhan_cstdtq = nhanCSTDTQ;
                data.so_quyet_dinh_cstdtq = soQuyetDinhCSTDTQ;
              }

              if (item.danh_hieu === 'BKTTCP') {
                data.nhan_bkttcp = nhanBKTTCP;
                data.so_quyet_dinh_bkttcp = soQuyetDinhBKTTCP;
              }

              const savedDanhHieu = await tx.danhHieuHangNam.upsert({
                where: {
                  quan_nhan_id_nam: {
                    quan_nhan_id: quanNhan.id,
                    nam: namLuu,
                  },
                },
                update: {
                  ...data,
                },
                create: {
                  quan_nhan_id: quanNhan.id,
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  danh_hieu:
                    item.danh_hieu === 'CSTT' || item.danh_hieu === 'CSTDCS'
                      ? item.danh_hieu
                      : null,
                  so_quyet_dinh:
                    item.danh_hieu === 'CSTT' || item.danh_hieu === 'CSTDCS'
                      ? soQuyetDinhDanhHieu
                      : null,
                  nhan_bkbqp: nhanBKBQP,
                  so_quyet_dinh_bkbqp: soQuyetDinhBKBQP,
                  nhan_cstdtq: nhanCSTDTQ,
                  so_quyet_dinh_cstdtq: soQuyetDinhCSTDTQ,
                  nhan_bkttcp: nhanBKTTCP,
                  so_quyet_dinh_bkttcp: soQuyetDinhBKTTCP,
                },
              });

              importedDanhHieu++;
              affectedPersonnelIds.add(quanNhan.id);
            } catch (error) {
              errors.push(
                `Lỗi import danh hiệu personnel_id ${item.personnel_id || 'N/A'}: ${error.message}`
              );
            }
          }
        }

        // Tenure import (HCCSVV ranks only).
        if (
          proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN &&
          nienHanData &&
          nienHanData.length > 0
        ) {
          for (const item of nienHanData) {
            try {
              if (!item.personnel_id) {
                errors.push(
                  `Huy chương Chiến sĩ vẻ vang thiếu personnel_id: ${JSON.stringify(item)}`
                );
                continue;
              }

              const quanNhan = await tx.quanNhan.findUnique({
                where: { id: item.personnel_id },
              });

              if (!quanNhan) {
                errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
                continue;
              }

              if (!item.danh_hieu) {
                errors.push(
                  `Huy chương Chiến sĩ vẻ vang thiếu danh_hieu cho quân nhân ${quanNhan.id}`
                );
                continue;
              }

              const allowedDanhHieus = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
              if (allowedDanhHieus.includes(item.danh_hieu)) {
                const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
                let soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
                let filePdf = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

                const namLuu = proposal.nam;

                // Compute service time from enlistment date.
                let thoiGian = null;
                if (quanNhan.ngay_nhap_ngu) {
                  const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
                  const ngayKetThuc = quanNhan.ngay_xuat_ngu
                    ? new Date(quanNhan.ngay_xuat_ngu)
                    : new Date();

                  let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
                  months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
                  if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                    months--;
                  }
                  months = Math.max(0, months);

                  const years = Math.floor(months / 12);
                  const remainingMonths = months % 12;
                  thoiGian = {
                    total_months: months,
                    years: years,
                    months: remainingMonths,
                    display:
                      months === 0
                        ? '-'
                        : years > 0 && remainingMonths > 0
                          ? `${years} năm ${remainingMonths} tháng`
                          : years > 0
                            ? `${years} năm`
                            : `${remainingMonths} tháng`,
                  };
                }

                await tx.khenThuongHCCSVV.upsert({
                  where: {
                    quan_nhan_id_danh_hieu: {
                      quan_nhan_id: quanNhan.id,
                      danh_hieu: item.danh_hieu,
                    },
                  },
                  update: {
                    nam: namLuu,
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinh,
                    thoi_gian: thoiGian,
                  },
                  create: {
                    quan_nhan_id: quanNhan.id,
                    danh_hieu: item.danh_hieu,
                    nam: namLuu,
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinh,
                    thoi_gian: thoiGian,
                  },
                });

                importedNienHan++;
                affectedPersonnelIds.add(quanNhan.id);
              }
            } catch (error) {
              errors.push(
                `Lỗi import Huy chương Chiến sĩ vẻ vang personnel_id ${item.personnel_id || 'N/A'}: ${error.message}`
              );
            }
          }
        }

        // HC_QKQT import.
        if (
          proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT &&
          nienHanData &&
          nienHanData.length > 0
        ) {
          for (const item of nienHanData) {
            try {
              if (!item.personnel_id) {
                errors.push(`HC_QKQT thiếu personnel_id: ${JSON.stringify(item)}`);
                continue;
              }

              const quanNhan = await tx.quanNhan.findUnique({
                where: { id: item.personnel_id },
              });

              if (!quanNhan) {
                errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
                continue;
              }

              const danhHieuDecision = (decisionMapping[PROPOSAL_TYPES.HC_QKQT] || {}) as Record<
                string,
                any
              >;
              let soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
              let filePdf = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

              const namLuu = proposal.nam;

              // Compute service time from enlistment date.
              let thoiGian = null;
              if (quanNhan.ngay_nhap_ngu) {
                const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
                const ngayKetThuc = quanNhan.ngay_xuat_ngu
                  ? new Date(quanNhan.ngay_xuat_ngu)
                  : new Date();

                let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
                months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
                if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                  months--;
                }
                months = Math.max(0, months);

                const years = Math.floor(months / 12);
                const remainingMonths = months % 12;
                thoiGian = {
                  total_months: months,
                  years: years,
                  months: remainingMonths,
                  display:
                    months === 0
                      ? '-'
                      : years > 0 && remainingMonths > 0
                        ? `${years} năm ${remainingMonths} tháng`
                        : years > 0
                          ? `${years} năm`
                          : `${remainingMonths} tháng`,
                };
              }

              const existingHC_QKQT = await tx.huanChuongQuanKyQuyetThang.findUnique({
                where: {
                  quan_nhan_id: quanNhan.id,
                },
              });

              if (existingHC_QKQT) {
                await tx.huanChuongQuanKyQuyetThang.update({
                  where: { id: existingHC_QKQT.id },
                  data: {
                    nam: namLuu,
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinh,
                    thoi_gian: thoiGian,
                  },
                });
              } else {
                await tx.huanChuongQuanKyQuyetThang.create({
                  data: {
                    quan_nhan_id: quanNhan.id,
                    nam: namLuu,
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinh,
                    thoi_gian: thoiGian,
                  },
                });
              }
              importedNienHan++;
              affectedPersonnelIds.add(quanNhan.id);
            } catch (error) {
              errors.push(
                `Lỗi import HC_QKQT personnel_id ${item.personnel_id || 'N/A'}: ${error.message}`
              );
            }
          }
        }

        // KNC_VSNXD_QDNDVN import.
        if (
          proposal.loai_de_xuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN &&
          nienHanData &&
          nienHanData.length > 0
        ) {
          for (const item of nienHanData) {
            try {
              if (!item.personnel_id) {
                errors.push(`KNC_VSNXD_QDNDVN thiếu personnel_id: ${JSON.stringify(item)}`);
                continue;
              }

              const quanNhan = await tx.quanNhan.findUnique({
                where: { id: item.personnel_id },
              });

              if (!quanNhan) {
                errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
                continue;
              }

              const danhHieuDecision = (decisionMapping[PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] ||
                {}) as Record<string, any>;
              let soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
              let filePdf = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

              const namLuu = proposal.nam;

              let thoiGian = null;
              if (quanNhan.ngay_nhap_ngu) {
                const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
                const ngayKetThuc = quanNhan.ngay_xuat_ngu
                  ? new Date(quanNhan.ngay_xuat_ngu)
                  : new Date();

                let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
                months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
                if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                  months--;
                }
                months = Math.max(0, months);

                const years = Math.floor(months / 12);
                const remainingMonths = months % 12;
                thoiGian = {
                  total_months: months,
                  years: years,
                  months: remainingMonths,
                  display:
                    months === 0
                      ? '-'
                      : years > 0 && remainingMonths > 0
                        ? `${years} năm ${remainingMonths} tháng`
                        : years > 0
                          ? `${years} năm`
                          : `${remainingMonths} tháng`,
                };
              }

              const existingKNC = await tx.kyNiemChuongVSNXDQDNDVN.findUnique({
                where: {
                  quan_nhan_id: quanNhan.id,
                },
              });

              if (existingKNC) {
                await tx.kyNiemChuongVSNXDQDNDVN.update({
                  where: { id: existingKNC.id },
                  data: {
                    nam: namLuu,
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinh,
                    thoi_gian: thoiGian,
                  },
                });
              } else {
                await tx.kyNiemChuongVSNXDQDNDVN.create({
                  data: {
                    quan_nhan_id: quanNhan.id,
                    nam: namLuu,
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinh,
                    thoi_gian: thoiGian,
                  },
                });
              }
              importedNienHan++;
              affectedPersonnelIds.add(quanNhan.id);
            } catch (error) {
              errors.push(
                `Lỗi import KNC_VSNXD_QDNDVN personnel_id ${item.personnel_id || 'N/A'}: ${
                  error.message
                }`
              );
            }
          }
        }

        // Scientific achievements import.
        for (const item of thanhTichData) {
          try {
            if (!item.personnel_id) {
              errors.push(`Thành tích thiếu personnel_id: ${JSON.stringify(item)}`);
              continue;
            }

            const quanNhan = await tx.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            if (!item.nam) {
              errors.push(`Thành tích thiếu năm cho quân nhân ${quanNhan.id}`);
              continue;
            }

            if (!item.loai || !['DTKH', 'SKKH'].includes(item.loai)) {
              errors.push(
                `Thành tích có loại không hợp lệ cho quân nhân ${quanNhan.id}: ${item.loai}`
              );
              continue;
            }

            if (!item.mo_ta || item.mo_ta.trim() === '') {
              errors.push(`Thành tích thiếu mô tả cho quân nhân ${quanNhan.id}`);
              continue;
            }

            const soQuyetDinhThanhTich = item.so_quyet_dinh || null;

            await tx.thanhTichKhoaHoc.create({
              data: {
                quan_nhan_id: quanNhan.id,
                nam: parseInt(item.nam, 10),
                loai: item.loai,
                mo_ta: item.mo_ta.trim(),
                chuc_vu: item.chuc_vu || null,
                cap_bac: item.cap_bac || null,
                ghi_chu: item.ghi_chu || null,
                so_quyet_dinh: soQuyetDinhThanhTich,
              },
            });

            importedThanhTich++;
            affectedPersonnelIds.add(quanNhan.id);
          } catch (error) {
            errors.push(
              `Lỗi import thành tích ID ${item.personnel_id || 'N/A'} hoặc CCCD ${
                item.cccd || 'N/A'
              }: ${error.message}`
            );
          }
        }

        // Sync decision metadata into FileQuyetDinh.
        const decisionsToSync = new Set<string>();

        for (const item of danhHieuData) {
          if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
          if (item.so_quyet_dinh_bkbqp) decisionsToSync.add(item.so_quyet_dinh_bkbqp);
          if (item.so_quyet_dinh_cstdtq) decisionsToSync.add(item.so_quyet_dinh_cstdtq);
        }

        for (const item of thanhTichData) {
          if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
        }

        if (decisions.so_quyet_dinh_ca_nhan_hang_nam)
          decisionsToSync.add(decisions.so_quyet_dinh_ca_nhan_hang_nam);
        if (decisions.so_quyet_dinh_don_vi_hang_nam)
          decisionsToSync.add(decisions.so_quyet_dinh_don_vi_hang_nam);
        if (decisions.so_quyet_dinh_nien_han) decisionsToSync.add(decisions.so_quyet_dinh_nien_han);
        if (decisions.so_quyet_dinh_cong_hien)
          decisionsToSync.add(decisions.so_quyet_dinh_cong_hien);
        if (decisions.so_quyet_dinh_dot_xuat) decisionsToSync.add(decisions.so_quyet_dinh_dot_xuat);
        if (decisions.so_quyet_dinh_nckh) decisionsToSync.add(decisions.so_quyet_dinh_nckh);

        const adminInfo = await tx.taiKhoan.findUnique({
          where: { id: adminId },
          include: {
            QuanNhan: {
              select: {
                ho_ten: true,
              },
            },
          },
        });
        const ngayKy = new Date();
        const nguoiKy =
          (adminInfo as { QuanNhan?: { ho_ten?: string | null }; username?: string })?.QuanNhan
            ?.ho_ten ||
          adminInfo?.username ||
          'Chưa cập nhật';

        for (const soQuyetDinh of decisionsToSync) {
          if (!soQuyetDinh) continue;

          try {
            const existing = await tx.fileQuyetDinh.findUnique({
              where: { so_quyet_dinh: soQuyetDinh },
            });

            if (!existing) {
              let filePath = null;
              const loaiDeXuat = proposal.loai_de_xuat;

              if (
                loaiDeXuat === PROPOSAL_TYPES.CA_NHAN_HANG_NAM &&
                decisions.so_quyet_dinh_ca_nhan_hang_nam === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_ca_nhan_hang_nam;
              } else if (
                loaiDeXuat === PROPOSAL_TYPES.DON_VI_HANG_NAM &&
                decisions.so_quyet_dinh_don_vi_hang_nam === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_don_vi_hang_nam;
              } else if (
                loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN &&
                decisions.so_quyet_dinh_nien_han === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_nien_han;
              } else if (
                loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN &&
                decisions.so_quyet_dinh_cong_hien === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_cong_hien;
              } else if (
                loaiDeXuat === PROPOSAL_TYPES.DOT_XUAT &&
                decisions.so_quyet_dinh_dot_xuat === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_dot_xuat;
              } else if (loaiDeXuat === PROPOSAL_TYPES.NCKH) {
                const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
                if (
                  (matchingThanhTich || decisions.so_quyet_dinh_nckh === soQuyetDinh) &&
                  pdfPaths.file_pdf_nckh
                ) {
                  filePath = pdfPaths.file_pdf_nckh;
                }
              }

              if (!filePath) {
                const matchingDanhHieu = danhHieuData.find(
                  d =>
                    d.so_quyet_dinh === soQuyetDinh ||
                    d.so_quyet_dinh_bkbqp === soQuyetDinh ||
                    d.so_quyet_dinh_cstdtq === soQuyetDinh ||
                    d.so_quyet_dinh_bkttcp === soQuyetDinh
                );
                if (matchingDanhHieu) {
                  filePath =
                    matchingDanhHieu.file_quyet_dinh ||
                    matchingDanhHieu.file_quyet_dinh_bkbqp ||
                    matchingDanhHieu.file_quyet_dinh_cstdtq ||
                    matchingDanhHieu.file_quyet_dinh_bkttcp ||
                    null;
                }

                if (!filePath) {
                  const matchingThanhTich = thanhTichData.find(
                    t => t.so_quyet_dinh === soQuyetDinh
                  );
                  if (matchingThanhTich && matchingThanhTich.file_quyet_dinh) {
                    filePath = matchingThanhTich.file_quyet_dinh;
                  }
                }
              }

              let loaiKhenThuong = proposal.loai_de_xuat || PROPOSAL_TYPES.CA_NHAN_HANG_NAM;

              await tx.fileQuyetDinh.create({
                data: {
                  so_quyet_dinh: soQuyetDinh,
                  nam: proposal.nam,
                  ngay_ky: ngayKy,
                  nguoi_ky: nguoiKy,
                  file_path: filePath,
                  loai_khen_thuong: loaiKhenThuong,
                  ghi_chu: `Tự động đồng bộ từ đề xuất ${proposalId}`,
                },
              });
            } else {
              if (!existing.file_path) {
                let filePath = null;
                const loaiDeXuat = proposal.loai_de_xuat;

                if (
                  loaiDeXuat === PROPOSAL_TYPES.CA_NHAN_HANG_NAM &&
                  decisions.so_quyet_dinh_ca_nhan_hang_nam === soQuyetDinh
                ) {
                  filePath = pdfPaths.file_pdf_ca_nhan_hang_nam;
                } else if (
                  loaiDeXuat === PROPOSAL_TYPES.DON_VI_HANG_NAM &&
                  decisions.so_quyet_dinh_don_vi_hang_nam === soQuyetDinh
                ) {
                  filePath = pdfPaths.file_pdf_don_vi_hang_nam;
                } else if (
                  loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN &&
                  decisions.so_quyet_dinh_nien_han === soQuyetDinh
                ) {
                  filePath = pdfPaths.file_pdf_nien_han;
                } else if (
                  loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN &&
                  decisions.so_quyet_dinh_cong_hien === soQuyetDinh
                ) {
                  filePath = pdfPaths.file_pdf_cong_hien;
                } else if (
                  loaiDeXuat === PROPOSAL_TYPES.DOT_XUAT &&
                  decisions.so_quyet_dinh_dot_xuat === soQuyetDinh
                ) {
                  filePath = pdfPaths.file_pdf_dot_xuat;
                } else if (loaiDeXuat === PROPOSAL_TYPES.NCKH) {
                  const matchingThanhTich = thanhTichData.find(
                    t => t.so_quyet_dinh === soQuyetDinh
                  );
                  if (
                    (matchingThanhTich || decisions.so_quyet_dinh_nckh === soQuyetDinh) &&
                    pdfPaths.file_pdf_nckh
                  ) {
                    filePath = pdfPaths.file_pdf_nckh;
                  }
                }

                if (filePath) {
                  await tx.fileQuyetDinh.update({
                    where: { so_quyet_dinh: soQuyetDinh },
                    data: { file_path: filePath },
                  });
                }
              }
            }
          } catch (error) {
            writeSystemLog({
              action: 'ERROR',
              resource: 'proposals',
              description: 'ProposalApprove.syncDecisionFiles failed',
              payload: { proposalId, soQuyetDinh, error },
            });
          }
        }

        // If any errors were collected during imports, throw to trigger transaction rollback
        if (errors.length > 0) {
          throw new ValidationError(
            `Không thể phê duyệt đề xuất do có ${
              errors.length
            } lỗi khi thêm khen thưởng:\n${errors.join('\n')}`
          );
        }
      },
      { timeout: 60000 }
    ); // End of transaction

    // Update proposal status (imports succeeded if we got here).
    const updateData: Record<string, any> = {
      status: PROPOSAL_STATUS.APPROVED,
      nguoi_duyet_id: adminId,
      ngay_duyet: new Date(),
      data_danh_hieu: danhHieuData,
      data_thanh_tich: thanhTichData,
      data_nien_han: nienHanData,
      data_cong_hien: congHienData,
      ...(ghiChu ? { ghi_chu: ghiChu } : {}),
    };

    // Atomic update: only approve when current status is still PENDING.
    const updateResult = await prisma.bangDeXuat.updateMany({
      where: { id: proposalId, status: PROPOSAL_STATUS.PENDING },
      data: updateData,
    });

    if (updateResult.count === 0) {
      throw new ValidationError(
        'Đề xuất đã bị thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.'
      );
    }

    // Recalculate profiles impacted by this approval.
    let recalculateSuccess = 0;
    let recalculateErrors = 0;

    await new Promise(resolve => setTimeout(resolve, 100));

    if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      const affectedUnits = new Set();
      for (const item of danhHieuData) {
        if (item.don_vi_id) {
          affectedUnits.add(item.don_vi_id);
        }
      }

      for (const donViId of affectedUnits) {
        try {
          await unitAnnualAwardService.recalculateAnnualUnit(donViId, proposal.nam);

          recalculateSuccess++;
        } catch (recalcError) {
          console.error('ProposalApprove.recalculateAnnualUnit failed', { donViId, error: recalcError });
          recalculateErrors++;
        }
      }
    } else {
      const recalculateType =
        proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN
          ? 'hồ sơ niên hạn (HCCSVV)'
          : proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN
            ? 'hồ sơ cống hiến (HCBVTQ)'
            : 'hồ sơ hằng năm';

      for (const personnelId of affectedPersonnelIds) {
        try {
          if (proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN) {
            await profileService.recalculateTenureProfile(personnelId);
          } else if (proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
            await profileService.recalculateContributionProfile(personnelId);
          } else {
            await profileService.recalculateAnnualProfile(personnelId);
          }

          recalculateSuccess++;
        } catch (recalcError) {
          console.error('ProposalApprove.recalculateProfile failed', { personnelId, error: recalcError });
          recalculateErrors++;
        }
      }
    }

    return {
      message: 'Phê duyệt và import dữ liệu thành công',
      proposal: proposal,
      affectedPersonnelIds: Array.from(affectedPersonnelIds),
      result: {
        don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
        nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
        imported_danh_hieu: importedDanhHieu,
        imported_thanh_tich: importedThanhTich,
        imported_nien_han: importedNienHan,
        total_danh_hieu: danhHieuData.length,
        total_thanh_tich: thanhTichData.length,
        total_nien_han: nienHanData.length,
        errors: errors.length > 0 ? errors : null,
        recalculated_profiles: recalculateSuccess,
        recalculate_errors: recalculateErrors,
      },
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Rejects a proposal with a reason.
 * @param proposalId - `bang_de_xuat.id`
 * @param lyDo - Rejection reason
 * @param adminId - Admin account id (`tai_khoan.id`)
 */
async function rejectProposal(proposalId: ProposalId, lyDo: string, adminId: AdminAccountId) {
  try {
    const proposal = await prisma.bangDeXuat.findUnique({
      where: { id: proposalId },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        NguoiDeXuat: {
          include: { QuanNhan: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('Đề xuất');
    }

    if (proposal.status === PROPOSAL_STATUS.APPROVED) {
      throw new ValidationError('Không thể từ chối đề xuất đã được phê duyệt');
    }

    if (proposal.status === PROPOSAL_STATUS.REJECTED) {
      throw new ValidationError('Đề xuất này đã bị từ chối trước đó');
    }

    // Atomic update: only reject when current status is still PENDING.
    const updateResult = await prisma.bangDeXuat.updateMany({
      where: { id: proposalId, status: PROPOSAL_STATUS.PENDING },
      data: {
        status: PROPOSAL_STATUS.REJECTED,
        nguoi_duyet_id: adminId,
        ngay_duyet: new Date(),
        rejection_reason: lyDo,
      },
    });

    if (updateResult.count === 0) {
      throw new ValidationError(
        'Đề xuất đã bị thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.'
      );
    }

    return {
      message: 'Từ chối đề xuất thành công',
      proposal: proposal,
      result: {
        don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
        nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
        ly_do: lyDo,
      },
    };
  } catch (error) {
    throw error;
  }
}

export { approveProposal, rejectProposal };
