import { Router } from 'express';
import positionHistoryController from '../controllers/positionHistory.controller';
import { verifyToken, requireManager, requireAuth } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

router.get('/', verifyToken, requireAuth, positionHistoryController.getPositionHistory);
router.post(
  '/',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
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
    action: AUDIT_ACTIONS.UPDATE,
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
    action: AUDIT_ACTIONS.DELETE,
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.deletePositionHistory
);

export default router;
