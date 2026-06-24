import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

// Centralizing response formatting means if you ever
// need to add a request ID or timestamp to every response,
// you change one function.

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  message?: string
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, 201, message);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { limit: number; nextCursor?: string }
): void {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
  };
  res.status(200).json(response);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}