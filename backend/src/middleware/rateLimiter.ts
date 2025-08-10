// Rate Limiting 미들웨어

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import { TooManyRequestsError } from './errorHandler';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

// 기본 레이트 리미터
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip,
    message = 'Too many requests, please try again later'
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const redis = getRedisClient();
      const key = `rate_limit:${keyGenerator(req)}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      if (redis) {
        // Redis를 사용한 분산 레이트 리미팅
        await redis.zRemRangeByScore(key, '-inf', windowStart.toString());
        
        const requestCount = await redis.zCard(key);
        
        if (requestCount >= maxRequests) {
          logger.warn('Rate limit exceeded', {
            key,
            count: requestCount,
            limit: maxRequests,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          
          throw new TooManyRequestsError(message);
        }
        
        // 현재 요청 기록
        await redis.zAdd(key, [{ score: now, value: now.toString() }]);
        await redis.expire(key, Math.ceil(windowMs / 1000));
        
        // 응답 헤더 설정
        const remaining = Math.max(0, maxRequests - requestCount - 1);
        const resetTime = new Date(now + windowMs);
        
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': resetTime.toISOString(),
          'X-RateLimit-Window': Math.ceil(windowMs / 1000).toString()
        });
        
      } else {
        // Redis가 없는 경우 메모리 기반 레이트 리미팅
        if (!req.app.locals.rateLimitStore) {
          req.app.locals.rateLimitStore = new Map();
        }
        
        const store = req.app.locals.rateLimitStore;
        const clientKey = keyGenerator(req);
        const clientData = store.get(clientKey) || { requests: [], windowStart: now };
        
        // 오래된 요청 제거
        clientData.requests = clientData.requests.filter((timestamp: number) => 
          timestamp > windowStart
        );
        
        if (clientData.requests.length >= maxRequests) {
          throw new TooManyRequestsError(message);
        }
        
        // 현재 요청 기록
        clientData.requests.push(now);
        store.set(clientKey, clientData);
        
        // 응답 헤더 설정
        const remaining = Math.max(0, maxRequests - clientData.requests.length);
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
        });
      }
      
      next();
      
    } catch (error) {
      if (error instanceof TooManyRequestsError) {
        next(error);
      } else {
        logger.error('Rate limiter error:', error);
        next(); // 레이트 리미터 에러 시 요청 통과
      }
    }
  };
}

// 기본 레이트 리미터 (전역)
export const rateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15분
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

// API별 특화 레이트 리미터들
export const analyzeRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5분
  maxRequests: 20,
  message: 'Too many analysis requests, please wait before trying again.'
});

export const downloadRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10분
  maxRequests: 5,
  message: 'Too many download requests, please wait before starting another download.'
});

// IP별 다운로드 동시 실행 제한
export const concurrentDownloadLimiter = (req: Request, res: Response, next: NextFunction) => {
  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '3');
  
  if (!req.app.locals.activeDownloads) {
    req.app.locals.activeDownloads = new Map();
  }
  
  const activeDownloads = req.app.locals.activeDownloads;
  const clientKey = req.ip;
  const clientDownloads = activeDownloads.get(clientKey) || 0;
  
  if (clientDownloads >= maxConcurrent) {
    const error = new TooManyRequestsError(
      `Maximum ${maxConcurrent} concurrent downloads allowed per IP`
    );
    return next(error);
  }
  
  // 다운로드 카운트 증가
  activeDownloads.set(clientKey, clientDownloads + 1);
  
  // 응답 완료 시 카운트 감소
  res.on('finish', () => {
    const current = activeDownloads.get(clientKey) || 0;
    if (current > 0) {
      activeDownloads.set(clientKey, current - 1);
    }
  });
  
  next();
};

// 사용자 에이전트 기반 제한 (봇 차단)
export const userAgentLimiter = (req: Request, _res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || '';
  
  // 의심스러운 사용자 에이전트 패턴
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /wget/i,
    /curl/i,
    /python/i,
    /java/i,
    /go-http-client/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  if (isSuspicious) {
    logger.warn('Suspicious user agent blocked', {
      ip: req.ip,
      userAgent,
      url: req.originalUrl
    });
    
    const error = new TooManyRequestsError(
      'Automated requests are not allowed'
    );
    return next(error);
  }
  
  next();
};

// 지역별 제한 (선택사항)
export const geoLimiter = (allowedCountries: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    // CloudFlare의 CF-IPCountry 헤더 사용
    const country = req.get('CF-IPCountry');
    
    if (country && allowedCountries.length > 0 && !allowedCountries.includes(country)) {
      logger.warn('Geographic restriction applied', {
        ip: req.ip,
        country,
        url: req.originalUrl
      });
      
      const error = new TooManyRequestsError(
        'Service not available in your region'
      );
      return next(error);
    }
    
    next();
  };
};

// 레이트 리미터 상태 조회
export const getRateLimitStatus = async (req: Request, res: Response) => {
  try {
    const redis = getRedisClient();
    const ip = req.ip;
    
    if (redis) {
      const globalKey = `rate_limit:${ip}`;
      const analyzeKey = `rate_limit:analyze:${ip}`;
      const downloadKey = `rate_limit:download:${ip}`;
      
      const [globalCount, analyzeCount, downloadCount] = await Promise.all([
        redis.zCard(globalKey),
        redis.zCard(analyzeKey),
        redis.zCard(downloadKey)
      ]);
      
      res.json({
        success: true,
        limits: {
          global: {
            used: globalCount,
            limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
            window: '15 minutes'
          },
          analyze: {
            used: analyzeCount,
            limit: 20,
            window: '5 minutes'
          },
          download: {
            used: downloadCount,
            limit: 5,
            window: '10 minutes'
          }
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Rate limiting status not available (Redis not connected)'
      });
    }
  } catch (error) {
    logger.error('Failed to get rate limit status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit status'
    });
  }
};