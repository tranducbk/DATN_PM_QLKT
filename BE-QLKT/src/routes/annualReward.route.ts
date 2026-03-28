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
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import {
  excelUpload as upload,
  pdfDecisionUpload as pdfUpload,
  decisionUploadDir as uploadDir,
} from '../configs/multer';
import { validate } from '../middlewares/validate';
import { annualRewardValidation } from '../validations';
import { normalizeParam } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

router.get('/', verifyToken, requireAuth, annualRewardController.getAnnualRewards);

// Kiểm tra quân nhân đã nhận HC QKQT chưa
router.get(
  '/check-hcqkqt/:personnelId',
  verifyToken,
  requireAuth,
  annualRewardController.checkAlreadyReceivedHCQKQT
);

// Kiểm tra quân nhân đã nhận KNC VSNXD chưa
router.get(
  '/check-knc-vsnxd/:personnelId',
  verifyToken,
  requireAuth,
  annualRewardController.checkAlreadyReceivedKNCVSNXD
);

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

// Kiểm tra quân nhân đã có khen thưởng hoặc đề xuất cho năm đó chưa
router.post('/check', verifyToken, requireAdmin, annualRewardController.checkAnnualRewards);

// Thêm danh hiệu đồng loạt cho nhiều quân nhân (có thể kèm file đính kèm)
router.post(
  '/bulk',
  verifyToken,
  requireAdmin,
  pdfUpload.single('file_dinh_kem'),
  auditLog({
    action: AUDIT_ACTIONS.BULK,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'BULK'),
    getResourceId: () => null, // Bulk operation không có single resource ID
  }),
  annualRewardController.bulkCreateAnnualRewards
);

// Preview import danh hiệu hằng năm từ Excel (chỉ validate, không ghi DB)
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  annualRewardController.previewImport
);

// Confirm import danh hiệu hằng năm (lưu dữ liệu đã validate vào DB)
router.post('/import/confirm', verifyToken, requireAdmin, annualRewardController.confirmImport);

// Import danh hiệu hằng năm từ Excel
router.post(
  '/import',
  verifyToken,
  requireManager,
  upload.single('file'),
  auditLog({
    action: AUDIT_ACTIONS.IMPORT,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'IMPORT'),
    getResourceId: () => null, // Import operation không có single resource ID
  }),
  annualRewardController.importAnnualRewards
);

// Tải file mẫu Excel
router.get('/template', verifyToken, requireManager, annualRewardController.getTemplate);

// Xuất danh sách ra Excel
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  annualRewardController.exportToExcel
);

// Thống kê khen thưởng cá nhân hằng năm
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  annualRewardController.getStatistics
);

// Serve file PDF quyết định
router.get('/decision-files/:filename', verifyToken, (req: Request, res: Response) => {
  try {
    const filename = normalizeParam(req.params.filename);
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu tên file',
      });
    }
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
