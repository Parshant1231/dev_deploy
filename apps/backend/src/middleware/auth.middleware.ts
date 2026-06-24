import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from '../shared/errors/AppError';
import { AuthenticatedRequest } from '../shared/types';

interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// This middleware extracts and verifies the JWT from the
// Authorization header. If valid, it attaches the decoded
// user to req.user so route handlers can access the
// authenticated user's ID without re-querying the database.

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    (req as AuthenticatedRequest).user = {
      userId: decoded.userId,
      email: decoded.email,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw AppError.unauthorized('Invalid token');
    }
    throw AppError.unauthorized('Authentication failed');
  }
}


// Internal API key middleware for machine-to-machine calls.
// Used by GitHub Actions to update deployment status.
// Not for user-facing routes.

export function authenticateInternal(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const internalKey = req.headers['x-internal-key'];

  if (!internalKey || internalKey !== process.env.DEVDEPLOY_INTERNAL_KEY) {
    throw AppError.unauthorized('Invalid internal API key');
  }

  next();
}