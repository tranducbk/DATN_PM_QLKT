import { Router } from 'express';
import commemorativeMedalController from '../controllers/commemorativeMedal.controller';
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
 * @route   GET /api/commemorative-medals/template
 * @desc    Download Excel template for commemorative medal import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdmin, commemorativeMedalController.getTemplate);

/**
 * @route   POST /api/commemorative-medals/import/preview
 * @desc    Preview commemorative medal (KNC VSNXD) import — validate only, no DB write
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  commemorativeMedalController.previewImport
);

/**
 * @route   POST /api/commemorative-medals/import/confirm
 * @desc    Confirm commemorative medal (KNC VSNXD) import — persist validated data to DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportCommemorativeMedal),
  commemorativeMedalController.confirmImport
);

/**
 * @route   POST /api/commemorative-medals/import
 * @desc    Import commemorative medals from Excel (legacy direct import)
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  commemorativeMedalController.importFromExcel
);

/**
 * @route   GET /api/commemorative-medals
 * @desc    List commemorative medals (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  commemorativeMedalController.getAll
);

/**
 * @route   GET /api/commemorative-medals/export
 * @desc    Export commemorative medals to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  commemorativeMedalController.exportToExcel
);

/**
 * @route   GET /api/commemorative-medals/statistics
 * @desc    Get commemorative medal statistics
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  commemorativeMedalController.getStatistics
);

/**
 * @route   GET /api/commemorative-medals/personnel/:personnel_id
 * @desc    Get commemorative medals (VSNXD QĐNDVN) for a personnel
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/personnel/:personnel_id',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
  commemorativeMedalController.getByPersonnelId
);

/**
 * @route   DELETE /api/commemorative-medals/:id
 * @desc    Delete a commemorative medal award (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'commemorative-medals',
    getDescription: getLogDescription('commemorative-medals', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  commemorativeMedalController.deleteAward
);

export default router;
