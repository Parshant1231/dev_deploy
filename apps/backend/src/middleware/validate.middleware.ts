import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError';

// Generic validation middleware factory.
// Usage: router.post('/login', validate(loginSchema), controller)
//
// Zod validates the request body against the schema.
// If validation fails, Zod returns detailed error messages
// like "email: Required" or "password: Too short".
// If validation passes, req.body is replaced with the
// parsed (and type-safe) result.

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        throw AppError.badRequest(`Validation failed: ${messages}`);
      }
      next(error);
    }
  };
}
