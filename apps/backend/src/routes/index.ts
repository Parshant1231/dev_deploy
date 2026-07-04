import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import projectsRoutes from '../modules/projects/projects.routes';
import deploymentsRoutes from '../modules/deployments/deployments.routes';
import environmentsRoutes from '../modules/environments/environments.routes';
import eventsRoutes from '../modules/events/events.routes';
import webhookRoutes from '../modules/webhooks/webhook.routes';
import logsRoutes from '../modules/logs/logs.routes';
import metricsRoutes from '../modules/metrics/metrics.routes';


const router = Router();

router.use('/auth', authRoutes);
router.use('/projects', projectsRoutes);
router.use('/projects/:projectId/deployments', deploymentsRoutes);
router.use('/projects/:projectId/deployments/:deploymentId/events', eventsRoutes);
router.use('/projects/:projectId/environments', environmentsRoutes);
router.use('/webhooks', webhookRoutes);
router.use(
  '/projects/:projectId/deployments/:deploymentId/logs',
  logsRoutes
);
router.use('/projects/:projectId/metrics', metricsRoutes);


export default router;
