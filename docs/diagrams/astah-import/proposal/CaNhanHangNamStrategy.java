package vn.qlkt.proposal;

import java.util.List;

public class CaNhanHangNamStrategy implements ProposalStrategy {
    public LoaiDeXuat getType() { return LoaiDeXuat.CA_NHAN_HANG_NAM; }
    public void buildSubmitPayload() {}
    public List<String> validateApprove() { return null; }
    public void importInTransaction() {}
    public String buildSuccessMessage() { return null; }
}
