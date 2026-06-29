/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ROUTES INDEX — gộp tất cả route module + mount prefix /api/*
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ROUTE NAMESPACES (groups):
 *  1. /api/auth/*         — login, refresh, logout (anon access đầu login)
 *  2. /api/accounts/*     — quản lý account (SUPER_ADMIN)
 *  3. /api/units/*        — đơn vị + chức vụ (ADMIN)
 *  4. /api/personnel/*    — quân nhân (ADMIN/MANAGER)
 *  5. /api/annual-rewards, /api/scientific-achievements — input data
 *  6. /api/proposals/*    — đề xuất khen thưởng (MANAGER/ADMIN)
 *  7. /api/decisions/*    — số quyết định
 *  8. /api/awards/*       — danh sách khen thưởng đã duyệt
 *  9. /api/profiles/*     — hồ sơ tính eligibility
 * 10. /api/dashboard/*    — thống kê
 * 11. /api/notifications/* — thông báo real-time
 * 12. /api/dev-zone/*     — admin tools ẩn (SUPER_ADMIN only)
 *
 *  THỨ TỰ MOUNT QUAN TRỌNG (Express match by order):
 *  - /api/awards/units/annual ĐẶT TRƯỚC /api/awards → tránh
 *    awards route bắt nhầm path "units/annual".
 *  - /api/personnel/:id/* (nested) đặt sau /api/personnel để Express
 *    match đúng prefix trước.
 *
 *  404 HANDLER (router.use('*')):
 *  Bắt mọi request không match route trên → trả 404 JSON chuẩn.
 *  Phải đặt CUỐI cùng, sau khi mount tất cả route khác.
 *
 *  HEALTH CHECK:
 *  /health không có auth → load balancer + monitoring tool dùng để check
 *  server alive. Trả 200 + timestamp.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
import personnelNestedRoute from './personnelNested.route';
import proposalRoute from './proposal.route';
import decisionRoute from './decision.route';
import awardsRoute from './awards.route';
import notificationRoute from './notification.route';
import unitAnnualAwardRoute from './unitAnnualAward.route';
import dashboardRoute from './dashboard.route';
import adhocAwardRoute from './adhocAward.route';
import tenureMedalRoute from './tenureMedal.route';
import contributionMedalRoute from './contributionMedal.route';
import commemorativeMedalRoute from './commemorativeMedal.route';
import militaryFlagRoute from './militaryFlag.route';
import unitController from '../controllers/unit.controller';
import { verifyToken, requireAdmin } from '../middlewares/auth';
import devZoneRoute from './devZone.route';
import fileRoute from './file.route';

const router = Router();

// API Routes
// Authentication
router.use('/api/auth', authRoute);

// Account Management (SUPER_ADMIN)
router.use('/api/accounts', accountRoute);

// Master Data Management (units, positions)
router.use('/api/units', unitRoute);
router.use('/api/positions', positionRoute);
router.get('/api/sub-units', verifyToken, requireAdmin, unitController.getAllSubUnits);

// Personnel Management
router.use('/api/personnel', personnelRoute);
router.use('/api/personnel/:personnelId', personnelNestedRoute);
router.use('/api/position-history', positionHistoryRoute);

// Award Management — 7 award types, all mounted top-level for a uniform convention
router.use('/api/annual-rewards', annualRewardRoute);
router.use('/api/unit-annual-awards', unitAnnualAwardRoute);
router.use('/api/tenure-medals', tenureMedalRoute);
router.use('/api/contribution-medals', contributionMedalRoute);
router.use('/api/commemorative-medals', commemorativeMedalRoute);
router.use('/api/military-flags', militaryFlagRoute);
router.use('/api/scientific-achievements', scientificAchievementRoute);
router.use('/api/awards', awardsRoute);
router.use('/api/adhoc-awards', adhocAwardRoute);

// Proposal & Decision Management
router.use('/api/proposals', proposalRoute);
router.use('/api/decisions', decisionRoute);

// Internal file serving via short-lived signed URLs (no static public exposure)
router.use('/api/files', fileRoute);

// Profile & Calculation (Output)
router.use('/api/profiles', profileRoute);
router.use('/api/system-logs', systemLogsRoute);

// Dashboard Statistics
router.use('/api/dashboard', dashboardRoute);

// Notifications
router.use('/api/notifications', notificationRoute);

// Dev Zone (hidden)
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
