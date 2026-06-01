/*
 * TENURE MEDAL ROUTE — HCCSVV (Huy chương Chiến sĩ Vẻ Vang).
 * CRUD + Excel import/export. 3 hạng Ba/Nhì/Nhất, mỗi hạng 1 record.
 * Rank order validation: phải có hạng thấp hơn trước.
 */

import { Router } from 'express';
import tenureMedalController from '../controllers/tenureMedal.controller';
import { verifyToken, requireAdminOrManager, requireAdminOnly } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/tenure-medals/template
 * @desc    Download Excel template for Valiant Soldier Medal (HCCSVV) import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdminOnly, tenureMedalController.getTemplate);

/**
 * @route   POST /api/tenure-medals/import/preview
 * @desc    Preview HCCSVV import — validate only, no DB write
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdminOnly,
  upload.single('file'),
  tenureMedalController.previewImport
);

/**
 * @route   POST /api/tenure-medals/import/confirm
 * @desc    Confirm HCCSVV import — persist validated data to DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdminOnly,
  validate(excelImportValidation.confirmImportHccsvv),
  tenureMedalController.confirmImport
);

/**
 * @route   GET /api/tenure-medals
 * @desc    List HCCSVV medals (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, requireAdminOrManager, tenureMedalController.getAll);

/**
 * @route   GET /api/tenure-medals/export
 * @desc    Export HCCSVV medals to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  requireAdminOrManager,
  tenureMedalController.exportToExcel
);

/**
 * @route   GET /api/tenure-medals/statistics
 * @desc    Get HCCSVV medal statistics by grade
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  requireAdminOrManager,
  tenureMedalController.getStatistics
);

/**
 * @route   DELETE /api/tenure-medals/:id
 * @desc    Delete an HCCSVV medal (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdminOnly,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.TENURE_MEDALS,
    getDescription: getLogDescription(AWARD_SLUGS.TENURE_MEDALS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  tenureMedalController.deleteAward
);

export default router;
