import { Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils/response';

const metricsService = new MetricsService();

export const metricsController = {
  async getProjectSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await metricsService.getProjectMetricsSummary(
        req.params.projectId as string,
        req.user.userId
      );
      sendSuccess(res, summary);
    } catch (e) {
      next(e);
    }
  },

  async getEcsMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { serviceName, clusterName } = req.query;
      if (!serviceName || !clusterName) {
        res.status(400).json({
          success: false,
          error: 'serviceName and clusterName query parameters are required',
        });
        return;
      }

      const metrics = await metricsService.getEcsResourceMetrics(
        serviceName as string,
        clusterName as string
      );
      sendSuccess(res, metrics);
    } catch (e) {
      next(e);
    }
  },
};