// 에러 처리 미들웨어

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { ErrorDetails } from '../types/common';

// 커스텀 에러 클래스
export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || undefined;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 에러 타입별 처리
export function errorHandler(error: any, req: Request, res: Response, _next: NextFunction): void {
  let err = { ...error };
  err.message = error.message;

  // 기본 에러 정보
  const errorDetails: ErrorDetails = {
    message: err.message || 'Internal Server Error',
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] as string || 'unknown'
  };

  // 상태 코드 결정
  let statusCode = 500;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorDetails.code = error.code || undefined;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorDetails.message = 'Validation Error';
    errorDetails.code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorDetails.message = 'Invalid ID format';
    errorDetails.code = 'INVALID_ID';
  } else if (error.code === 'ENOENT') {
    statusCode = 404;
    errorDetails.message = 'File not found';
    errorDetails.code = 'FILE_NOT_FOUND';
  } else if (error.code === 'EACCES') {
    statusCode = 403;
    errorDetails.message = 'Permission denied';
    errorDetails.code = 'PERMISSION_DENIED';
  } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    statusCode = 503;
    errorDetails.message = 'Too many open files';
    errorDetails.code = 'RESOURCE_EXHAUSTED';
  } else if (error.code === 'ENOSPC') {
    statusCode = 507;
    errorDetails.message = 'Insufficient storage space';
    errorDetails.code = 'STORAGE_FULL';
  }

  // 개발 환경에서는 스택 트레이스 포함
  if (process.env.NODE_ENV === 'development') {
    errorDetails.stack = error.stack;
  }

  // 에러 로깅
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode,
    errorCode: errorDetails.code,
    message: errorDetails.message,
    stack: error.stack
  };

  if (statusCode >= 500) {
    logger.error('Server Error:', logData);
  } else {
    logger.warn('Client Error:', logData);
  }

  // 응답 전송
  const response = {
    success: false,
    error: errorDetails.message,
    code: errorDetails.code,
    timestamp: errorDetails.timestamp,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: errorDetails.stack,
      details: error 
    })
  };

  res.status(statusCode).json(response);
}

// 404 에러 핸들러
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
}

// 비동기 에러 처리 래퍼
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 특정 에러 타입 생성자들
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

// 에러 상황별 핸들러
export function handleDiskSpaceError(_req: Request, _res: Response, next: NextFunction): void {
  const error = new ServiceUnavailableError('Insufficient disk space for processing');
  next(error);
}

export function handleNetworkError(err: any, _req: Request, _res: Response, next: NextFunction): void {
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    const error = new ServiceUnavailableError('Network connection failed');
    next(error);
  } else {
    next(err);
  }
}

export function handleTimeoutError(_req: Request, _res: Response, next: NextFunction): void {
  const error = new AppError('Request timeout', 408, 'REQUEST_TIMEOUT');
  next(error);
}

// 프로세스 레벨 에러 핸들러
export function setupProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString()
    });
    
    // 프로덕션에서는 graceful shutdown
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack
    });
    
    // 항상 프로세스 종료 (복구 불가능한 상태)
    process.exit(1);
  });
}