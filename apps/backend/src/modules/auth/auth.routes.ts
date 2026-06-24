import { RequestHandler, Router } from 'express';
import { authController } from './auth.controller';
import { AuthService } from './auth.service';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { registerSchema, loginSchema } from './auth.schemas';
import { config } from '../../config/env';
import { AuthenticatedRequest } from '../../shared/types';

const router = Router();
const authService = new AuthService();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.post('/github/connect', authenticate, authController.connectGithub);
router.delete('/github/disconnect', authenticate, authController.disconnectGithub);
// OAuth callback — GitHub redirects here after user authorizes
// The 'code' parameter is exchanged for an access token
const githubCallback: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { code } = req.query;
    if (!code) {
      res.status(400).json({ success: false, error: 'Missing OAuth code' });
      return;
    }
    await authService.connectGithub(authReq.user.userId, String(code));
    // In production, redirect to the frontend dashboard
    res.redirect(`${config.frontendUrl}/settings/github?connected=true`);
  } catch (error) {
    next(error);
  }
};

router.get('/github/callback', authenticate, githubCallback);

export default router;
