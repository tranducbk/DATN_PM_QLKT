package c3_2_dexuat;

import java.util.Date;

enum LoaiDeXuat {
    CA_NHAN_HANG_NAM, DON_VI_HANG_NAM, NIEN_HAN, CONG_HIEN,
    HC_QKQT, KNC_VSNXD_QDNDVN, NCKH, DOT_XUAT
}

enum TrangThaiDeXuat {
    PENDING, APPROVED, REJECTED
}

class BangDeXuat {
    private String id;
    private String co_quan_don_vi_id;
    private String don_vi_truc_thuoc_id;
    private String nguoi_de_xuat_id;
    private Integer nam;
    private Integer thang;
    private String data_danh_hieu;
    private String data_thanh_tich;
    private String data_nien_han;
    private String data_cong_hien;
    private String files_attached;
    private String files_attached_admin;
    private String ghi_chu;
    private String rejection_reason;
    private String nguoi_duyet_id;
    private Date ngay_duyet;
    private LoaiDeXuat loai_de_xuat;
    private TrangThaiDeXuat status;
}

interface ProposalStrategy {
    LoaiDeXuat type;
    Object buildSubmitPayload(Object[] titleData, Object ctx);
    void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx);
}

class CaNhanHangNamStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
}

class DonViHangNamStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
}

class HccsvvStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
}

class HcbvtqStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
}

class HcqkqtStrategy implements ProposalStrategy {
    private SingleMedalImporter singleMedalImporter;
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
}

class KncStrategy implements ProposalStrategy {
    private SingleMedalImporter singleMedalImporter;
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
}

class NckhStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
}

class SingleMedalImporter {
    public void importSingleMedal(Object ctx, Object config) { }
}

class ProposalStrategyRegistry {
    public ProposalStrategy getProposalStrategy(LoaiDeXuat type) { return null; }
}

class ProposalRepository {
    public BangDeXuat findById(String id) { return null; }
    public Object groupByLoaiDeXuat(Object where) { return null; }
    public Object groupByStatus(Object where) { return null; }
    public int count(Object where) { return 0; }
    public BangDeXuat create(Object data) { return null; }
    public BangDeXuat update(String id, Object data) { return null; }
    public void updateMany(Object where, Object data) { }
    public void deleteMany(Object where) { }
    public void delete(String id) { }
}

class ProposalService {
    private ProposalStrategyRegistry registry;
    private ProposalRepository proposalRepository;
    public BangDeXuat submitProposal(Object payload, Object ctx) { return null; }
    public BangDeXuat[] getProposals(Object filter, String role, Object scope) { return null; }
    public BangDeXuat getProposalById(String id) { return null; }
    public BangDeXuat approveProposal(String id, Object editedData, String adminId, Object decisions, Object pdf) { return null; }
    public BangDeXuat rejectProposal(String id, String reason, String adminId) { return null; }
    public void deleteProposal(String id, String userId, String role) { }
    public Object getPdfFile(String id, String loai) { return null; }
    public Object getAllAwards(Object filter) { return null; }
    public Object exportAllAwardsExcel(Object filter) { return null; }
    public Object getAwardsStatistics(Object filter) { return null; }
    public Object getUserWithUnit(String userId) { return null; }
    public Object checkDuplicateAward(Object ctx) { return null; }
    public Object checkDuplicateUnitAward(Object ctx) { return null; }
    public Object checkDuplicateBatch(Object ctx) { return null; }
    public Object checkDuplicateUnitBatch(Object ctx) { return null; }
}

class ProposalController {
    private ProposalService proposalService;
    public void submitProposal() { }
    public void getProposals() { }
    public void getProposalById() { }
    public void approveProposal() { }
    public void getPdfFile() { }
    public void rejectProposal() { }
    public void getAllAwards() { }
    public void exportAllAwardsExcel() { }
    public void deleteProposal() { }
    public void getAwardsStatistics() { }
    public void checkDuplicateAward() { }
    public void checkDuplicateUnitAward() { }
    public void checkDuplicateBatch() { }
    public void checkDuplicateUnitBatch() { }
}
