import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import unitAnnualAwardController from '../controllers/unitAnnualAward.controller';
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
  decisionUploadDir as uploadDir,
} from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation, unitAnnualAwardValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/awards/units/annual
 * @desc    List unit annual awards (Admin: all units, Manager/User: own unit)
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/',
  verifyToken,
  requireManager,
  validate(unitAnnualAwardValidation.listUnitAnnualAwardsQuery, 'query'),
  unitAnnualAwardController.list
);

/**
 * @route   GET /api/awards/units/annual/template
 * @desc    Download Excel template for unit annual award import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireManager, unitAnnualAwardController.getTemplate);

/**
 * @route   POST /api/awards/units/annual/import/preview
 * @desc    Preview unit annual award import — validate only, no DB write
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import/preview',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  unitAnnualAwardController.previewImport
);

/**
 * @route   POST /api/awards/units/annual/import/confirm
 * @desc    Confirm unit annual award import — persist validated data to DB
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import/confirm',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(excelImportValidation.confirmImportUnitAnnualAward),
  unitAnnualAwardController.confirmImport
);

/**
 * @route   POST /api/awards/units/annual/import
 * @desc    Import unit annual awards from Excel (legacy direct import)
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  auditLog({
    action: AUDIT_ACTIONS.IMPORT,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'IMPORT'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.importFromExcel
);

/**
 * @route   GET /api/awards/units/annual/export
 * @desc    Export unit annual awards to Excel
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(unitAnnualAwardValidation.exportUnitAnnualAwardsQuery, 'query'),
  unitAnnualAwardController.exportToExcel
);

/**
 * @route   GET /api/awards/units/annual/statistics
 * @desc    Get unit annual award statistics
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(unitAnnualAwardValidation.getUnitAnnualAwardsStatisticsQuery, 'query'),
  unitAnnualAwardController.getStatistics
);

/**
 * @route   GET /api/awards/units/annual/history
 * @desc    List all award history for a unit
 * @access  ADMIN, MANAGER, USER
 */
router.get('/history', verifyToken, requireManager, unitAnnualAwardController.getUnitAnnualAwards);

/**
 * @route   GET /api/awards/units/annual/profile/:don_vi_id
 * @desc    Get annual award profile for a unit (computed summary)
 * @access  ADMIN, MANAGER, USER
 */
router.get('/profile/:don_vi_id', verifyToken, requireManager, unitAnnualAwardController.getUnitAnnualProfile);

/**
 * @route   GET /api/awards/units/annual/:id
 * @desc    Get unit annual award details by ID
 * @access  ADMIN, MANAGER
 */
router.get('/:id', verifyToken, requireManager, unitAnnualAwardController.getById);

/**
 * @route   POST /api/awards/units/annual
 * @desc    Create a unit annual award
 * @access  MANAGER
 */
router.post(
  '/',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   PUT /api/awards/units/annual/:id
 * @desc    Update a unit annual award
 * @access  MANAGER
 */
router.put(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   DELETE /api/awards/units/annual/:id
 * @desc    Delete a unit annual award
 * @access  MANAGER
 */
router.delete(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.remove
);

/**
 * @route   POST /api/awards/units/annual/propose
 * @desc    Submit a unit annual award proposal
 * @access  MANAGER
 */
router.post(
  '/propose',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.PROPOSE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'PROPOSE'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.propose
);

/**
 * @route   POST /api/awards/units/annual/:id/approve
 * @desc    Approve a unit annual award proposal
 * @access  ADMIN
 */
router.post(
  '/:id/approve',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.APPROVE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'APPROVE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.approve
);

/**
 * @route   POST /api/awards/units/annual/:id/reject
 * @desc    Reject a unit annual award proposal
 * @access  ADMIN
 */
router.post(
  '/:id/reject',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.REJECT,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'REJECT'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.reject
);

/**
 * @route   POST /api/awards/units/annual/recalculate
 * @desc    Recalculate unit annual awards
 * @access  MANAGER
 */
router.post(
  '/recalculate',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.RECALCULATE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'RECALCULATE'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.recalculate
);

/**
 * @route   POST /api/awards/units/annual/decision-files/:id/upload
 * @desc    Serve the decision PDF file for a unit annual award
 * @access  ADMIN
 */
router.get(
  '/decision-files/:filename',
  verifyToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const filename = path.basename(String(req.params.filename ?? ''));
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
      res.status(500).json({ success: false, message: 'Không thể tải file' });
    }
  }
);

export default router;
