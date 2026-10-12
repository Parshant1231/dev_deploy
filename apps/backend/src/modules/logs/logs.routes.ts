import { Router } from 'express';
import { logsController } from './logs.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(authenticate as any);
router.get('/', logsController.getDeploymentLogs as any);

export default router;