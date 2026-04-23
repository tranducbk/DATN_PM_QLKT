import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import annualRewardController from '../controllers/annualReward.controller';
import {
  verifyToken,
  requireManager,
  requireAuth,
  requireAdmin,
  checkRole,
} from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import {
  excelUpload as upload,
  pdfDecisionUpload as pdfUpload,
  decisionUploadDir as uploadDir,
} from '../configs/multer';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';
import { annualRewardValidation } from '../validations';
import { normalizeParam } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/annual-rewards
 * @desc    List annual reward titles with filters and pagination
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  requireManager,
  validate(annualRewardValidation.getAnnualRewardsQuery, 'query'),
  annualRewardController.getAnnualRewards
);

/**
 * @route   GET /api/annual-rewards/check-hcqkqt/:personnelId
 * @desc    Check if a personnel has already received HC QKQT
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/check-hcqkqt/:personnelId',
  verifyToken,
  requireManager,
  annualRewardController.checkAlreadyReceivedHCQKQT
);

/**
 * @route   GET /api/annual-rewards/check-knc-vsnxd/:personnelId
 * @desc    Check if a personnel has already received KNC VSNXD QDNDVN
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/check-knc-vsnxd/:personnelId',
  verifyToken,
  requireManager,
  annualRewardController.checkAlreadyReceivedKNCVSNXDQDNDVN
);

/**
 * @route   POST /api/annual-rewards
 * @desc    Create an annual reward title
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/',
  verifyToken,
  requireManager,
  validate(annualRewardValidation.createAnnualReward),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  annualRewardController.createAnnualReward
);

/**
 * @route   PUT /api/annual-rewards/:id
 * @desc    Update an annual reward title
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  validate(annualRewardValidation.updateAnnualReward),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  annualRewardController.updateAnnualReward
);

/**
 * @route   DELETE /api/annual-rewards/:id
 * @desc    Delete an annual reward title
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  annualRewardController.deleteAnnualReward
);

/**
 * @route   POST /api/annual-rewards/check
 * @desc    Validate annual rewards before bulk operations
 * @access  Private - ADMIN and above
 */
router.post(
  '/check',
  verifyToken,
  requireAdmin,
  validate(annualRewardValidation.checkAnnualRewards),
  annualRewardController.checkAnnualRewards
);

/**
 * @route   POST /api/annual-rewards/bulk
 * @desc    Bulk create annual reward titles
 * @access  Private - ADMIN and above
 */
router.post(
  '/bulk',
  verifyToken,
  requireAdmin,
  pdfUpload.single('file_dinh_kem'),
  validate(annualRewardValidation.bulkCreate),
  auditLog({
    action: AUDIT_ACTIONS.BULK,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'BULK'),
    getResourceId: () => null,
  }),
  annualRewardController.bulkCreateAnnualRewards
);

/**
 * @route   POST /api/annual-rewards/import/preview
 * @desc    Preview annual reward import from Excel — validate only, no DB write
 * @access  Private - ADMIN and above
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  annualRewardController.previewImport
);

/**
 * @route   POST /api/annual-rewards/import/confirm
 * @desc    Confirm annual reward import — persist validated data to DB
 * @access  Private - ADMIN and above
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportAnnualReward),
  annualRewardController.confirmImport
);

/**
 * @route   POST /api/annual-rewards/import
 * @desc    Import annual rewards from Excel (legacy direct import)
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  requireManager,
  upload.single('file'),
  auditLog({
    action: AUDIT_ACTIONS.IMPORT,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'IMPORT'),
    getResourceId: () => null,
  }),
  annualRewardController.importAnnualRewards
);

/**
 * @route   GET /api/annual-rewards/template
 * @desc    Download Excel template for annual reward import
 * @access  Private - ADMIN, MANAGER
 */
router.get('/template', verifyToken, requireManager, annualRewardController.getTemplate);

/**
 * @route   GET /api/annual-rewards/export
 * @desc    Export annual rewards to Excel
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(annualRewardValidation.exportAnnualRewardsQuery, 'query'),
  annualRewardController.exportToExcel
);

/**
 * @route   GET /api/annual-rewards/statistics
 * @desc    Get annual reward statistics
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(annualRewardValidation.getAnnualRewardsStatisticsQuery, 'query'),
  annualRewardController.getStatistics
);

/**
 * @route   GET /api/annual-rewards/decision-files/:filename
 * @desc    Serve a decision PDF file for annual rewards
 * @access  Private - All authenticated users
 */
router.get('/decision-files/:filename', verifyToken, (req: Request, res: Response) => {
  try {
    const raw = normalizeParam(req.params.filename);
    if (!raw) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu tên file',
      });
    }
    const filename = path.basename(raw);
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File không tồn tại',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Không thể tải file',
    });
  }
});

export default router;
