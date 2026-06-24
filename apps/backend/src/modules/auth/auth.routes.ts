import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { registerSchema, loginSchema } from './auth.schemas';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

// Protected routes
router.get('/me', authenticate, authController.getMe as any);
router.post('/github/connect', authenticate, authController.connectGithub as any);
router.delete('/github/disconnect', authenticate, authController.disconnectGithub as any);

export default router;