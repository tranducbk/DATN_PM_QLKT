package vn.qlkt.award;

import java.util.List;

public class AwardBulkService {
    public void bulkCreateAwards(String type, int nam, List<String> selectedPersonnel) {}
    public List<String> checkDuplicateAwards(String type, int nam, String titleData) { return null; }
    public List<String> checkDuplicateUnitAwards(int nam, String titleData) { return null; }
    public List<String> validatePersonnelConditions(String type, List<String> selectedPersonnel) { return null; }
}
