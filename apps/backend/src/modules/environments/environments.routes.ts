import { Router } from 'express';
import { EnvironmentsService } from './environments.service';
import { authenticate } from '../../middleware/auth.middleware';
import { sendSuccess, sendCreated } from '../../shared/utils/response';
import { AuthenticatedRequest } from '../../shared/types';
import { RequestHandler } from 'express';
import { requireParam } from '../../shared/utils/request';

const router = Router({ mergeParams: true });
const environmentsService = new EnvironmentsService();

router.use(authenticate as any);

const createEnvironment: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const env = await environmentsService.createEnvironment(
      authReq.user.userId,
      requireParam(req, 'projectId'),
      req.body.name,
      req.body.ttlHours
    );
    sendCreated(res, env);
  } catch (e) { next(e); }
};

const listEnvironments: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const envs = await environmentsService.getEnvironments(
      requireParam(req, 'projectId'),
      authReq.user.userId
    );
    sendSuccess(res, envs);
  } catch (e) { next(e); }
};

const updateTTL: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  try {
    await environmentsService.updateTTL(
      requireParam(req, 'environmentId'),
      requireParam(req, 'projectId'),
      authReq.user.userId,
      req.body.ttlHours
    );
    sendSuccess(res, null, 200, 'TTL updated');
  } catch (e) { next(e); }
};

const destroyEnvironment: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  try {
    await environmentsService.destroyEnvironment(
      requireParam(req, 'environmentId'),
      requireParam(req, 'projectId'),
      authReq.user.userId
    );
    sendSuccess(res, null, 200, 'Environment marked for destruction');
  } catch (e) { next(e); }
};

router.post('/', createEnvironment);
router.get('/', listEnvironments);
router.patch('/:environmentId/ttl', updateTTL);
router.post('/:environmentId/destroy', destroyEnvironment);

export default router;
