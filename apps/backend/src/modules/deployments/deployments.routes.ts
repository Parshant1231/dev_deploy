import { Router } from 'express';
import { deploymentsController } from './deployments.controller';
import { authenticate, authenticateInternal } from '../../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';

const router = Router({ mergeParams: true }); // mergeParams to access :projectId

function authenticateEither(req: Request, res: Response, next: NextFunction): void {
  const hasInternalKey = req.headers['x-internal-key'];
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');

  console.log('[authenticateEither] Headers:', {
    'x-internal-key': hasInternalKey ? 'present' : 'missing',
    'authorization': req.headers.authorization ? 'present' : 'missing'
  });

  if (hasInternalKey) {
    console.log('[authenticateEither] Using internal key auth');
    return authenticateInternal(req as any, res, next);
  }
  if (hasBearer) {
    console.log('[authenticateEither] Using bearer token auth');
    return authenticate(req as any, res, next);
  }

  throw AppError.unauthorized('Authentication required');
}


// Apply authentication per-route instead of globally
router.post('/', authenticate as any, deploymentsController.create as any);
router.get('/', authenticate as any, deploymentsController.list as any);
router.get('/:deploymentId', authenticate as any, deploymentsController.get as any);
router.post('/:deploymentId/cancel', authenticate as any, deploymentsController.cancel as any);
router.patch('/:deploymentId/status', authenticateEither as any, deploymentsController.updateStatus as any);
router.get('/:deploymentId/url', authenticate as any, deploymentsController.getUrl as any);

export default router;
