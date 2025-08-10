import { logger } from '../utils/logger';
import { getRedisClient } from '../utils/redis';
import { behaviorAnalyzer } from './behaviorAnalysisService';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessful?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  skip?: (req: any) => boolean;
  onLimitReached?: (req: any) => void;
}

interface AdaptiveRateLimitConfig {
  baseConfig: RateLimitConfig;
  adaptiveFactors: {
    userBehavior: number; // 0.1 - 2.0
    timeOfDay: number; // 0.5 - 1.5
    platformLoad: number; // 0.3 - 2.0
    successRate: number; // 0.2 - 3.0
  };
}

interface YouTubeDetectionPattern {
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  adaptationStrategy: 'slow_down' | 'change_method' | 'wait' | 'proxy_switch';
  cooldownMs: number;
}

// YouTube 감지 패턴 데이터베이스
const YOUTUBE_DETECTION_PATTERNS: YouTubeDetectionPattern[] = [
  {
    pattern: 'Sign in to confirm you\'re not a bot',
    severity: 'high',
    adaptationStrategy: 'wait',
    cooldownMs: 300000 // 5분
  },
  {
    pattern: 'Too Many Requests',
    severity: 'medium',
    adaptationStrategy: 'slow_down',
    cooldownMs: 120000 // 2분
  },
  {
    pattern: 'Service Unavailable',
    severity: 'medium',
    adaptationStrategy: 'change_method',
    cooldownMs: 60000 // 1분
  },
  {
    pattern: 'Access Denied',
    severity: 'high',
    adaptationStrategy: 'proxy_switch',
    cooldownMs: 180000 // 3분
  },
  {
    pattern: 'Unusual traffic',
    severity: 'high',
    adaptationStrategy: 'wait',
    cooldownMs: 600000 // 10분
  }
];

export class IntelligentRateLimiter {
  private redis = getRedisClient();
  private detectionHistory: Map<string, YouTubeDetectionPattern[]> = new Map();
  private adaptiveConfigs: Map<string, AdaptiveRateLimitConfig> = new Map();

  constructor() {
    // 감지 패턴 학습을 위한 정기 분석
    setInterval(() => {
      this.analyzeDetectionPatterns();
    }, 300000); // 5분마다
  }

  // 지능형 레이트 리미팅 적용
  async applyIntelligentRateLimit(req: any, endpoint: string): Promise<{ allowed: boolean; waitTime?: number; reason?: string }> {
    try {
      const userId = this.extractUserId(req);
      const clientIP = this.extractClientIP(req);
      const key = `${endpoint}:${userId || clientIP}`;

      // 사용자 행동 분석
      const userRiskScore = await behaviorAnalyzer.getUserRiskScore(userId || clientIP);
      const isBotUser = await behaviorAnalyzer.isBotUser(userId || clientIP);

      // 적응형 설정 가져오기
      const adaptiveConfig = await this.getAdaptiveConfig(endpoint, userRiskScore, isBotUser);

      // 현재 요청 수 확인
      const currentRequests = await this.getCurrentRequestCount(key, adaptiveConfig.baseConfig.windowMs);

      // 동적 한도 계산
      const dynamicLimit = await this.calculateDynamicLimit(adaptiveConfig, req);

      if (currentRequests >= dynamicLimit) {
        const waitTime = await this.calculateWaitTime(key, adaptiveConfig);
        
        logger.warn(`Rate limit exceeded for ${key}: ${currentRequests}/${dynamicLimit}, wait: ${waitTime}ms`);
        
        return {
          allowed: false,
          waitTime,
          reason: `Rate limit exceeded. Dynamic limit: ${dynamicLimit}, current: ${currentRequests}`
        };
      }

      // 요청 카운터 증가
      await this.incrementRequestCount(key, adaptiveConfig.baseConfig.windowMs);

      return { allowed: true };

    } catch (error) {
      logger.error(`Intelligent rate limiting failed: ${error}`);
      return { allowed: true }; // 에러 시 허용
    }
  }

  // YouTube 감지 패턴 학습
  async learnFromYouTubeResponse(response: string, endpoint: string, userId: string): Promise<void> {
    try {
      const detectedPatterns = YOUTUBE_DETECTION_PATTERNS.filter(pattern => 
        response.includes(pattern.pattern)
      );

      if (detectedPatterns.length > 0) {
        logger.info(`YouTube detection patterns found: ${detectedPatterns.map(p => p.pattern).join(', ')}`);

        // 감지 히스토리 업데이트
        const history = this.detectionHistory.get(userId) || [];
        history.push(...detectedPatterns.map(p => ({
          ...p,
          timestamp: Date.now()
        })));
        this.detectionHistory.set(userId, history);

        // Redis에 감지 이력 저장
        await this.redis.setEx(
          `detection_history:${userId}`,
          86400, // 24시간
          JSON.stringify(history)
        );

        // 적응 전략 적용
        for (const pattern of detectedPatterns) {
          await this.applyAdaptationStrategy(pattern, endpoint, userId);
        }
      }
    } catch (error) {
      logger.error(`Failed to learn from YouTube response: ${error}`);
    }
  }

  // 적응 전략 적용
  private async applyAdaptationStrategy(pattern: YouTubeDetectionPattern, endpoint: string, userId: string): Promise<void> {
    const strategyKey = `strategy:${endpoint}:${userId}`;

    switch (pattern.adaptationStrategy) {
      case 'slow_down':
        // 요청 속도 50% 감소
        await this.redis.setEx(`slowdown:${userId}`, pattern.cooldownMs / 1000, '0.5');
        logger.info(`Applied slow_down strategy for ${userId}`);
        break;

      case 'change_method':
        // 추출 방법 변경 플래그
        await this.redis.setEx(`change_method:${userId}`, pattern.cooldownMs / 1000, 'true');
        logger.info(`Applied change_method strategy for ${userId}`);
        break;

      case 'wait':
        // 대기 시간 설정
        await this.redis.setEx(`wait:${userId}`, pattern.cooldownMs / 1000, pattern.cooldownMs.toString());
        logger.info(`Applied wait strategy for ${userId}: ${pattern.cooldownMs}ms`);
        break;

      case 'proxy_switch':
        // 프록시 변경 플래그
        await this.redis.setEx(`proxy_switch:${userId}`, pattern.cooldownMs / 1000, 'true');
        logger.info(`Applied proxy_switch strategy for ${userId}`);
        break;
    }

    // 전역 쿨다운 설정
    await this.redis.setEx(`cooldown:${userId}`, pattern.cooldownMs / 1000, 'true');
  }

  // 적응형 설정 가져오기
  private async getAdaptiveConfig(endpoint: string, userRiskScore: number, isBotUser: boolean): Promise<AdaptiveRateLimitConfig> {
    const cacheKey = `adaptive_config:${endpoint}`;
    const cached = this.adaptiveConfigs.get(cacheKey);

    if (cached) return cached;

    // 기본 설정
    let baseConfig: RateLimitConfig = {
      windowMs: 60000, // 1분
      maxRequests: 10
    };

    // 엔드포인트별 설정
    switch (endpoint) {
      case 'analyze':
        baseConfig = { windowMs: 60000, maxRequests: 5 };
        break;
      case 'download':
        baseConfig = { windowMs: 300000, maxRequests: 3 }; // 5분에 3개
        break;
      case 'user-analyze':
        baseConfig = { windowMs: 30000, maxRequests: 2 }; // 30초에 2개
        break;
    }

    // 적응형 팩터 계산
    const adaptiveFactors = {
      userBehavior: this.calculateBehaviorFactor(userRiskScore, isBotUser),
      timeOfDay: await this.calculateTimeOfDayFactor(),
      platformLoad: await this.calculatePlatformLoadFactor(),
      successRate: await this.calculateSuccessRateFactor(endpoint)
    };

    const config: AdaptiveRateLimitConfig = {
      baseConfig,
      adaptiveFactors
    };

    this.adaptiveConfigs.set(cacheKey, config);
    
    // 5분 후 캐시 만료
    setTimeout(() => {
      this.adaptiveConfigs.delete(cacheKey);
    }, 300000);

    return config;
  }

  // 동적 한도 계산
  private async calculateDynamicLimit(config: AdaptiveRateLimitConfig, req: any): Promise<number> {
    const baseLimit = config.baseConfig.maxRequests;
    const factors = config.adaptiveFactors;

    // 모든 팩터 적용
    let dynamicLimit = baseLimit * factors.userBehavior * factors.timeOfDay * factors.platformLoad * factors.successRate;

    // 최소/최대 한도 적용
    dynamicLimit = Math.max(1, Math.min(dynamicLimit, baseLimit * 3));

    // 쿨다운 상태 확인
    const userId = this.extractUserId(req) || this.extractClientIP(req);
    const isInCooldown = await this.redis.exists(`cooldown:${userId}`);
    
    if (isInCooldown) {
      dynamicLimit = Math.max(1, dynamicLimit * 0.1); // 90% 감소
    }

    return Math.floor(dynamicLimit);
  }

  // 행동 팩터 계산
  private calculateBehaviorFactor(riskScore: number, isBotUser: boolean): number {
    if (isBotUser) return 0.1; // 봇은 90% 제한
    
    // 위험도에 따른 팩터 (0.1 ~ 2.0)
    return Math.max(0.1, 2.0 - riskScore * 1.9);
  }

  // 시간대 팩터 계산
  private async calculateTimeOfDayFactor(): Promise<number> {
    const hour = new Date().getHours();
    
    // 피크 시간대 (오후 7-11시)는 제한적
    if (hour >= 19 && hour <= 23) {
      return 0.7;
    }
    
    // 새벽 시간대 (오전 2-6시)는 관대
    if (hour >= 2 && hour <= 6) {
      return 1.5;
    }
    
    return 1.0;
  }

  // 플랫폼 로드 팩터 계산
  private async calculatePlatformLoadFactor(): Promise<number> {
    try {
      // 현재 활성 요청 수 확인
      const activeRequests = await this.redis.get('active_requests_count') || '0';
      const count = parseInt(activeRequests);
      
      // 로드에 따른 팩터 조정
      if (count > 100) return 0.3; // 높은 로드
      if (count > 50) return 0.6;  // 중간 로드
      if (count < 10) return 1.8;  // 낮은 로드
      
      return 1.0;
    } catch (error) {
      return 1.0;
    }
  }

  // 성공률 팩터 계산
  private async calculateSuccessRateFactor(endpoint: string): Promise<number> {
    try {
      const successKey = `success_rate:${endpoint}`;
      const successData = await this.redis.get(successKey);
      
      if (successData) {
        const { success, total } = JSON.parse(successData);
        const rate = success / total;
        
        // 성공률이 높으면 더 관대하게
        if (rate > 0.8) return 1.5;
        if (rate > 0.6) return 1.2;
        if (rate < 0.3) return 0.5; // 성공률이 낮으면 제한적
      }
      
      return 1.0;
    } catch (error) {
      return 1.0;
    }
  }

  // 현재 요청 수 확인
  private async getCurrentRequestCount(key: string, windowMs: number): Promise<number> {
    try {
      const count = await this.redis.get(`rate_limit:${key}`) || '0';
      return parseInt(count);
    } catch (error) {
      return 0;
    }
  }

  // 요청 카운터 증가
  private async incrementRequestCount(key: string, windowMs: number): Promise<void> {
    const redisKey = `rate_limit:${key}`;
    const current = await this.redis.incr(redisKey);
    
    if (current === 1) {
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }
  }

  // 대기 시간 계산
  private async calculateWaitTime(key: string, config: AdaptiveRateLimitConfig): Promise<number> {
    const baseWait = config.baseConfig.windowMs;
    const jitter = Math.random() * 0.3 + 0.85; // 85-115% 범위의 지터
    
    return Math.floor(baseWait * jitter);
  }

  // 감지 패턴 분석
  private async analyzeDetectionPatterns(): Promise<void> {
    try {
      logger.info('Analyzing YouTube detection patterns...');
      
      // 모든 사용자의 감지 히스토리 분석
      for (const [userId, patterns] of this.detectionHistory.entries()) {
        const recentPatterns = patterns.filter(p => 
          Date.now() - (p as any).timestamp < 3600000 // 1시간 내
        );
        
        if (recentPatterns.length > 3) {
          // 패턴 빈도가 높으면 전역 대응 전략 조정
          await this.adjustGlobalStrategy(recentPatterns);
        }
      }
      
    } catch (error) {
      logger.error(`Detection pattern analysis failed: ${error}`);
    }
  }

  // 전역 전략 조정
  private async adjustGlobalStrategy(patterns: YouTubeDetectionPattern[]): Promise<void> {
    const highSeverityCount = patterns.filter(p => p.severity === 'high').length;
    
    if (highSeverityCount > 2) {
      // 전역 슬로우다운 적용
      await this.redis.setEx('global_slowdown', 1800, '0.3'); // 30분간 70% 감속
      logger.warn('Applied global slowdown due to high detection rate');
    }
  }

  // 사용자 ID 추출
  private extractUserId(req: any): string | null {
    return req.user?.id || req.session?.userId || null;
  }

  // 클라이언트 IP 추출
  private extractClientIP(req: any): string {
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  // 성공률 업데이트
  async updateSuccessRate(endpoint: string, success: boolean): Promise<void> {
    try {
      const key = `success_rate:${endpoint}`;
      const data = await this.redis.get(key);
      
      let stats = { success: 0, total: 0 };
      if (data) {
        stats = JSON.parse(data);
      }
      
      stats.total++;
      if (success) {
        stats.success++;
      }
      
      // 최근 1000개 요청만 유지
      if (stats.total > 1000) {
        stats.success = Math.floor(stats.success * 0.9);
        stats.total = 900;
      }
      
      await this.redis.setEx(key, 86400, JSON.stringify(stats));
    } catch (error) {
      logger.error(`Failed to update success rate: ${error}`);
    }
  }

  // 쿨다운 상태 확인
  async isInCooldown(userId: string): Promise<boolean> {
    return await this.redis.exists(`cooldown:${userId}`) > 0;
  }

  // 대기 시간 확인
  async getWaitTime(userId: string): Promise<number> {
    const waitData = await this.redis.get(`wait:${userId}`);
    return waitData ? parseInt(waitData) : 0;
  }
}

// 글로벌 지능형 레이트 리미터 인스턴스
export const intelligentRateLimiter = new IntelligentRateLimiter();
