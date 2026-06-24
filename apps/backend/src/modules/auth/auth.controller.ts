import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendCreated } from '../../shared/utils/response';

const authService = new AuthService();

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      sendCreated(res, result, 'Account created successfully');
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result, 200, 'Login successful');
    } catch (error) {
      next(error);
    }
  },

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user.userId);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  },

  async connectGithub(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, error: 'GitHub OAuth code is required' });
        return;
      }
      const user = await authService.connectGithub(req.user.userId, code);
      sendSuccess(res, user, 200, 'GitHub account connected successfully');
    } catch (error) {
      next(error);
    }
  },

  async disconnectGithub(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await authService.disconnectGithub(req.user.userId);
      sendSuccess(res, null, 200, 'GitHub account disconnected');
    } catch (error) {
      next(error);
    }
  },
};