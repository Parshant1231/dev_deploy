import { Request } from 'express';
import { AppError } from '../errors/AppError';

export function requireParam(req: Request, key: string): string {
  const value = req.params[key];

  if (!value || Array.isArray(value)) {
    throw AppError.badRequest(`Missing or invalid route parameter: ${key}`);
  }

  return value;
}
