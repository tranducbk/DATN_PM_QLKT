package vn.qlkt.account;

import java.util.List;

public class AccountService {
    public List<TaiKhoan> getAccounts(int page, int limit, String search, String role, boolean excludeSuperAdmin) { return null; }
    public TaiKhoan getAccountById(String id) { return null; }
    public TaiKhoan createAccount(String data) { return null; }
    public TaiKhoan updateAccount(String id, String data) { return null; }
    public String resetPassword(String accountId) { return null; }
    public void deleteAccount(String id, boolean forceDelete) {}
}
