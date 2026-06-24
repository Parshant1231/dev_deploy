import { Response, NextFunction } from 'express';
import { EventsService } from './events.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess } from '../../shared/utils/response';
import { requireParam } from '../../shared/utils/request';

const eventsService = new EventsService();

export const eventsController = {
  async getTimeline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const events = await eventsService.getDeploymentTimeline(
        requireParam(req, 'deploymentId')
      );
      sendSuccess(res, events);
    } catch (e) { next(e); }
  },
};
