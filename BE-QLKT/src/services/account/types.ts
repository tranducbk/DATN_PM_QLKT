export interface CreateAccountData {
  personnel_id?: string | null;
  username: string;
  password: string;
  role: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
}

export interface UpdateAccountData {
  role?: string;
  password?: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
}

export interface FormattedAccount {
  id: string;
  username: string;
  role: string;
  quan_nhan_id: string | null;
  ho_ten: string | null;
  don_vi: string | null;
  cap_bac?: string | null;
  chuc_vu: string | null;
  createdAt?: Date;
}

export interface PaginatedAccounts {
  accounts: FormattedAccount[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
