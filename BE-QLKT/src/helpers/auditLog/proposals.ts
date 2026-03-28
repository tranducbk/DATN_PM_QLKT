import { prisma } from '../../models';
import { Request, Response } from 'express';
import { normalizeParam } from '../paginationHelper';
import { FALLBACK } from './constants';
import { getLoaiDeXuatName } from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';

/** Loose shape for proposal data from JSON or Prisma */
interface ParsedProposal {
  loai_de_xuat?: string;
  type?: string;
  nam?: string | number;
  NguoiDeXuat?: {
    QuanNhan?: { ho_ten?: string };
    username?: string;
  } | null;
  data_danh_hieu?: unknown;
  data_thanh_tich?: unknown;
  data_nien_han?: unknown;
  data_cong_hien?: unknown;
  [key: string]: unknown;
}

const proposals: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> = {
  CREATE: (req: Request, res: Response, responseData: unknown): string => {
    const proposalType = req.body?.loai_de_xuat || req.body?.type || '';
    const typeName = getLoaiDeXuatName(proposalType);

    let soLuong = 0;
    let nam = '';
    let donVi = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const proposal = data?.data?.proposal || data?.proposal || data?.data || data;

      if (proposal) {
        soLuong =
          proposal.so_personnel ||
          (Array.isArray(proposal.data_danh_hieu) ? proposal.data_danh_hieu.length : 0) ||
          (Array.isArray(proposal.data_nien_han) ? proposal.data_nien_han.length : 0) ||
          (Array.isArray(proposal.data_cong_hien) ? proposal.data_cong_hien.length : 0) ||
          (Array.isArray(proposal.data_thanh_tich) ? proposal.data_thanh_tich.length : 0) ||
          0;
        nam = proposal.nam || req.body?.nam || '';
        donVi = proposal.don_vi || '';
      }
    } catch (e) {
      // Ignore parse error
    }

    if (soLuong === 0) {
      const titleData = req.body?.title_data;
      if (titleData) {
        try {
          const parsed = typeof titleData === 'string' ? JSON.parse(titleData) : titleData;
          soLuong = Array.isArray(parsed) ? parsed.length : 0;
        } catch (e) {
          // Ignore parse error
        }
      }
      nam = req.body?.nam || '';
    }

    let description = `Tạo đề xuất khen thưởng: ${typeName}`;

    if (soLuong > 0) {
      const unitText = proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'đơn vị' : 'quân nhân';
      description += ` (${soLuong} ${unitText}`;
      if (nam) {
        description += `, năm ${nam}`;
      }
      description += ')';
    } else if (nam) {
      description += ` (năm ${nam})`;
    }

    if (donVi) {
      description += ` - ${donVi}`;
    }

    return description;
  },
  APPROVE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const proposalId = normalizeParam(req.params?.id) ?? 'Chưa có dữ liệu';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const result = data?.data?.result || data?.result || {};

      let proposal = data?.data?.proposal || data?.proposal;

      if (!proposal && proposalId && proposalId !== 'Chưa có dữ liệu') {
        try {
          proposal = await prisma.bangDeXuat.findUnique({
            where: { id: proposalId },
            include: {
              NguoiDeXuat: {
                include: {
                  QuanNhan: true,
                },
              },
              DonViTrucThuoc: true,
              CoQuanDonVi: true,
            },
          });
        } catch (dbError) {
          console.error('[AuditLog] Failed to fetch proposal for approval log:', dbError);
        }
      }

      if (!proposal) {
        proposal = data?.data || data;
      }

      if (
        proposal &&
        (proposal.loai_de_xuat || proposal.type || proposalId !== 'Chưa có dữ liệu')
      ) {
        const loaiDeXuat = proposal.loai_de_xuat || proposal.type;
        const typeName = getLoaiDeXuatName(loaiDeXuat);

        const nam = proposal.nam || result.nam || '';

        let nguoiDeXuat = 'Chưa có dữ liệu';
        if (proposal.NguoiDeXuat) {
          nguoiDeXuat =
            proposal.NguoiDeXuat.QuanNhan?.ho_ten ||
            proposal.NguoiDeXuat.username ||
            'Chưa có dữ liệu';
        } else if (result.nguoi_de_xuat) {
          nguoiDeXuat = result.nguoi_de_xuat;
        }

        let soLuong = 0;
        let donViText = '';

        if (loaiDeXuat === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
          soLuong = result.total_danh_hieu || 0;
          donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
        } else if (loaiDeXuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          const editedData = req.body?.data_danh_hieu
            ? typeof req.body.data_danh_hieu === 'string'
              ? JSON.parse(req.body.data_danh_hieu)
              : req.body.data_danh_hieu
            : [];
          const uniqueUnits = new Set<string>();
          if (Array.isArray(editedData)) {
            editedData.forEach((item: Record<string, unknown>) => {
              if (item.don_vi_id) {
                uniqueUnits.add(item.don_vi_id as string);
              }
            });
          }
          soLuong = uniqueUnits.size || result.total_danh_hieu || 0;
          donViText = soLuong > 0 ? `${soLuong} đơn vị` : '';
        } else if (loaiDeXuat === PROPOSAL_TYPES.NCKH) {
          soLuong = result.total_thanh_tich || 0;
          donViText = soLuong > 0 ? `${soLuong} đề tài` : '';
        } else if (loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN) {
          soLuong = result.total_nien_han || 0;
          donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
        } else if (loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN) {
          const editedData = req.body?.data_cong_hien
            ? typeof req.body.data_cong_hien === 'string'
              ? JSON.parse(req.body.data_cong_hien)
              : req.body.data_cong_hien
            : [];
          soLuong = Array.isArray(editedData) ? editedData.length : 0;
          donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
        } else if (
          loaiDeXuat === PROPOSAL_TYPES.HC_QKQT ||
          loaiDeXuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
        ) {
          const editedData = req.body?.data_danh_hieu
            ? typeof req.body.data_danh_hieu === 'string'
              ? JSON.parse(req.body.data_danh_hieu)
              : req.body.data_danh_hieu
            : [];
          soLuong = Array.isArray(editedData) ? editedData.length : 0;
          donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
        }

        let description = `Phê duyệt đề xuất ${typeName}`;

        if (nam) {
          description += ` năm ${nam}`;
        }

        if (nguoiDeXuat && nguoiDeXuat !== 'Chưa có dữ liệu') {
          description += ` do ${nguoiDeXuat} đề xuất`;
        }

        if (donViText) {
          description += ` (${donViText})`;
        }

        return description;
      }
    } catch (e) {
      console.error('[AuditLog] Failed to build approval description:', e);
    }
    return `Phê duyệt đề xuất: ${proposalId}`;
  },
  REJECT: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const proposalId = normalizeParam(req.params?.id);
    const reason = req.body?.ghi_chu || req.body?.ly_do_tu_choi || req.body?.ly_do || '';

    let proposal: ParsedProposal | null = null;
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      proposal = data?.data?.proposal || data?.proposal || data?.data;
    } catch (e) {
      // Ignore parse error
    }

    if (!proposal && proposalId) {
      try {
        proposal = await prisma.bangDeXuat.findUnique({
          where: { id: proposalId },
          include: {
            NguoiDeXuat: {
              include: { QuanNhan: true },
            },
          },
        });
      } catch (error) {
        console.error('[AuditLog] Failed to fetch proposal for rejection log:', error);
      }
    }

    if (proposal) {
      const loaiDeXuat = proposal.loai_de_xuat || '';
      const typeName = getLoaiDeXuatName(loaiDeXuat);

      const nguoiDeXuat =
        proposal.NguoiDeXuat?.QuanNhan?.ho_ten ||
        proposal.NguoiDeXuat?.username ||
        FALLBACK.UNKNOWN;
      const nam = proposal.nam || FALLBACK.UNKNOWN;

      let soLuong = 0;
      let loaiSoLuong = '';

      const parseJsonArray = (value: unknown): unknown[] => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        }
        return [];
      };

      if (loaiDeXuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        soLuong = parseJsonArray(proposal.data_danh_hieu).length;
        loaiSoLuong = 'đơn vị';
      } else if (loaiDeXuat === PROPOSAL_TYPES.NCKH) {
        soLuong = parseJsonArray(proposal.data_thanh_tich).length;
        loaiSoLuong = 'đề tài';
      } else if (loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN) {
        soLuong = parseJsonArray(proposal.data_cong_hien).length;
        loaiSoLuong = 'đồng chí';
      } else if (
        loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN ||
        loaiDeXuat === PROPOSAL_TYPES.HC_QKQT ||
        loaiDeXuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
      ) {
        soLuong = parseJsonArray(proposal.data_nien_han).length;
        loaiSoLuong = 'đồng chí';
      } else {
        soLuong = parseJsonArray(proposal.data_danh_hieu).length;
        loaiSoLuong = 'đồng chí';
      }

      const soLuongText = soLuong > 0 ? `gồm ${soLuong} ${loaiSoLuong}` : '';
      const reasonText = reason ? ` - Lý do: ${reason}` : '';

      return `Từ chối đề xuất ${typeName} (năm ${nam}) do ${nguoiDeXuat} đề xuất ${soLuongText}${reasonText}`;
    }

    return `Từ chối đề xuất (không xác định được thông tin)${reason ? ` - Lý do: ${reason}` : ''}`;
  },
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const proposalId = normalizeParam(req.params?.id);

    let proposal: ParsedProposal | null = null;
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      proposal = data?.data?.proposal || data?.proposal || data?.data;
    } catch (e) {
      // Ignore parse error
    }

    if (!proposal && proposalId) {
      try {
        proposal = await prisma.bangDeXuat.findUnique({
          where: { id: proposalId },
          include: {
            NguoiDeXuat: {
              include: { QuanNhan: true },
            },
          },
        });
      } catch (error) {
        console.error('[AuditLog] Failed to fetch proposal for deletion log:', error);
      }
    }

    if (proposal) {
      const typeName = getLoaiDeXuatName(proposal.loai_de_xuat || '');
      const nguoiDeXuat =
        proposal.NguoiDeXuat?.QuanNhan?.ho_ten ||
        proposal.NguoiDeXuat?.username ||
        FALLBACK.UNKNOWN;
      const nam = proposal.nam || FALLBACK.UNKNOWN;

      return `Xóa đề xuất ${typeName} (năm ${nam}) do ${nguoiDeXuat} đề xuất`;
    }

    return `Xóa đề xuất (không xác định được thông tin)`;
  },
};

export { proposals };
