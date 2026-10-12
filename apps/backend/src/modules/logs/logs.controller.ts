import { Response, NextFunction } from 'express';
import { LogsService } from './logs.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils/response';

const logsService = new LogsService();

export const logsController = {
  async getDeploymentLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { projectId, deploymentId } = req.params as { projectId: string; deploymentId: string };
      const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;

      const logs = await logsService.getDeploymentLogs(
        deploymentId,
        projectId,
        req.user.userId,
        { since }
      );

      sendSuccess(res, logs);
    } catch (e) {
      next(e);
    }
  },
};