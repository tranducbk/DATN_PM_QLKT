import { Router } from 'express';
import proposalController from '../controllers/proposal.controller';
import {
  verifyToken,
  requireAdminOnly,
  requireAdminOrManager,
} from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { writeLimiter } from '../configs/rateLimiter';
import { documentUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';

const router = Router();

/**
 * @route   POST /api/proposals
 * @desc    Submit an award proposal with attached files
 * @access  MANAGER, ADMIN
 */
router.post(
  '/',
  verifyToken,
  requireAdminOrManager,
  writeLimiter,
  upload.fields([
    { name: 'attached_files' }, // No file count limit
  ]),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: RESOURCE_SLUGS.PROPOSALS,
    getDescription: getLogDescription(RESOURCE_SLUGS.PROPOSALS, 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  proposalController.submitProposal
);

/**
 * @route   GET /api/proposals/check-duplicate
 * @desc    Check if a personnel already has a proposal for the same year and award type
 * @access  MANAGER, ADMIN
 */
router.get(
  '/check-duplicate',
  verifyToken,
  requireAdminOrManager,
  proposalController.checkDuplicateAward
);

/**
 * @route   GET /api/proposals/check-duplicate-unit
 * @desc    Check if a unit already has a proposal for the same year and award type
 * @access  MANAGER, ADMIN
 */
router.get(
  '/check-duplicate-unit',
  verifyToken,
  requireAdminOrManager,
  proposalController.checkDuplicateUnitAward
);

/**
 * @route   POST /api/proposals/check-duplicate-batch
 * @desc    Batch-check duplicate proposals for personnel (used in Excel import)
 * @access  MANAGER, ADMIN
 */
router.post(
  '/check-duplicate-batch',
  verifyToken,
  requireAdminOrManager,
  proposalController.checkDuplicateBatch
);

/**
 * @route   POST /api/proposals/check-duplicate-unit-batch
 * @desc    Batch-check duplicate proposals for units (used in Excel import)
 * @access  MANAGER, ADMIN
 */
router.post(
  '/check-duplicate-unit-batch',
  verifyToken,
  requireAdminOrManager,
  proposalController.checkDuplicateUnitBatch
);

/**
 * @route   GET /api/proposals
 * @desc    List proposals
 * @access  MANAGER, ADMIN
 */
router.get(
  '/',
  verifyToken,
  requireAdminOrManager,
  proposalController.getProposals
);

/**
 * @route   GET /api/proposals/:id
 * @desc    Get proposal details by ID
 * @access  MANAGER, ADMIN
 */
router.get(
  '/:id',
  verifyToken,
  requireAdminOrManager,
  proposalController.getProposalById
);

/**
 * @route   POST /api/proposals/:id/approve
 * @desc    Approve a proposal and import award data to DB
 * @access  ADMIN
 */
router.post(
  '/:id/approve',
  verifyToken,
  requireAdminOnly,
  writeLimiter,
  upload.fields([
    { name: 'file_pdf_ca_nhan_hang_nam', maxCount: 1 }, // CA_NHAN_HANG_NAM
    { name: 'file_pdf_don_vi_hang_nam', maxCount: 1 }, // DON_VI_HANG_NAM
    { name: 'file_pdf_nien_han', maxCount: 1 }, // NIEN_HAN
    { name: 'file_pdf_cong_hien', maxCount: 1 }, // CONG_HIEN
    { name: 'file_pdf_dot_xuat', maxCount: 1 }, // DOT_XUAT
    { name: 'file_pdf_nckh', maxCount: 1 }, // NCKH
    { name: 'admin_attached_files' }, // Admin attachments — optional, no count limit
  ]),
  auditLog({
    action: AUDIT_ACTIONS.APPROVE,
    resource: RESOURCE_SLUGS.PROPOSALS,
    getDescription: getLogDescription(RESOURCE_SLUGS.PROPOSALS, 'APPROVE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  proposalController.approveProposal
);

/**
 * @route   POST /api/proposals/:id/reject
 * @desc    Reject a proposal with a reason
 * @access  ADMIN
 */
router.post(
  '/:id/reject',
  verifyToken,
  requireAdminOnly,
  auditLog({
    action: AUDIT_ACTIONS.REJECT,
    resource: RESOURCE_SLUGS.PROPOSALS,
    getDescription: getLogDescription(RESOURCE_SLUGS.PROPOSALS, 'REJECT'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  proposalController.rejectProposal
);

/**
 * @route   GET /api/proposals/uploads/:filename
 * @desc    Serve an uploaded PDF file
 * @access  MANAGER, ADMIN
 */
router.get(
  '/uploads/:filename',
  verifyToken,
  requireAdminOrManager,
  proposalController.getPdfFile
);

/**
 * @route   DELETE /api/proposals/:id
 * @desc    Delete a proposal (Manager can only delete own PENDING proposals)
 * @access  MANAGER, ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdminOrManager,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: RESOURCE_SLUGS.PROPOSALS,
    getDescription: getLogDescription(RESOURCE_SLUGS.PROPOSALS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  proposalController.deleteProposal
);

export default router;
