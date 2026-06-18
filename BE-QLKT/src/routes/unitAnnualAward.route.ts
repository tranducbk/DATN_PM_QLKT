import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import unitAnnualAwardController from '../controllers/unitAnnualAward.controller';
import { verifyToken, requireManager, requireAdminOnly } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { excelUpload as upload, decisionUploadDir as uploadDir } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation, unitAnnualAwardValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/unit-annual-awards
 * @desc    List unit annual awards (Admin: all units, Manager/User: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  requireManager,
  validate(unitAnnualAwardValidation.listUnitAnnualAwardsQuery, 'query'),
  unitAnnualAwardController.list
);

/**
 * @route   GET /api/unit-annual-awards/template
 * @desc    Download Excel template for unit annual award import
 * @access  ADMIN, MANAGER
 */
router.get('/template', verifyToken, requireManager, unitAnnualAwardController.getTemplate);

/**
 * @route   POST /api/unit-annual-awards/import/preview
 * @desc    Preview unit annual award import — validate only, no DB write
 * @access  ADMIN only (Excel import is ADMIN-only)
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdminOnly,
  upload.single('file'),
  unitAnnualAwardController.previewImport
);

/**
 * @route   POST /api/unit-annual-awards/import/confirm
 * @desc    Confirm unit annual award import — persist validated data to DB
 * @access  ADMIN only (Excel import is ADMIN-only)
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdminOnly,
  validate(excelImportValidation.confirmImportUnitAnnualAward),
  unitAnnualAwardController.confirmImport
);

/**
 * @route   GET /api/unit-annual-awards/export
 * @desc    Export unit annual awards to Excel
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  requireManager,
  validate(unitAnnualAwardValidation.exportUnitAnnualAwardsQuery, 'query'),
  unitAnnualAwardController.exportToExcel
);

/**
 * @route   GET /api/unit-annual-awards/statistics
 * @desc    Get unit annual award statistics
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  requireManager,
  validate(unitAnnualAwardValidation.getUnitAnnualAwardsStatisticsQuery, 'query'),
  unitAnnualAwardController.getStatistics
);

/**
 * @route   GET /api/unit-annual-awards/history
 * @desc    List all award history for a unit
 * @access  ADMIN, MANAGER
 */
router.get(
  '/history',
  verifyToken,
  requireManager,
  unitAnnualAwardController.getUnitAnnualAwards
);

/**
 * @route   GET /api/unit-annual-awards/profile/:don_vi_id
 * @desc    Get annual award profile for a unit (computed summary)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/profile/:don_vi_id',
  verifyToken,
  requireManager,
  unitAnnualAwardController.getUnitAnnualProfile
);

/**
 * @route   GET /api/unit-annual-awards/:id
 * @desc    Get unit annual award details by ID
 * @access  ADMIN, MANAGER
 */
router.get('/:id', verifyToken, requireManager, unitAnnualAwardController.getById);

/**
 * @route   POST /api/unit-annual-awards
 * @desc    Create a unit annual award (admin direct entry of a granted award)
 * @access  ADMIN only
 */
// Admin direct entry — award is granted immediately, restricted to ADMIN
router.post(
  '/',
  verifyToken,
  requireAdminOnly,
  validate(unitAnnualAwardValidation.upsertUnitAnnualAward),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   PUT /api/unit-annual-awards/:id
 * @desc    Update a unit annual award (admin direct entry of a granted award)
 * @access  ADMIN only
 */
router.put(
  '/:id',
  verifyToken,
  requireAdminOnly,
  validate(unitAnnualAwardValidation.upsertUnitAnnualAward),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   DELETE /api/unit-annual-awards/:id
 * @desc    Delete a unit annual award
 * @access  ADMIN, MANAGER
 */
router.delete(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.remove
);

/**
 * @route   POST /api/unit-annual-awards/recalculate
 * @desc    Recalculate unit annual awards
 * @access  ADMIN, MANAGER
 */
router.post(
  '/recalculate',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.RECALCULATE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'RECALCULATE'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.recalculate
);

/**
 * @route   POST /api/unit-annual-awards/decision-files/:id/upload
 * @desc    Serve the decision PDF file for a unit annual award
 * @access  ADMIN
 */
router.get(
  '/decision-files/:filename',
  verifyToken,
  requireAdminOnly,
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
