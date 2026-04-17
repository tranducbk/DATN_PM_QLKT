import { Router, Request, Response } from 'express';
import hccsvvController from '../controllers/hccsvv.controller';
import { verifyToken, checkRole, requireAdmin } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/hccsvv/template
 * @desc    Download Excel template for Valiant Soldier Medal (HCCSVV) import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdmin, hccsvvController.getTemplate);

/**
 * @route   POST /api/hccsvv/import/preview
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
 * @route   POST /api/hccsvv/import/confirm
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
 * @route   POST /api/hccsvv/import
 * @desc    Import HCCSVV medals from Excel (legacy direct import)
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  hccsvvController.importFromExcel
);

/**
 * @route   GET /api/hccsvv
 * @desc    List HCCSVV medals (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), hccsvvController.getAll);

/**
 * @route   GET /api/hccsvv/export
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
 * @route   GET /api/hccsvv/statistics
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
 * @route   POST /api/hccsvv
 * @desc    Create an HCCSVV medal directly (bypasses eligibility check)
 * @access  SUPER_ADMIN
 */
router.post(
  '/',
  verifyToken,
  checkRole([ROLES.SUPER_ADMIN]),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'hccsvv',
    getDescription: getLogDescription('hccsvv', 'CREATE'),
    getResourceId: (req: Request, res: Response) => (res.locals.createdId as string) ?? null,
  }),
  hccsvvController.createDirect
);

/**
 * @route   DELETE /api/hccsvv/:id
 * @desc    Delete an HCCSVV medal (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'hccsvv',
    getDescription: getLogDescription('hccsvv', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  hccsvvController.deleteAward
);

export default router;
