import { Response, NextFunction } from 'express';
import { OrchestratorService } from './orchestrator.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import { requireParam } from '../../shared/utils/request';

const orchestratorService = new OrchestratorService();

export const orchestratorController = {

  // Manual deployment trigger
  async triggerDeploy(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const projectId = requireParam(req, 'projectId');
      const {
        environment = 'dev',
        commitSha,
        commitMessage = 'Manual deployment',
      } = req.body;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`[DEPLOY] Starting deployment trigger`);
      console.log(`[DEPLOY] User ID: ${req.user.userId}`);
      console.log(`[DEPLOY] Project ID: ${projectId}`);
      console.log(`[DEPLOY] Environment: ${environment}`);
      console.log(`[DEPLOY] Commit SHA: ${commitSha ?? '(none — will resolve from branch)'}`);
      console.log(`${'='.repeat(80)}\n`);

      const deployment = await orchestratorService.orchestrateDeploy({
        projectId,
        userId: req.user.userId,
        environment,
        commitSha: commitSha ?? '',   // backend resolves '' and 'HEAD' to real SHA
        commitMessage,
      });

      console.log(`[DEPLOY] Deployment created successfully: ${deployment.deploymentId}`);
      console.log(`[DEPLOY] Status: ${deployment.status}`);
      console.log(`${'='.repeat(80)}\n`);

      sendCreated(res, deployment, 'Deployment triggered successfully');
    } catch (e) {
      console.log(`[DEPLOY] ERROR during deployment:`, e);
      console.log(`${'='.repeat(80)}\n`);
      next(e);
    }
  },

  // Retry a failed deployment
  async retryDeploy(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const projectId = requireParam(req, 'projectId');
      const deploymentId = requireParam(req, 'deploymentId');

      const deployment = await orchestratorService.retryDeployment(
        deploymentId,
        projectId,
        req.user.userId
      );

      sendCreated(res, deployment, 'Deployment retry triggered');
    } catch (e) {
      next(e);
    }
  },

  // Roll back to a previous deployment
  async rollback(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const projectId = requireParam(req, 'projectId');
      const deploymentId = requireParam(req, 'deploymentId');

      const deployment = await orchestratorService.rollbackDeployment(
        deploymentId,
        projectId,
        req.user.userId
      );

      sendCreated(res, deployment, 'Rollback triggered successfully');
    } catch (e) {
      next(e);
    }
  },
};
