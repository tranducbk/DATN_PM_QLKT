import { Router, Request, Response } from 'express';
import proposalController from '../controllers/proposal.controller';
import awardBulkController from '../controllers/awardBulk.controller';
import { verifyToken, checkRole, requireAdmin } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload, bulkUpload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/awards/template
 * @desc    Tải file mẫu Excel để import khen thưởng
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
 * @desc    Import khen thưởng từ file Excel
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
 * @desc    Lấy danh sách tất cả khen thưởng (Admin: tất cả, Manager: đơn vị mình)
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
 * @desc    Xuất file Excel tổng hợp khen thưởng (Admin: tất cả, Manager: đơn vị mình)
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
 * @desc    Thống kê khen thưởng theo loại
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
 * @desc    Thêm khen thưởng đồng loạt với validation đầy đủ
 * @access  ADMIN
 */
router.post(
  '/bulk',
  verifyToken,
  requireAdmin,
  bulkUpload.fields([{ name: 'attached_files', maxCount: 10 }]),
  auditLog({
    action: AUDIT_ACTIONS.BULK,
    resource: 'awards',
    getDescription: getLogDescription('awards', 'BULK'),
    getResourceId: () => null,
    getPayload: (req: Request, res: Response, responseData: unknown) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = (data as Record<string, unknown>)?.data || data || {};

        // Parse request body
        const type = req.body?.type || '';
        const nam = req.body?.nam || '';
        let selectedPersonnel = req.body?.selected_personnel || [];
        let selectedUnits = req.body?.selected_units || [];
        let titleData = req.body?.title_data || [];

        if (typeof selectedPersonnel === 'string') {
          try {
            selectedPersonnel = JSON.parse(selectedPersonnel);
          } catch {
            // Ignore
          }
        }
        if (typeof selectedUnits === 'string') {
          try {
            selectedUnits = JSON.parse(selectedUnits);
          } catch {
            // Ignore
          }
        }
        if (typeof titleData === 'string') {
          try {
            titleData = JSON.parse(titleData);
          } catch {
            // Ignore
          }
        }

        const resultObj = result as Record<string, unknown>;
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;

        return {
          type,
          nam: nam ? parseInt(nam) : null,
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
