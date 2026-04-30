import { Router } from 'express';
import adhocAwardController from '../controllers/adhocAward.controller';
import { verifyToken, checkRole } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { adhocAwardUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';

const router = Router();

// All routes require authentication
router.use(verifyToken);

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
    action: AUDIT_ACTIONS.CREATE,
    resource: AWARD_SLUGS.ADHOC_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.ADHOC_AWARDS, 'CREATE'),
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
    action: AUDIT_ACTIONS.UPDATE,
    resource: AWARD_SLUGS.ADHOC_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.ADHOC_AWARDS, 'UPDATE'),
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
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.ADHOC_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.ADHOC_AWARDS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  adhocAwardController.deleteAdhocAward
);

export default router;
