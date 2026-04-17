import { Router, Request, Response } from 'express';
import proposalController from '../controllers/proposal.controller';
import awardBulkController from '../controllers/awardBulk.controller';
import { verifyToken, checkRole, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload, bulkUpload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { awardBulkValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/awards/template
 * @desc    Download Excel template for award import
 * @access  ADMIN
 */
router.get(
  '/template',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  proposalController.getAwardsTemplate
);

/**
 * @route   POST /api/awards/import
 * @desc    Import awards from Excel
 * @access  ADMIN
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN]),
  upload.single('file'),
  proposalController.importAwards
);

/**
 * @route   GET /api/awards
 * @desc    List all awards (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  proposalController.getAllAwards
);

/**
 * @route   GET /api/awards/export
 * @desc    Export consolidated awards to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  proposalController.exportAllAwardsExcel
);

/**
 * @route   GET /api/awards/statistics
 * @desc    Get award statistics by type
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  proposalController.getAwardsStatistics
);

/**
 * @route   POST /api/awards/bulk
 * @desc    Bulk create awards with full validation
 * @access  ADMIN
 */
router.post(
  '/bulk',
  verifyToken,
  requireAdmin,
  bulkUpload.fields([{ name: 'attached_files', maxCount: 10 }]),
  validate(awardBulkValidation.bulkCreateAwards),
  auditLog({
    action: AUDIT_ACTIONS.BULK,
    resource: 'awards',
    getDescription: getLogDescription('awards', 'BULK'),
    getResourceId: () => null,
    getPayload: (req: Request, res: Response, responseData: unknown) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = (data as Record<string, unknown>)?.data || data || {};

        // Validate middleware already coerces fields (e.g. JSON strings to arrays).
        const type = req.body?.type || '';
        const nam = req.body?.nam ?? null;
        const selectedPersonnel = req.body?.selected_personnel || [];
        const selectedUnits = req.body?.selected_units || [];
        const titleData = req.body?.title_data || [];

        const resultObj = result as Record<string, unknown>;
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;

        return {
          type,
          nam,
          selected_personnel_count: Array.isArray(selectedPersonnel) ? selectedPersonnel.length : 0,
          selected_units_count: Array.isArray(selectedUnits) ? selectedUnits.length : 0,
          title_data_count: Array.isArray(titleData) ? titleData.length : 0,
          imported_count: resultObj?.importedCount || 0,
          error_count: resultObj?.errorCount || 0,
          affected_personnel_ids: resultObj?.affectedPersonnelIds || [],
          has_attached_files: (files?.attached_files?.length ?? 0) > 0,
          attached_files_count: files?.attached_files?.length || 0,
        };
      } catch {
        return null;
      }
    },
  }),
  awardBulkController.bulkCreateAwards
);

export default router;
