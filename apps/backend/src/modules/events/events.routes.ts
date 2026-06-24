import { Router } from 'express';
import { eventsController } from './events.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(authenticate as any);
router.get('/', eventsController.getTimeline as any);

export default router;