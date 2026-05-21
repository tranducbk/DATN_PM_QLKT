package vn.qlkt.award;

import java.util.List;

public class DecisionService {
    public List<FileQuyetDinh> getList(int page, int limit, Integer nam, String loaiKhenThuong) { return null; }
    public FileQuyetDinh getById(String id) { return null; }
    public FileQuyetDinh getBySoQuyetDinh(String soQuyetDinh) { return null; }
    public FileQuyetDinh suggestNextDecisionNumber(String loaiKhenThuong, Integer nam) { return null; }
    public FileQuyetDinh create(FileQuyetDinh data, String filePath) { return null; }
    public FileQuyetDinh update(String id, FileQuyetDinh data) { return null; }
    public void cascadeRename(String oldSoQuyetDinh, String newSoQuyetDinh) {}
    public void delete(String id) {}
    public List<String> getLinkedAwards(String soQuyetDinh) { return null; }
    public String downloadFile(String id) { return null; }
}
