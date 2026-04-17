import { Router } from 'express';
import decisionController from '../controllers/decision.controller';
import { verifyToken, requireAdmin } from '../middlewares/auth';
import { auditLog, createDescription, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { validate } from '../middlewares/validate';
import { decisionValidation } from '../validations';
import { decisionUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/decisions
 * @desc    List all award decisions (supports ?nam, ?loai_khen_thuong, ?search, pagination)
 * @access  Private - ADMIN and above
 */
router.get('/', verifyToken, requireAdmin, decisionController.getAllDecisions);

/**
 * @route   GET /api/decisions/autocomplete
 * @desc    Autocomplete search for decisions (?q, ?limit)
 * @access  Private - ADMIN and above
 */
router.get('/autocomplete', verifyToken, requireAdmin, decisionController.autocomplete);

/**
 * @route   GET /api/decisions/years
 * @desc    List years that have decisions
 * @access  Private - ADMIN and above
 */
router.get('/years', verifyToken, requireAdmin, decisionController.getAvailableYears);

/**
 * @route   GET /api/decisions/award-types
 * @desc    List available award types
 * @access  Private - ADMIN and above
 */
router.get('/award-types', verifyToken, requireAdmin, decisionController.getAwardTypes);

/**
 * @route   GET /api/decisions/file-path/:soQuyetDinh
 * @desc    Get file path by decision number (URI-encode numbers with special characters)
 * @access  Private - All authenticated users
 */
router.get('/file-path/:soQuyetDinh', verifyToken, decisionController.getFilePath);

/**
 * @route   GET /api/decisions/download/:soQuyetDinh
 * @desc    Download decision file by decision number
 * @access  Private - All authenticated users
 */
router.get('/download/:soQuyetDinh', verifyToken, decisionController.downloadDecisionFile);

/**
 * @route   POST /api/decisions/file-paths
 * @desc    Get file paths for multiple decision numbers
 * @access  Private - All authenticated users
 * @body    { soQuyetDinhs: ['SQD001', 'SQD002', ...] }
 */
router.post('/file-paths', verifyToken, decisionController.getFilePaths);

/**
 * @route   GET /api/decisions/by-number/:soQuyetDinh
 * @desc    Get decision by decision number
 * @access  Private - ADMIN and above
 */
router.get(
  '/by-number/:soQuyetDinh',
  verifyToken,
  requireAdmin,
  decisionController.getDecisionBySoQuyetDinh
);

/**
 * @route   GET /api/decisions/:id
 * @desc    Get decision details by ID
 * @access  Private - ADMIN and above
 */
router.get('/:id', verifyToken, requireAdmin, decisionController.getDecisionById);

/**
 * @route   POST /api/decisions
 * @desc    Create a new decision
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  decisionController.createDecision
);

/**
 * @route   PUT /api/decisions/:id
 * @desc    Update a decision
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  decisionController.updateDecision
);

/**
 * @route   DELETE /api/decisions/:id
 * @desc    Delete a decision
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  decisionController.deleteDecision
);

export default router;
