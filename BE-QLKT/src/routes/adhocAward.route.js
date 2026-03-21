const express = require('express');
const router = express.Router();
const adhocAwardController = require('../controllers/adhocAward.controller');
const { verifyToken, checkRole } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLog');
const multer = require('multer');
const { ROLES } = require('../constants/roles');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF, images, and common document formats
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'File type not allowed. Only PDF, images (JPEG, PNG), Word, and Excel files are accepted.'
        )
      );
    }
  },
});

// All routes require authentication
router.use(verifyToken);

// Routes accessible by ADMIN and MANAGER (read-only for MANAGER)
/**
 * @route   GET /api/adhoc-awards
 * @desc    Get all ad-hoc awards with filters
 * @access  Admin (all), Manager (own unit only)
 */
router.get('/', checkRole([ROLES.ADMIN, ROLES.MANAGER]), adhocAwardController.getAdhocAwards);

/**
 * @route   GET /api/adhoc-awards/personnel/:personnelId
 * @desc    Get all ad-hoc awards for a specific personnel
 * @access  Admin (all), Manager (own unit only), User (own only)
 */
router.get(
  '/personnel/:personnelId',
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
  adhocAwardController.getAdhocAwardsByPersonnel
);

/**
 * @route   GET /api/adhoc-awards/unit/:unitId
 * @desc    Get all ad-hoc awards for a specific unit
 * @access  Admin (all), Manager (own unit only)
 */
router.get(
  '/unit/:unitId',
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  adhocAwardController.getAdhocAwardsByUnit
);

/**
 * @route   GET /api/adhoc-awards/:id
 * @desc    Get single ad-hoc award by ID
 * @access  Admin (all), Manager (own unit only)
 */
router.get('/:id', checkRole([ROLES.ADMIN, ROLES.MANAGER]), adhocAwardController.getAdhocAwardById);

// Routes accessible by ADMIN only (write operations)
router.use(checkRole([ROLES.ADMIN]));

/**
 * @route   POST /api/adhoc-awards
 * @desc    Create ad-hoc award
 * @access  Admin only
 */
router.post(
  '/',
  upload.fields([
    { name: 'decisionFiles', maxCount: 10 },
    { name: 'attachedFiles', maxCount: 10 },
  ]),
  auditLog({
    action: 'CREATE',
    resource: 'adhoc-awards',
    getDescription: getLogDescription('adhoc-awards', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  adhocAwardController.createAdhocAward
);

/**
 * @route   PUT /api/adhoc-awards/:id
 * @desc    Update ad-hoc award
 * @access  Admin only
 */
router.put(
  '/:id',
  upload.fields([
    { name: 'decisionFiles', maxCount: 10 },
    { name: 'attachedFiles', maxCount: 10 },
  ]),
  auditLog({
    action: 'UPDATE',
    resource: 'adhoc-awards',
    getDescription: getLogDescription('adhoc-awards', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  adhocAwardController.updateAdhocAward
);

/**
 * @route   DELETE /api/adhoc-awards/:id
 * @desc    Delete ad-hoc award
 * @access  Admin only
 */
router.delete(
  '/:id',
  auditLog({
    action: 'DELETE',
    resource: 'adhoc-awards',
    getDescription: getLogDescription('adhoc-awards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  adhocAwardController.deleteAdhocAward
);

module.exports = router;
