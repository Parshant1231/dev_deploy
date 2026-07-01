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

      if (!commitSha) {
        res.status(400).json({
          success: false,
          error: 'commitSha is required',
        });
        return;
      }

      const deployment = await orchestratorService.orchestrateDeploy({
        projectId,
        userId: req.user.userId,
        environment,
        commitSha,
        commitMessage,
      });

      sendCreated(res, deployment, 'Deployment triggered successfully');
    } catch (e) {
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
