import { Router } from 'express';
import { deploymentsController } from './deployments.controller';
import { authenticate, authenticateInternal } from '../../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';

const router = Router({ mergeParams: true }); // mergeParams to access :projectId

function authenticateEither(req: Request, res: Response, next: NextFunction): void {
  const hasInternalKey = req.headers['x-internal-key'];
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');

  if (hasInternalKey) {
    return authenticateInternal(req as any, res, next);
  }
  if (hasBearer) {
    return authenticate(req as any, res, next);
  }

  throw AppError.unauthorized('Authentication required');
}


router.use(authenticate as any);

router.post('/', deploymentsController.create as any);
router.get('/', deploymentsController.list as any);
router.get('/:deploymentId', deploymentsController.get as any);
router.post('/:deploymentId/cancel', deploymentsController.cancel as any);
router.patch('/:deploymentId/status', authenticateEither as any, deploymentsController.updateStatus as any);
// Add to deployments routes
router.get(
  '/:deploymentId/url',
  deploymentsController.getUrl as any
);

export default router;
