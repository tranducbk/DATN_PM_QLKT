import {
  PROPOSAL_TYPES,
  requiresProposalMonth,
  type ProposalType,
} from '../../constants/proposalTypes.constants';
import { prisma } from '../../models';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { sanitizeFilename } from './helpers';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import type { Prisma } from '../../generated/prisma';
import { getProposalStrategy } from './strategies';

/**
 * Creates a reward proposal with optional attachments.
 * @param titleData - Proposal title/achievement payload from the frontend
 * @param attachedFiles - Uploaded attachment files (if any)
 * @param soQuyetDinh - Original decision number
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

async function submitProposal(
  titleData: SubmitTitleDataItem[],
  attachedFiles: SubmitAttachedFile[] | null,
  soQuyetDinh: string | null,
  userId: string,
  type: ProposalType = PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  nam: number,
  ghiChu: string | null = null,
  thang: number | null
) {
  const user = await prisma.taiKhoan.findUnique({
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

  // Fail fast on missing month so eligibility errors don't mask the real cause.
  const parsedMonth = thang != null ? parseInt(String(thang), 10) : null;
  const monthRequired = requiresProposalMonth(type);
  if (monthRequired && (parsedMonth == null || parsedMonth < 1 || parsedMonth > 12)) {
    throw new ValidationError('Thiếu tháng đề xuất. Loại đề xuất này bắt buộc nhập tháng (1-12).');
  }

  const filesInfo: {
    filename: string;
    originalName: string;
    size: number;
    uploadedAt: string;
  }[] = [];

  if (attachedFiles && attachedFiles.length > 0) {
    const storagePath = path.join(__dirname, '..', '..', '..', 'storage', 'proposals');
    await fs.mkdir(storagePath, { recursive: true });

    for (const file of attachedFiles) {
      if (file && file.buffer) {
        let originalName = file.originalname || 'file';
        try {
          if (Buffer.isBuffer(originalName)) {
            originalName = originalName.toString('utf8');
          } else if (typeof originalName === 'string') {
            originalName = Buffer.from(originalName, 'latin1').toString('utf8');
          }
        } catch {
          originalName = 'file';
        }

        const sanitizedOriginalName = sanitizeFilename(originalName);

        // Use timestamp + short uuid to avoid filename collisions.
        const timestamp = Date.now();
        const uniqueId = uuidv4().slice(0, 8);
        const fileExtension = path.extname(sanitizedOriginalName);
        const baseFilename = path.basename(sanitizedOriginalName, fileExtension);
        const savedFilename = `${timestamp}_${uniqueId}_${baseFilename}${fileExtension}`;

        const filePath = path.join(storagePath, savedFilename);
        await fs.writeFile(filePath, file.buffer);

        // Keep original name for UI display.
        filesInfo.push({
          filename: savedFilename,
          originalName: originalName,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }
    }
  }

  const strategy = getProposalStrategy(type);
  const strategyPayload = strategy
    ? await strategy.buildSubmitPayload(titleData, {
        userId,
        donViId,
        isCoQuanDonVi: !!user.QuanNhan.co_quan_don_vi_id,
        nam,
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
    nam: parseInt(String(nam), 10) || new Date().getFullYear(),
    thang: monthRequired ? parsedMonth : null,
    status: PROPOSAL_STATUS.PENDING,
    data_danh_hieu: dataDanhHieu,
    data_thanh_tich: dataThanhTich,
    data_nien_han: dataNienHan,
    data_cong_hien: dataCongHien,
    files_attached: filesInfo.length > 0 ? (filesInfo as Prisma.InputJsonValue) : null,
    ghi_chu: ghiChu || null,
    ...(isCoQuanDonVi
      ? { co_quan_don_vi_id: donViId, don_vi_truc_thuoc_id: null }
      : { co_quan_don_vi_id: null, don_vi_truc_thuoc_id: donViId }),
  } as Prisma.BangDeXuatUncheckedCreateInput;

  const proposal = await prisma.bangDeXuat.create({
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
      nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
      status: proposal.status,
      so_personnel: titleData.length,
      createdAt: proposal.createdAt,
    },
  };
}

export { submitProposal };
