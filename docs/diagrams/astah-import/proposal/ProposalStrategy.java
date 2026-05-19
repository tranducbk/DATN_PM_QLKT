package vn.qlkt.proposal;

import java.util.List;

public interface ProposalStrategy {
    LoaiDeXuat getType();
    void buildSubmitPayload();
    List<String> validateApprove();
    void importInTransaction();
    String buildSuccessMessage();
}
