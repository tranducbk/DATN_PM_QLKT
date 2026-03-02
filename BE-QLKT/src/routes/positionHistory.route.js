const express = require('express');
const router = express.Router();
const positionHistoryController = require('../controllers/positionHistory.controller');
const { verifyToken, requireManager, requireAuth } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLogHelper');

router.get('/', verifyToken, requireAuth, positionHistoryController.getPositionHistory);
router.post(
  '/',
  verifyToken,
  requireManager,
  auditLog({
    action: 'CREATE',
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  positionHistoryController.createPositionHistory
);
router.put(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: 'UPDATE',
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.updatePositionHistory
);
router.delete(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: 'DELETE',
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.deletePositionHistory
);

module.exports = router;
