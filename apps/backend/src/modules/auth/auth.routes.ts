import { RequestHandler, Router } from 'express';
import { authController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { registerSchema, loginSchema } from './auth.schemas';
import { config } from '../../config/env';
import { createGithubClient, listUserRepositories } from '../../shared/utils/githubApi';
import { encryptToken } from '../../shared/utils/crypto';
import axios from 'axios';

const router = Router();
const authService = new AuthService();
const authRepo = new AuthRepository();

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

// ─────────────────────────────────────────────
// PROTECTED ROUTES
// ─────────────────────────────────────────────
router.get('/me', authenticate, authController.getMe);
router.post('/github/connect', authenticate, authController.connectGithub);
router.delete('/github/disconnect', authenticate, authController.disconnectGithub);

// ─────────────────────────────────────────────
// GITHUB PAT CONNECT
// Connects a GitHub Personal Access Token directly.
// Useful for CLI / testing without full OAuth flow.
// Token needs scopes: repo, workflow
// ─────────────────────────────────────────────
router.post('/github/connect-pat', authenticate, async (req: any, res, next) => {
  try {
    const { token: pat } = req.body;
    if (!pat) {
      res.status(400).json({ success: false, error: 'token (Personal Access Token) is required' });
      return;
    }

    // Validate PAT by calling GitHub API
    const ghRes = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const ghUser = ghRes.data;

    // Store encrypted token + GitHub profile
    await authRepo.updateGithubConnection(req.user.userId, {
      githubId: String(ghUser.id),
      githubLogin: ghUser.login,
      githubToken: encryptToken(pat),
      avatarUrl: ghUser.avatar_url,
    });

    res.json({
      success: true,
      data: { githubUsername: ghUser.login, githubId: String(ghUser.id) },
      message: `GitHub account @${ghUser.login} connected successfully`,
    });
  } catch (e: any) {
    if (e.response?.status === 401) {
      res.status(401).json({ success: false, error: 'Invalid GitHub token' });
      return;
    }
    next(e);
  }
});

// ─────────────────────────────────────────────
// GITHUB OAUTH CALLBACK
// GitHub redirects here after the user authorizes.
// This is a PUBLIC route — the browser cannot attach a JWT.
// The 'code' query param is exchanged for an access token.
// 'state' param carries the userId set before redirecting.
// ─────────────────────────────────────────────
const githubCallback: RequestHandler = async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      res.status(400).json({ success: false, error: 'Missing OAuth code' });
      return;
    }

    if (!state) {
      res.status(400).json({ success: false, error: 'Missing state parameter (userId)' });
      return;
    }

    await authService.connectGithub(String(state), String(code));
    res.redirect(`${config.frontendUrl}/settings/github?connected=true`);
  } catch (error) {
    next(error);
  }
};

router.get('/github/callback', githubCallback);

// ─────────────────────────────────────────────
// LIST GITHUB REPOSITORIES
// Returns repos accessible to the connected GitHub account.
// ─────────────────────────────────────────────
router.get('/github/repos', authenticate, async (req: any, res, next) => {
  try {
    const user = await authRepo.findById(req.user.userId);

    if (!user?.githubToken) {
      res.status(400).json({
        success: false,
        error: 'GitHub account not connected. Use POST /auth/github/connect-pat first.',
      });
      return;
    }

    const client = createGithubClient(user.githubToken);
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const repos = await listUserRepositories(client, page);

    res.json({ success: true, data: repos });
  } catch (e) {
    next(e);
  }
});

export default router;
