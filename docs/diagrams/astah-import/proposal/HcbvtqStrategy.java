package vn.qlkt.proposal;

import java.util.List;

public class HcbvtqStrategy implements ProposalStrategy {
    public LoaiDeXuat getType() { return LoaiDeXuat.CONG_HIEN; }
    public void buildSubmitPayload() {}
    public List<String> validateApprove() { return null; }
    public void importInTransaction() {}
    public String buildSuccessMessage() { return null; }
}
