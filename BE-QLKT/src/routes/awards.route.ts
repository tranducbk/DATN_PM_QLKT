import { Router, Request, Response } from 'express';
import proposalController from '../controllers/proposal.controller';
import awardBulkController from '../controllers/awardBulk.controller';
import {
  verifyToken,
  requireAdminOnly,
  requireSuperAdmin,
  requireAdminOrManager,
} from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { bulkUpload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';
import { awardBulkValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/awards
 * @desc    List all awards (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  requireAdminOrManager,
  proposalController.getAllAwards
);

/**
 * @route   GET /api/awards/export
 * @desc    Export consolidated awards to Excel
 * @access  ADMIN only
 */
router.get('/export', verifyToken, requireAdminOnly, proposalController.exportAllAwardsExcel);

/**
 * @route   GET /api/awards/statistics
 * @desc    Get award statistics by type
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  requireAdminOrManager,
  proposalController.getAwardsStatistics
);

/**
 * @route   POST /api/awards/bulk
 * @desc    Bulk create awards with full eligibility validation
 * @access  ADMIN only
 */
router.post(
  '/bulk',
  verifyToken,
  requireAdminOnly,
  bulkUpload.fields([{ name: 'attached_files', maxCount: 10 }]),
  validate(awardBulkValidation.bulkCreateAwards),
  auditLog({
    action: AUDIT_ACTIONS.BULK,
    resource: RESOURCE_SLUGS.AWARDS,
    getDescription: getLogDescription(RESOURCE_SLUGS.AWARDS, 'BULK'),
    getResourceId: () => null,
    getPayload: (req: Request, res: Response, responseData: unknown) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = (data as Record<string, unknown>)?.data || {};

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
      } catch (error) {
        console.error('Failed to build bulk-award audit payload from request:', error);
        return null;
      }
    },
  }),
  awardBulkController.bulkCreateAwards
);

/**
 * @route   POST /api/awards/bulk-bypass
 * @desc    Bulk create awards bypassing eligibility checks (data correction by SUPER_ADMIN)
 * @access  SUPER_ADMIN only
 */
router.post(
  '/bulk-bypass',
  verifyToken,
  requireSuperAdmin,
  bulkUpload.fields([{ name: 'attached_files', maxCount: 10 }]),
  validate(awardBulkValidation.bulkCreateAwards),
  auditLog({
    action: AUDIT_ACTIONS.BULK_BYPASS,
    resource: RESOURCE_SLUGS.AWARDS,
    getDescription: getLogDescription(RESOURCE_SLUGS.AWARDS, 'BULK_BYPASS'),
    getResourceId: () => null,
    getPayload: (req: Request, res: Response, responseData: unknown) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = (data as Record<string, unknown>)?.data || {};
        const resultObj = result as Record<string, unknown>;
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        return {
          type: req.body?.type || '',
          nam: req.body?.nam ?? null,
          bypass: true,
          imported_count: resultObj?.importedCount || 0,
          error_count: resultObj?.errorCount || 0,
          affected_personnel_ids: resultObj?.affectedPersonnelIds || [],
          attached_files_count: files?.attached_files?.length || 0,
        };
      } catch (error) {
        console.error('Failed to build bulk-bypass audit payload from request:', error);
        return null;
      }
    },
  }),
  awardBulkController.bulkCreateAwardsBypass
);

export default router;
