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
    LoaiDeXuat type = null;
    Object buildSubmitPayload(Object[] titleData, Object ctx);
    String[] validateApprove(Object editedData, Object ctx);
    void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx);
    String buildSuccessMessage(Object acc);
}

class CaNhanHangNamStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public String[] validateApprove(Object editedData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
    public String buildSuccessMessage(Object acc) { return null; }
}

class DonViHangNamStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public String[] validateApprove(Object editedData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
    public String buildSuccessMessage(Object acc) { return null; }
}

class HccsvvStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public String[] validateApprove(Object editedData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
    public String buildSuccessMessage(Object acc) { return null; }
}

class HcbvtqStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public String[] validateApprove(Object editedData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
    public String buildSuccessMessage(Object acc) { return null; }
}

class HcqkqtStrategy implements ProposalStrategy {
    private SingleMedalImporter singleMedalImporter;
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public String[] validateApprove(Object editedData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
    public String buildSuccessMessage(Object acc) { return null; }
}

class KncStrategy implements ProposalStrategy {
    private SingleMedalImporter singleMedalImporter;
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public String[] validateApprove(Object editedData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
    public String buildSuccessMessage(Object acc) { return null; }
}

class NckhStrategy implements ProposalStrategy {
    public Object buildSubmitPayload(Object[] titleData, Object ctx) { return null; }
    public String[] validateApprove(Object editedData, Object ctx) { return null; }
    public void importInTransaction(Object editedData, Object ctx, Object decisions, Object pdf, Object acc, Object tx) { }
    public String buildSuccessMessage(Object acc) { return null; }
}

class SingleMedalImporter {
    public void importSingleMedal(Object ctx, Object config) { }
}

class ProposalStrategyRegistry {
    public ProposalStrategy getProposalStrategy(LoaiDeXuat type) { return null; }
}

class ProposalRepository {
    private BangDeXuat bangDeXuat;
    public BangDeXuat findById(String id) { return null; }
    public BangDeXuat count(Object filter) { return null; }
    public BangDeXuat groupByStatus() { return null; }
    public BangDeXuat create(Object data) { return null; }
    public BangDeXuat update(String id, Object data) { return null; }
    public void deleteMany(Object filter) { }
    public void delete(String id) { }
}

class ProposalService {
    private ProposalStrategyRegistry registry;
    private ProposalRepository proposalRepository;
    public BangDeXuat submitProposal(Object payload, Object ctx) { return null; }
    public BangDeXuat getProposals(Object filter, String role, Object scope) { return null; }
    public BangDeXuat getProposalById(String id) { return null; }
    public BangDeXuat approveProposal(String id, Object editedData, String adminId, Object decisions, Object pdf) { return null; }
    public BangDeXuat rejectProposal(String id, String reason, String adminId) { return null; }
    public void deleteProposal(String id, String userId, String role) { }
    public Object checkDuplicateAward(Object ctx) { return null; }
}

class ProposalController {
    private ProposalService proposalService;
    public void submitProposal() { }
    public void getProposals() { }
    public void getProposalById() { }
    public void approveProposal() { }
    public void rejectProposal() { }
    public void deleteProposal() { }
    public void checkDuplicateAward() { }
    public void getAllAwards() { }
}
