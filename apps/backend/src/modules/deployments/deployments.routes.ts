import { Router } from 'express';
import { deploymentsController } from './deployments.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true }); // mergeParams to access :projectId

router.use(authenticate as any);

router.post('/', deploymentsController.create as any);
router.get('/', deploymentsController.list as any);
router.get('/:deploymentId', deploymentsController.get as any);
router.post('/:deploymentId/cancel', deploymentsController.cancel as any);
router.patch('/:deploymentId/status', deploymentsController.updateStatus as any);

export default router;