import { Router } from 'express';
import { metricsController } from './metrics.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(authenticate as any);
router.get('/summary', metricsController.getProjectSummary as any);
router.get('/ecs', metricsController.getEcsMetrics as any);

export default router;