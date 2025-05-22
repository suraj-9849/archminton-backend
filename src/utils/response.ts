import { Response } from 'express';
import { ApiResponse } from '../types';

/**
 * Send a standard success response
 */
export const successResponse = <T>(
  res: Response,
  data: T | null = null,
  message = 'Success',
  statusCode = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  res.status(statusCode).json(response);
};

/**
 * Send a standard error response
 */
export const errorResponse = (
  res: Response,
  message = 'An error occurred',
  statusCode = 500,
  errors: any[] = []
): void => {
  const response: ApiResponse<null> = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errors.length > 0) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
};