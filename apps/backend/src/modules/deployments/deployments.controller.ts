import { Response, NextFunction } from 'express';
import { DeploymentsService } from './deployments.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import { requireParam } from '../../shared/utils/request';

const deploymentsService = new DeploymentsService();

export const deploymentsController = {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const deployment = await deploymentsService.createDeployment(
        req.user.userId,
        requireParam(req, 'projectId'),
        {
          environment: req.body.environment ?? 'dev',
          commitSha: req.body.commitSha,
          commitMessage: req.body.commitMessage,
        }
      );
      sendCreated(res, deployment, 'Deployment created');
    } catch (e) { next(e); }
  },

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const deployments = await deploymentsService.getDeployments(
        requireParam(req, 'projectId'),
        req.user.userId
      );
      sendSuccess(res, deployments);
    } catch (e) { next(e); }
  },

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const deployment = await deploymentsService.getDeployment(
        requireParam(req, 'deploymentId'),
        requireParam(req, 'projectId'),
        req.user.userId
      );
      sendSuccess(res, deployment);
    } catch (e) { next(e); }
  },

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await deploymentsService.cancelDeployment(
        requireParam(req, 'deploymentId'),
        requireParam(req, 'projectId'),
        req.user.userId
      );
      sendSuccess(res, null, 200, 'Deployment cancelled');
    } catch (e) { next(e); }
  },

  // Internal endpoint called by GitHub Actions pipeline
  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await deploymentsService.updateDeploymentStatus(
        requireParam(req, 'deploymentId'),
        requireParam(req, 'projectId'),
        req.body.status,
        req.body.data
      );
      sendSuccess(res, null, 200, 'Status updated');
    } catch (e) { next(e); }
  },
};
