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

  async getMe(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthenticatedRequest;
    try {
      const user = await authService.getMe(authReq.user.userId);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  },

  async connectGithub(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthenticatedRequest;
    try {
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ success: false, error: 'GitHub OAuth code is required' });
        return;
      }
      const user = await authService.connectGithub(authReq.user.userId, code);
      sendSuccess(res, user, 200, 'GitHub account connected successfully');
    } catch (error) {
      next(error);
    }
  },

  async disconnectGithub(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthenticatedRequest;
    try {
      await authService.disconnectGithub(authReq.user.userId);
      sendSuccess(res, null, 200, 'GitHub account disconnected');
    } catch (error) {
      next(error);
    }
  },
};
