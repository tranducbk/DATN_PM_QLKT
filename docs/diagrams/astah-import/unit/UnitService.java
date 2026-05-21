package vn.qlkt.unit;

import java.util.List;

public class UnitService {
    public List<CoQuanDonVi> getCoQuanDonViList(int page, int limit) { return null; }
    public CoQuanDonVi getCoQuanDonViById(String id) { return null; }
    public CoQuanDonVi createCoQuanDonVi(CoQuanDonVi data) { return null; }
    public CoQuanDonVi updateCoQuanDonVi(String id, CoQuanDonVi data) { return null; }
    public void deleteCoQuanDonVi(String id) {}

    public List<DonViTrucThuoc> getDonViTrucThuocList(String coQuanDonViId) { return null; }
    public DonViTrucThuoc createDonViTrucThuoc(DonViTrucThuoc data) { return null; }
    public DonViTrucThuoc updateDonViTrucThuoc(String id, DonViTrucThuoc data) { return null; }
    public void deleteDonViTrucThuoc(String id) {}

    public void recalculateUnitCount(String unitId) {}
    public List<CoQuanDonVi> getUnitTree() { return null; }
}
