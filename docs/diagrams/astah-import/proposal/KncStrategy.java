package vn.qlkt.proposal;

import java.util.List;

public class KncStrategy implements ProposalStrategy {
    private SingleMedalImporter singleMedalImporter;

    public LoaiDeXuat getType() { return LoaiDeXuat.KNC_VSNXD_QDNDVN; }
    public void buildSubmitPayload() {}
    public List<String> validateApprove() { return null; }
    public void importInTransaction() {}
    public String buildSuccessMessage() { return null; }
}
