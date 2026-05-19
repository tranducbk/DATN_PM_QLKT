package vn.qlkt.proposal;

import java.util.List;

public class NckhStrategy implements ProposalStrategy {
    public LoaiDeXuat getType() { return LoaiDeXuat.NCKH; }
    public void buildSubmitPayload() {}
    public List<String> validateApprove() { return null; }
    public void importInTransaction() {}
    public String buildSuccessMessage() { return null; }
}
