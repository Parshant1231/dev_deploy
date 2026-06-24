import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes';

const app = express();

// ─────────────────────────────────────────────
// SECURITY MIDDLEWARE
// Helmet sets 11 security-related HTTP headers automatically.
// Always place helmet() first.
// ─────────────────────────────────────────────
app.use(helmet());

// ─────────────────────────────────────────────
// CORS
// Allow requests from the frontend domain only.
// ─────────────────────────────────────────────
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─────────────────────────────────────────────
// REQUEST PARSING
// ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// REQUEST LOGGING
// ─────────────────────────────────────────────
if (!config.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─────────────────────────────────────────────
// HEALTH CHECK
// Must exist before auth middleware.
// This is what the ALB pings every 30 seconds.
// If this returns non-200, the ALB marks the task unhealthy.
// ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'devdeploy-api',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.use('/api/v1', routes);

// ─────────────────────────────────────────────
// ERROR HANDLERS
// Must be LAST. After all routes.
// ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;