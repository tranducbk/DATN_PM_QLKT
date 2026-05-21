package vn.qlkt.award;

import java.util.List;

public class UnitAnnualAwardService {
    public List<DanhHieuDonViHangNam> getList(int page, int limit) { return null; }
    public DanhHieuDonViHangNam getById(String id) { return null; }
    public List<DanhHieuDonViHangNam> getByUnitId(String unitId) { return null; }
    public DanhHieuDonViHangNam create(DanhHieuDonViHangNam data) { return null; }
    public DanhHieuDonViHangNam update(String id, DanhHieuDonViHangNam data) { return null; }
    public void delete(String id) {}
    public void approve(String id, String adminId) {}
    public void reject(String id, String reason, String adminId) {}
    public void previewImport(String buffer) {}
    public void confirmImport(List<DanhHieuDonViHangNam> validItems) {}
    public void exportExcel() {}
    public void exportTemplate(List<String> unitIds) {}
}
