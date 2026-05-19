package vn.qlkt.award;

import java.util.List;

public class AnnualRewardService {
    public List<DanhHieuHangNam> getAnnualRewardsList(int page, int limit) { return null; }
    public DanhHieuHangNam createAnnualReward(String data) { return null; }
    public DanhHieuHangNam updateAnnualReward(String id, String data) { return null; }
    public void deleteAnnualReward(String id, String adminUsername) {}
    public List<String> checkAnnualRewards(List<String> personnelIds, int nam, String danhHieu) { return null; }
    public void bulkCreateAnnualRewards(String data) {}
    public void getStatistics() {}
    public void exportToExcel() {}
    public void exportTemplate(List<String> personnelIds) {}
    public void previewImport(String buffer) {}
    public void confirmImport(List<String> validItems) {}
}
