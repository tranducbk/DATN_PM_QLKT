import { Router, Request, Response } from 'express';
import hccsvvController from '../controllers/tenureMedal.controller';
import { verifyToken, checkRole, requireAdmin } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
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
router.get('/template', verifyToken, requireAdmin, hccsvvController.getTemplate);

/**
 * @route   POST /api/tenure-medals/import/preview
 * @desc    Preview HCCSVV import — validate only, no DB write
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  hccsvvController.previewImport
);

/**
 * @route   POST /api/tenure-medals/import/confirm
 * @desc    Confirm HCCSVV import — persist validated data to DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportHccsvv),
  hccsvvController.confirmImport
);

/**
 * @route   GET /api/tenure-medals
 * @desc    List HCCSVV medals (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), hccsvvController.getAll);

/**
 * @route   GET /api/tenure-medals/export
 * @desc    Export HCCSVV medals to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  hccsvvController.exportToExcel
);

/**
 * @route   GET /api/tenure-medals/statistics
 * @desc    Get HCCSVV medal statistics by grade
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  hccsvvController.getStatistics
);

/**
 * @route   POST /api/tenure-medals
 * @desc    Create an HCCSVV medal directly (bypasses eligibility check)
 * @access  SUPER_ADMIN
 */
router.post(
  '/',
  verifyToken,
  checkRole([ROLES.SUPER_ADMIN]),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: AWARD_SLUGS.TENURE_MEDALS,
    getDescription: getLogDescription(AWARD_SLUGS.TENURE_MEDALS, 'CREATE'),
    getResourceId: (req: Request, res: Response) => (res.locals.createdId as string) ?? null,
  }),
  hccsvvController.createDirect
);

/**
 * @route   DELETE /api/tenure-medals/:id
 * @desc    Delete an HCCSVV medal (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.TENURE_MEDALS,
    getDescription: getLogDescription(AWARD_SLUGS.TENURE_MEDALS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  hccsvvController.deleteAward
);

export default router;
