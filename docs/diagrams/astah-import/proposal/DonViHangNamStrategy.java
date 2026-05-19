package vn.qlkt.proposal;

import java.util.List;

public class DonViHangNamStrategy implements ProposalStrategy {
    public LoaiDeXuat getType() { return LoaiDeXuat.DON_VI_HANG_NAM; }
    public void buildSubmitPayload() {}
    public List<String> validateApprove() { return null; }
    public void importInTransaction() {}
    public String buildSuccessMessage() { return null; }
}
