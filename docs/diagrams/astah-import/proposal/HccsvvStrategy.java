package vn.qlkt.proposal;

import java.util.List;

public class HccsvvStrategy implements ProposalStrategy {
    public LoaiDeXuat getType() { return LoaiDeXuat.NIEN_HAN; }
    public void buildSubmitPayload() {}
    public List<String> validateApprove() { return null; }
    public void importInTransaction() {}
    public String buildSuccessMessage() { return null; }
}
