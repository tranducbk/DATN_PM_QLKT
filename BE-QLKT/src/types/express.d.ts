import type { Role } from '../constants/roles.constants';

export interface JwtUser {
  id: string;
  username: string;
  role: Role;
  quan_nhan_id?: string;
  /** Optional unit scope added by filtering middlewares. */
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
}

export interface UnitFilter {
  don_vi_id: string;
  isCoQuanDonVi: boolean;
  personnelIds?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
      unitFilter?: UnitFilter | null;
    }
  }
}
