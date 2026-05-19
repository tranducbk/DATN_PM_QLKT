package vn.qlkt.proposal;

import java.util.List;

public class HcqkqtStrategy implements ProposalStrategy {
    private SingleMedalImporter singleMedalImporter;

    public LoaiDeXuat getType() { return LoaiDeXuat.HC_QKQT; }
    public void buildSubmitPayload() {}
    public List<String> validateApprove() { return null; }
    public void importInTransaction() {}
    public String buildSuccessMessage() { return null; }
}
