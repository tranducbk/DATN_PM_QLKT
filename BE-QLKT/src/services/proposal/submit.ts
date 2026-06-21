import {
  PROPOSAL_TYPES,
  PROPOSAL_SUBMITTER_DELETED_LABEL,
  requiresProposalMonth,
  type ProposalType,
} from '../../constants/proposalTypes.constants';
import { accountRepository } from '../../repositories/account.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import type { Prisma } from '../../generated/prisma';
import { getProposalStrategy } from './strategies';
import { persistProposalAttachments } from './attachedFiles';
import { ROLES } from '../../constants/roles.constants';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';

/**
 * Creates a reward proposal with optional attachments.
 * @param titleData - Proposal title/achievement payload from the frontend
 * @param attachedFiles - Uploaded attachment files (if any)
 * @param userId - Manager account id
 * @param type - Proposal type
 * @param nam - Proposal year
 * @param ghiChu - Optional note
 * @returns Created proposal with related entities
 */
export interface SubmitTitleDataItem {
  personnel_id: string;
  don_vi_id?: string;
  don_vi_type?: string;
  danh_hieu?: string;
  loai?: string;
  mo_ta?: string;
  status?: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

export interface SubmitAttachedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

// MANAGER may only propose for personnel inside their own unit subtree; ADMIN is unscoped.
// Uses each personnel's CURRENT unit, so a transfer out of scope before submit is rejected.
// Deleted personnel are absent from the lookup and fall through to the strategy's not-found path.
async function assertPersonnelInScope(
  role: string,
  cqdvId: string | null,
  dvttId: string | null,
  titleData: SubmitTitleDataItem[]
): Promise<void> {
  if (role !== ROLES.MANAGER) return;
  const personnelIds = [...new Set(titleData.map(t => t.personnel_id).filter(Boolean))];
  if (personnelIds.length === 0) return;

  const existing = await quanNhanRepository.findManyRaw({
    where: { id: { in: personnelIds } },
    select: {
      id: true,
      co_quan_don_vi_id: true,
      don_vi_truc_thuoc_id: true,
      DonViTrucThuoc: { select: { co_quan_don_vi_id: true } },
    },
  });
  if (existing.length === 0) return;

  // CQDV manager: personnel directly under the CQDV, or under any DVTT whose parent is that CQDV.
  // DVTT manager: personnel directly under that DVTT.
  const inScope = (p: {
    co_quan_don_vi_id: string | null;
    don_vi_truc_thuoc_id: string | null;
    DonViTrucThuoc?: { co_quan_don_vi_id: string | null } | null;
  }) =>
    cqdvId
      ? p.co_quan_don_vi_id === cqdvId || p.DonViTrucThuoc?.co_quan_don_vi_id === cqdvId
      : p.don_vi_truc_thuoc_id === dvttId;

  if (existing.some(p => !inScope(p))) {
    throw new ValidationError(
      'Không thể đề xuất khen thưởng cho quân nhân ngoài đơn vị quản lý của bạn.'
    );
  }
}

async function submitProposal(
  titleData: SubmitTitleDataItem[],
  attachedFiles: SubmitAttachedFile[] | null,
  userId: string,
  type: ProposalType = PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  nam: number,
  ghiChu: string | null = null,
  thang: number | null
) {
  const user = await accountRepository.findUniqueRaw({
    where: { id: userId },
    include: {
      QuanNhan: {
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.QuanNhan) {
    throw new NotFoundError('Thông tin quân nhân của tài khoản này');
  }

  const donViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;

  // Validate before any disk write to avoid orphan files when payload is invalid.
  if (!titleData || !Array.isArray(titleData)) {
    throw new ValidationError('Dữ liệu đề xuất không hợp lệ');
  }

  const parsedYear = parseInt(String(nam), 10);
  if (Number.isNaN(parsedYear)) {
    throw new ValidationError('Năm đề xuất không hợp lệ');
  }

  // Fail fast on missing month so eligibility errors don't mask the real cause.
  const parsedMonth = thang != null ? parseInt(String(thang), 10) : null;
  const monthRequired = requiresProposalMonth(type);
  if (monthRequired && (parsedMonth == null || parsedMonth < 1 || parsedMonth > 12)) {
    throw new ValidationError('Thiếu tháng đề xuất. Loại đề xuất này bắt buộc nhập tháng (1-12).');
  }

  await assertPersonnelInScope(
    user.role,
    user.QuanNhan.co_quan_don_vi_id,
    user.QuanNhan.don_vi_truc_thuoc_id,
    titleData
  );

  const filesInfo = await persistProposalAttachments(attachedFiles);

  const strategy = getProposalStrategy(type);
  const strategyPayload = strategy
    ? await strategy.buildSubmitPayload(titleData, {
        userId,
        donViId,
        isCoQuanDonVi: !!user.QuanNhan.co_quan_don_vi_id,
        nam: parsedYear,
        thang: parsedMonth,
      })
    : null;
  if (strategyPayload && strategyPayload.errors.length > 0) {
    throw new ValidationError(strategyPayload.errors.join('\n'));
  }

  const dataDanhHieu = (strategyPayload?.payload.data_danh_hieu ?? null) as Prisma.InputJsonValue;
  const dataThanhTich = (strategyPayload?.payload.data_thanh_tich ?? null) as Prisma.InputJsonValue;
  const dataNienHan = (strategyPayload?.payload.data_nien_han ?? null) as Prisma.InputJsonValue;
  const dataCongHien = (strategyPayload?.payload.data_cong_hien ?? null) as Prisma.InputJsonValue;

  const isCoQuanDonVi = !!user.QuanNhan.co_quan_don_vi_id;
  const proposalData = {
    nguoi_de_xuat_id: userId,
    loai_de_xuat: type,
    nam: parsedYear,
    thang: monthRequired ? parsedMonth : null,
    status: PROPOSAL_STATUS.PENDING,
    data_danh_hieu: dataDanhHieu,
    data_thanh_tich: dataThanhTich,
    data_nien_han: dataNienHan,
    data_cong_hien: dataCongHien,
    files_attached: filesInfo.length > 0 ? (filesInfo as unknown as Prisma.InputJsonValue) : null,
    ghi_chu: ghiChu || null,
    ...(isCoQuanDonVi
      ? { co_quan_don_vi_id: donViId, don_vi_truc_thuoc_id: null }
      : { co_quan_don_vi_id: null, don_vi_truc_thuoc_id: donViId }),
  } as Prisma.BangDeXuatUncheckedCreateInput;

  const proposal = await proposalRepository.createRaw({
    data: proposalData,
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: {
        include: {
          CoQuanDonVi: true,
        },
      },
      NguoiDeXuat: {
        select: { id: true, username: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
    },
  });

  return {
    message: 'Đã gửi đề xuất khen thưởng thành công',
    proposal: {
      id: proposal.id,
      loai_de_xuat: proposal.loai_de_xuat,
      don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
      nguoi_de_xuat:
        proposal.NguoiDeXuat?.QuanNhan?.ho_ten ||
        proposal.NguoiDeXuat?.username ||
        PROPOSAL_SUBMITTER_DELETED_LABEL,
      status: proposal.status,
      so_personnel: titleData.length,
      createdAt: proposal.createdAt,
    },
  };
}

export { submitProposal };
