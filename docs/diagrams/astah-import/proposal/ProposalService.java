package vn.qlkt.proposal;

import java.util.List;

public class ProposalService {
    public BangDeXuat submitProposal(String titleData, String userId, String type, int nam) { return null; }
    public List<BangDeXuat> getProposals(String userId, String role, int page, int limit) { return null; }
    public BangDeXuat getProposalById(String id, String userId, String role) { return null; }
    public BangDeXuat approveProposal(String id, String editedData, String adminId) { return null; }
    public BangDeXuat rejectProposal(String id, String reason, String adminId) { return null; }
    public void deleteProposal(String id, String userId, String role) {}
    public ProposalStrategy dispatchStrategy(LoaiDeXuat type) { return null; }
}
