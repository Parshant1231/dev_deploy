import { Router } from 'express';
import { handleGithubWebhook } from './webhook.handler';

const router = Router();

// Webhook route is PUBLIC — no JWT required.
// Security is handled by the HMAC signature verification
// inside the handler itself.
router.post('/github', handleGithubWebhook);

export default router;