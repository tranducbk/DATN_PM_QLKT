import { Router } from 'express';
import profileController from '../controllers/profile.controller';
import { verifyToken, requireAdminOnly, requireAdminOrManager } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';

const router = Router();

/**
 * @route   GET /api/profiles/annual/:personnel_id
 * @desc    Get Annual Reward profile for a personnel (CSTT, CSTDCS, BKBQP, CSTDTQ)
 *          Query: ?year=2025 (auto-recalculates before returning when year is provided)
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get('/annual/:personnel_id', verifyToken, profileController.getAnnualProfile);

/**
 * @route   GET /api/profiles/tenure/:personnel_id
 * @desc    Get Valiant Soldier Medal (HCCSVV) tenure-based award profile for a personnel
 *          Auto-recalculates on every request
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get('/tenure/:personnel_id', verifyToken, profileController.getTenureProfile);

/**
 * @route   GET /api/profiles/contribution/:personnel_id
 * @desc    Get Contribution Award (HCBVTQ) profile for a personnel
 *          Auto-recalculates on every request
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get(
  '/contribution/:personnel_id',
  verifyToken,
  profileController.getContributionProfile
);

/**
 * @route   POST /api/profiles/recalculate/:personnel_id
 * @desc    Recalculate award profiles for a personnel
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/recalculate/:personnel_id',
  verifyToken,
  requireAdminOrManager,
  profileController.recalculateProfile
);

/**
 * @route   POST /api/profiles/check-eligibility
 * @desc    Check consecutive award eligibility for one or more personnel
 *          Body: { items: [{ personnel_id, nam, danh_hieu }] }
 * @access  Private - ADMIN, MANAGER
 */
router.post('/check-eligibility', verifyToken, requireAdminOrManager, profileController.checkEligibility);

/**
 * @route   POST /api/profiles/recalculate-all
 * @desc    Recalculate award profiles for all personnel
 * @access  Private - ADMIN only
 */
router.post('/recalculate-all', verifyToken, requireAdminOnly, profileController.recalculateAll);

/**
 * @route   GET /api/profiles/tenure
 * @desc    List all HCCSVV tenure award profiles (admin view)
 * @access  Private - ADMIN only
 */
router.get('/tenure', verifyToken, requireAdminOnly, profileController.getAllTenureProfiles);

/**
 * @route   PUT /api/profiles/tenure/:personnel_id
 * @desc    Update HCCSVV tenure award profile status (admin approves the medal)
 * @access  Private - ADMIN only
 */
router.put(
  '/tenure/:personnel_id',
  verifyToken,
  requireAdminOnly,
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: AWARD_SLUGS.TENURE_MEDALS,
    getDescription: getLogDescription(AWARD_SLUGS.TENURE_MEDALS, 'UPDATE'),
    getResourceId: getResourceId.fromParams('personnel_id'),
  }),
  profileController.updateTenureProfile
);

export default router;
