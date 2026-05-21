package vn.qlkt.profile;

import java.util.List;

public class ProfileService {
    public HoSoHangNam getAnnualProfile(String personnelId) { return null; }
    public HoSoNienHan getTenureProfile(String personnelId) { return null; }
    public HoSoCongHien getContributionProfile(String personnelId) { return null; }
    public HoSoDonViHangNam getUnitAnnualProfile(String unitId, Integer year) { return null; }

    public HoSoHangNam recalculateAnnualProfile(String personnelId) { return null; }
    public HoSoNienHan recalculateTenureProfile(String personnelId) { return null; }
    public HoSoCongHien recalculateContributionProfile(String personnelId) { return null; }
    public HoSoDonViHangNam recalculateUnitAnnualProfile(String unitId, Integer year) { return null; }

    public void recalculateAll() {}
    public List<String> recalculateByPersonnelIds(List<String> personnelIds) { return null; }
}
