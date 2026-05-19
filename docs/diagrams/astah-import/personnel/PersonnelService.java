package vn.qlkt.personnel;

import java.util.List;

public class PersonnelService {
    public List<QuanNhan> getPersonnel(String filters) { return null; }
    public QuanNhan getPersonnelById(String id, String userRole, String userQuanNhanId) { return null; }
    public QuanNhan createPersonnel(String data) { return null; }
    public QuanNhan updatePersonnel(String id, String data, String role) { return null; }
    public void deletePersonnel(String id, String userRole, String userQuanNhanId) {}
    public List<String> checkContributionEligibility(List<String> personnelIds) { return null; }
}
