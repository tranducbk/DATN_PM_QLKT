const router = require('express').Router();

// Import routes
const authRoute = require('./auth.route');
const accountRoute = require('./account.route');
const unitRoute = require('./unit.route');
const positionRoute = require('./position.route');
const personnelRoute = require('./personnel.route');
const annualRewardRoute = require('./annualReward.route');
const scientificAchievementRoute = require('./scientificAchievement.route');
const positionHistoryRoute = require('./positionHistory.route');
const profileRoute = require('./profile.route');
const systemLogsRoute = require('./systemLogs.route');
const categoriesRoute = require('./categories.route');
const personnelNestedRoute = require('./personnelNested.route');
const proposalRoute = require('./proposal.route');
const decisionRoute = require('./decision.route');
const awardsRoute = require('./awards.route');
const notificationRoute = require('./notification.route');
const unitAnnualAwardRoute = require('./unitAnnualAward.route');
const dashboardRoute = require('./dashboard.route');
const adhocAwardRoute = require('./adhocAward.route');
const hccsvvRoute = require('./hccsvv.route');
const contributionAwardRoute = require('./contributionAward.route');
const commemorativeMedalRoute = require('./commemorativeMedal.route');
const militaryFlagRoute = require('./militaryFlag.route');

// API Routes
// 1. Authentication
router.use('/api/auth', authRoute);

// 2. Account Management (SUPER_ADMIN)
router.use('/api/accounts', accountRoute);

// 3. Master Data Management (ADMIN)
router.use('/api/units', unitRoute);
router.use('/api/positions', positionRoute);

// 3.0.1 Sub-units (Đơn vị trực thuộc)
const unitController = require('../controllers/unit.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth');
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

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint không tồn tại',
  });
});

module.exports = router;
