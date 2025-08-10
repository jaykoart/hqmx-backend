// 요청 로깅 미들웨어

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// 요청 ID 생성 및 로깅
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // 요청에 ID 추가
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // 민감한 정보 필터링
  const sanitizedBody = sanitizeRequestBody(req.body);
  const sanitizedQuery = sanitizeQuery(req.query);

  // 요청 로깅
  logger.info('HTTP Request Started', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    body: sanitizedBody,
    query: sanitizedQuery,
    headers: {
      'accept': req.get('Accept'),
      'accept-language': req.get('Accept-Language'),
      'accept-encoding': req.get('Accept-Encoding')
    }
  });

  // 응답 완료 시 로깅
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    const responseSize = Buffer.byteLength(data || '', 'utf8');
    
    // 응답 로깅
    logger.info('HTTP Request Completed', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: `${responseSize} bytes`,
      ip: getClientIP(req)
    });

    // 성능 경고 (2초 이상)
    if (duration > 2000) {
      logger.warn('Slow Request Detected', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode
      });
    }

    // 에러 상태 코드 로깅
    if (res.statusCode >= 400) {
      const logLevel = res.statusCode >= 500 ? 'error' : 'warn';
      logger[logLevel]('HTTP Error Response', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: getClientIP(req),
        userAgent: req.get('User-Agent')
      });
    }

    return originalSend.call(this, data);
  };

  // 요청 타임아웃 감지
  const timeout = setTimeout(() => {
    logger.error('Request Timeout', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      duration: `${Date.now() - startTime}ms`,
      ip: getClientIP(req)
    });
  }, 30000); // 30초

  // 응답 완료 시 타임아웃 정리
  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
}

// 클라이언트 IP 추출 (프록시 고려)
function getClientIP(req: Request): string {
  return (
    req.get('CF-Connecting-IP') || // Cloudflare
    req.get('X-Forwarded-For')?.split(',')[0] || // 프록시
    req.get('X-Real-IP') || // Nginx
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// 요청 본문에서 민감한 정보 제거
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'authorization',
    'cookie',
    'session'
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // URL 파라미터에서도 민감한 정보 제거
  if (sanitized.url && typeof sanitized.url === 'string') {
    try {
      const url = new URL(sanitized.url);
      if (url.searchParams.has('auth') || url.searchParams.has('token')) {
        // 민감한 쿼리 파라미터가 있으면 도메인만 표시
        sanitized.url = `${url.protocol}//${url.hostname}${url.pathname}`;
      }
    } catch {
      // URL 파싱 실패 시 원본 유지
    }
  }

  return sanitized;
}

// 쿼리 파라미터에서 민감한 정보 제거
function sanitizeQuery(query: any): any {
  if (!query || typeof query !== 'object') {
    return query;
  }

  const sensitiveFields = ['token', 'key', 'secret', 'auth', 'password'];
  const sanitized = { ...query };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// API 별 특화 로거
export function apiLogger(apiName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    logger.info(`${apiName} API Called`, {
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.originalUrl,
      ip: getClientIP(req)
    });

    // 응답 후 API별 메트릭 로깅
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info(`${apiName} API Completed`, {
        requestId: req.headers['x-request-id'],
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        success: res.statusCode < 400
      });
    });

    next();
  };
}

// 다운로드 진행상황 로거
export function downloadProgressLogger(req: Request, res: Response, next: NextFunction): void {
  const taskId = req.params.taskId;
  
  if (taskId) {
    logger.info('Download Progress Monitoring Started', {
      taskId,
      requestId: req.headers['x-request-id'],
      ip: getClientIP(req)
    });

    res.on('close', () => {
      logger.info('Download Progress Monitoring Ended', {
        taskId,
        requestId: req.headers['x-request-id'],
        reason: 'Client disconnected'
      });
    });
  }

  next();
}

// 에러 로깅 헬퍼
export function logError(error: Error, req: Request, additionalInfo: any = {}): void {
  logger.error('Application Error', {
    requestId: req.headers['x-request-id'],
    method: req.method,
    url: req.originalUrl,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...additionalInfo
  });
}

// 보안 관련 로깅
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/var\/|\/usr\/)/i, // Path traversal
    /(<script|javascript:|onerror=)/i, // XSS attempts
    /(union|select|insert|update|delete|drop)/i, // SQL injection
    /(eval\(|system\(|exec\()/i // Code injection
  ];

  const fullUrl = req.originalUrl;
  const body = JSON.stringify(req.body);
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(fullUrl) || pattern.test(body)
  );

  if (isSuspicious) {
    logger.warn('Suspicious Request Detected', {
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.originalUrl,
      ip: getClientIP(req),
      userAgent: req.get('User-Agent'),
      body: req.body,
      reason: 'Suspicious patterns detected'
    });
  }

  next();
}