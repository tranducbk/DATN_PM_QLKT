import type { FormattedAccount } from './types';

type AccountWithQuanNhan = {
  id: string;
  username: string;
  role: string;
  quan_nhan_id: string | null;
  QuanNhan?: {
    ho_ten?: string | null;
    DonViTrucThuoc?: { ten_don_vi?: string | null } | null;
    CoQuanDonVi?: { ten_don_vi?: string | null } | null;
    ChucVu?: { ten_chuc_vu?: string | null } | null;
  } | null;
};

/** Maps an account record (with QuanNhan relations) to the API response shape. */
export function formatAccount(account: AccountWithQuanNhan): FormattedAccount {
  return {
    id: account.id,
    username: account.username,
    role: account.role,
    quan_nhan_id: account.quan_nhan_id,
    ho_ten: account.QuanNhan?.ho_ten || null,
    don_vi: (account.QuanNhan?.DonViTrucThuoc || account.QuanNhan?.CoQuanDonVi)?.ten_don_vi || null,
    chuc_vu: account.QuanNhan?.ChucVu?.ten_chuc_vu || null,
  };
}
