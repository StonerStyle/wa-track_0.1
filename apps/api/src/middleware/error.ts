import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string;
  
  // Log error with request ID
  console.error(`[${requestId}] Error:`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'server_error';
  let message = err.message || 'Internal server error';

  // Map specific error types to API error codes
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'bad_request';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'unauthorized';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'not_found';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    errorCode = 'conflict';
  } else if (err.name === 'TooManyRequestsError') {
    statusCode = 429;
    errorCode = 'too_many_requests';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    error: errorCode,
    message: message
  });
};

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  code = 'bad_request';
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  code = 'unauthorized';
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'not_found';
}

export class ConflictError extends Error {
  statusCode = 409;
  code = 'conflict';
}

export class TooManyRequestsError extends Error {
  statusCode = 429;
  code = 'too_many_requests';
}
