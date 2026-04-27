import type { ProposalType } from '../../constants/proposalTypes.constants';
import type { EditedProposalData } from '../../types/proposal';

export interface SubmitProposalBody {
  so_quyet_dinh?: string;
  type?: ProposalType;
  title_data?: unknown;
  selected_personnel?: string[];
  nam?: number | string;
  thang?: number | string;
  ghi_chu?: string;
}

export interface GetProposalsQuery {
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

export interface ProposalIdParams {
  id?: string | string[];
}

export interface ApproveProposalBody {
  data_danh_hieu?: string;
  data_thanh_tich?: string;
  data_nien_han?: string;
  data_cong_hien?: string;
  so_quyet_dinh_ca_nhan_hang_nam?: string;
  so_quyet_dinh_don_vi_hang_nam?: string;
  so_quyet_dinh_nien_han?: string;
  so_quyet_dinh_cong_hien?: string;
  so_quyet_dinh_dot_xuat?: string;
  so_quyet_dinh_nckh?: string;
  ghi_chu?: string;
}

export interface ParsedApproveBody {
  editedData: EditedProposalData;
  decisions: {
    so_quyet_dinh_ca_nhan_hang_nam?: string;
    so_quyet_dinh_don_vi_hang_nam?: string;
    so_quyet_dinh_nien_han?: string;
    so_quyet_dinh_cong_hien?: string;
    so_quyet_dinh_dot_xuat?: string;
    so_quyet_dinh_nckh?: string;
  };
  pdfFiles: Record<string, Express.Multer.File | undefined>;
}

export interface GetPdfFileParams {
  filename?: string | string[];
}

export interface RejectProposalBody {
  ghi_chu?: string;
  ly_do?: string;
}

export interface AwardsFilterQuery {
  don_vi_id?: string;
  nam?: number;
  danh_hieu?: string;
  [key: string]: unknown;
}

export interface UnitYearFilterQuery {
  don_vi_id?: string;
  nam?: number;
  [key: string]: unknown;
}

export interface CheckDuplicateAwardQuery {
  personnel_id?: string;
  nam?: string | number | (string | number)[];
  danh_hieu?: string;
  proposal_type?: string;
}

export interface CheckDuplicateUnitAwardQuery {
  don_vi_id?: string;
  nam?: string | number | (string | number)[];
  danh_hieu?: string;
  proposal_type?: string;
}

export interface CheckDuplicatePersonnelBatchItem {
  personnel_id: string;
  nam: number;
  danh_hieu: string;
  proposal_type: string;
}

export interface CheckDuplicateUnitBatchItem {
  don_vi_id: string;
  nam: number;
  danh_hieu: string;
  proposal_type: string;
}

export interface CheckDuplicatePersonnelBatchBody {
  items?: CheckDuplicatePersonnelBatchItem[];
}

export interface CheckDuplicateUnitBatchBody {
  items?: CheckDuplicateUnitBatchItem[];
}

export interface NotifyContext {
  userId: string;
  userRole: string;
  resource: string;
  description: string;
}
