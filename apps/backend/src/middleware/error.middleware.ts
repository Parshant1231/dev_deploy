import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { config } from '../config/env';

// The global error handler is the last middleware in the chain.
// Any error thrown or passed to next() lands here.
//
// This is critical for production:
// - AppErrors (operational errors) return the message to the client
// - Unknown errors return a generic message (never expose internals)
// - Stack traces are only included in development mode

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
    return;
  }

  // Log unexpected errors — these are bugs, not user errors
  console.error('Unexpected error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: config.isProduction
      ? 'Internal server error'
      : error.message,
    ...(config.isProduction ? {} : { stack: error.stack }),
  });
}

// Handler for routes that don't exist
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}