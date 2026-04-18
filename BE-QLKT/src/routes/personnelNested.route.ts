import { Router, Request, Response, NextFunction } from 'express';
import annualRewardController from '../controllers/annualReward.controller';
import positionHistoryController from '../controllers/positionHistory.controller';
import scientificAchievementController from '../controllers/scientificAchievement.controller';
import profileController from '../controllers/profile.controller';
import { verifyToken, requireManager, requireAuth } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router({ mergeParams: true });

/**
 * Nested routes for /api/personnel/:personnelId/*
 * These are alias routes that convert nested URLs to query param format
 */

/**
 * @route   GET /api/personnel/:personnelId/annual-rewards
 * @desc    List annual reward titles for a personnel (alias route)
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get(
  '/annual-rewards',
  verifyToken,
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    // Convert nested route to query param format
    req.query.personnel_id = req.params.personnelId;
    annualRewardController.getAnnualRewards(req, res, next);
  }
);

/**
 * @route   POST /api/personnel/:personnelId/annual-rewards
 * @desc    Create an annual reward title for a personnel (alias route)
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/annual-rewards',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  (req: Request, res: Response, next: NextFunction) => {
    // Add personnel_id from URL params to body (CUID, not a number)
    req.body.personnel_id = req.params.personnelId;
    annualRewardController.createAnnualReward(req, res, next);
  }
);

/**
 * @route   GET /api/personnel/:personnelId/position-history
 * @desc    List position history for a personnel (alias route)
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get(
  '/position-history',
  verifyToken,
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    // Convert nested route to query param format
    req.query.personnel_id = req.params.personnelId;
    positionHistoryController.getPositionHistory(req, res, next);
  }
);

/**
 * @route   POST /api/personnel/:personnelId/position-history
 * @desc    Create a position history entry for a personnel (alias route)
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/position-history',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  (req: Request, res: Response, next: NextFunction) => {
    // Add personnel_id from URL params to body (CUID, not a number)
    req.body.personnel_id = req.params.personnelId;
    positionHistoryController.createPositionHistory(req, res, next);
  }
);

/**
 * @route   PUT /api/personnel/:personnelId/position-history/:id
 * @desc    Update a position history entry (alias route)
 * @access  Private - ADMIN, MANAGER
 */
router.put(
  '/position-history/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.updatePositionHistory
);

/**
 * @route   DELETE /api/personnel/:personnelId/position-history/:id
 * @desc    Delete a position history entry (alias route)
 * @access  Private - ADMIN, MANAGER
 */
router.delete(
  '/position-history/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.deletePositionHistory
);

/**
 * @route   GET /api/personnel/:personnelId/scientific-achievements
 * @desc    List scientific achievements for a personnel (alias route)
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get(
  '/scientific-achievements',
  verifyToken,
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    // Convert nested route to query param format
    req.query.personnel_id = req.params.personnelId;
    scientificAchievementController.getAchievements(req, res, next);
  }
);

/**
 * @route   POST /api/personnel/:personnelId/scientific-achievements
 * @desc    Create a scientific achievement for a personnel (alias route)
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/scientific-achievements',
  verifyToken,
  requireManager,
  (req: Request, res: Response, next: NextFunction) => {
    // Add personnel_id from URL params to body (CUID, not a number)
    req.body.personnel_id = req.params.personnelId;
    scientificAchievementController.createAchievement(req, res, next);
  }
);

/**
 * @route   GET /api/personnel/:personnelId/profile
 * @desc    Get annual award profile for a personnel (alias route)
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get(
  '/profile',
  verifyToken,
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    // Convert nested route param to match profile controller expectation
    req.params.personnel_id = req.params.personnelId;
    profileController.getAnnualProfile(req, res, next);
  }
);

export default router;
