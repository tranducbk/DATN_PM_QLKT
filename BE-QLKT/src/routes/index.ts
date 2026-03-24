import { Router, Request, Response } from 'express';
import authRoute from './auth.route';
import accountRoute from './account.route';
import unitRoute from './unit.route';
import positionRoute from './position.route';
import personnelRoute from './personnel.route';
import annualRewardRoute from './annualReward.route';
import scientificAchievementRoute from './scientificAchievement.route';
import positionHistoryRoute from './positionHistory.route';
import profileRoute from './profile.route';
import systemLogsRoute from './systemLogs.route';
import categoriesRoute from './categories.route';
import personnelNestedRoute from './personnelNested.route';
import proposalRoute from './proposal.route';
import decisionRoute from './decision.route';
import awardsRoute from './awards.route';
import notificationRoute from './notification.route';
import unitAnnualAwardRoute from './unitAnnualAward.route';
import dashboardRoute from './dashboard.route';
import adhocAwardRoute from './adhocAward.route';
import hccsvvRoute from './hccsvv.route';
import contributionAwardRoute from './contributionAward.route';
import commemorativeMedalRoute from './commemorativeMedal.route';
import militaryFlagRoute from './militaryFlag.route';
import unitController from '../controllers/unit.controller';
import { verifyToken, requireAdmin } from '../middlewares/auth';
import devZoneRoute from './devZone.route';

const router = Router();

// API Routes
// 1. Authentication
router.use('/api/auth', authRoute);

// 2. Account Management (SUPER_ADMIN)
router.use('/api/accounts', accountRoute);

// 3. Master Data Management (ADMIN)
router.use('/api/units', unitRoute);
router.use('/api/positions', positionRoute);

// 3.0.1 Sub-units (Đơn vị trực thuộc)
router.get('/api/sub-units', verifyToken, requireAdmin, unitController.getAllSubUnits);

// 3.1 Categories (alias routes for frontend compatibility)
router.use('/api/categories', categoriesRoute);

// 4. Personnel Management
router.use('/api/personnel', personnelRoute);
router.use('/api/personnel/:personnelId', personnelNestedRoute);

// 5. Reward Management (Input)
router.use('/api/annual-rewards', annualRewardRoute);
router.use('/api/scientific-achievements', scientificAchievementRoute);
router.use('/api/position-history', positionHistoryRoute);

// 5.1. Proposal Management (Workflow: Đề xuất & Phê duyệt)
router.use('/api/proposals', proposalRoute);

// 5.1.1. Decision Management (Quản lý quyết định khen thưởng)
router.use('/api/decisions', decisionRoute);

// 5.2. Unit Annual Awards (Khen thưởng đơn vị hằng năm) - Must come before /api/awards
router.use('/api/awards/units/annual', unitAnnualAwardRoute);

// 5.3. Specialized Award Types
router.use('/api/hccsvv', hccsvvRoute);
router.use('/api/contribution-awards', contributionAwardRoute);
router.use('/api/commemorative-medals', commemorativeMedalRoute);
router.use('/api/military-flag', militaryFlagRoute);

// 5.4. Awards Management (Quản lý khen thưởng tổng hợp)
router.use('/api/awards', awardsRoute);

// 5.5. Ad-hoc Awards Management (Khen thưởng đột xuất - ADMIN only)
router.use('/api/adhoc-awards', adhocAwardRoute);

// 6. Profile & Calculation (Output)
router.use('/api/profiles', profileRoute);
router.use('/api/system-logs', systemLogsRoute);

// 7. Dashboard Statistics
router.use('/api/dashboard', dashboardRoute);

// 7. Notifications
router.use('/api/notifications', notificationRoute);

// 8. Dev Zone (hidden)
router.use('/api/dev-zone', devZoneRoute);

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
router.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint không tồn tại',
  });
});

export default router;
