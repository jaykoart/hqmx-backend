import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;

// Redis 클라이언트 생성 및 연결 (향상된 에러 처리)
export async function connectRedis(): Promise<RedisClientType | null> {
  try {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.info('🟡 Redis URL not provided, running without cache');
      return null;
    }

    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) { // 재시도 횟수 줄임
            logger.warn('🟡 Redis connection failed, continuing without cache');
            return false; // 재연결 중단
          }
          return Math.min(retries * 200, 2000);
        },
        connectTimeout: 5000, // 5초 타임아웃
      }
    });

    redisClient.on('error', (error) => {
      logger.warn('🟡 Redis Client Error (continuing without cache):', { 
        code: error.code,
        message: error.message 
      });
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('🟡 Redis client disconnected');
    });

    // 타임아웃과 함께 연결 시도
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 8000)
      )
    ]);
    
    // 연결 테스트
    await redisClient.ping();
    logger.info('✅ Redis connected successfully');
    
    return redisClient;

  } catch (error) {
    logger.warn('🟡 Redis unavailable, continuing without cache:', { 
      error: error.message 
    });
    redisClient = null;
    return null;
  }
}

// Redis 클라이언트 가져오기
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

// Redis 연결 해제
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
}

// Redis 유틸리티 함수들
export class RedisService {
  private client: RedisClientType;

  constructor(client: RedisClientType) {
    this.client = client;
  }

  // 키-값 저장 (TTL 포함)
  async set(key: string, value: string | object, ttlSeconds?: number): Promise<boolean> {
    try {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
      
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, valueStr);
      } else {
        await this.client.set(key, valueStr);
      }
      
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  // 키-값 조회
  async get(key: string, parseJson: boolean = false): Promise<any> {
    try {
      const value = await this.client.get(key);
      
      if (value === null) {
        return null;
      }
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      
      return value;
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  // 키 삭제
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis DELETE error:', error);
      return false;
    }
  }

  // 키 존재 여부 확인
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  // TTL 설정
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  // 해시 저장
  async hSet(key: string, field: string, value: string | object): Promise<boolean> {
    try {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
      await this.client.hSet(key, field, valueStr);
      return true;
    } catch (error) {
      logger.error('Redis HSET error:', error);
      return false;
    }
  }

  // 해시 조회
  async hGet(key: string, field: string, parseJson: boolean = false): Promise<any> {
    try {
      const value = await this.client.hGet(key, field);
      
      if (value === null) {
        return null;
      }
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      
      return value;
    } catch (error) {
      logger.error('Redis HGET error:', error);
      return null;
    }
  }

  // 패턴으로 키 찾기
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error:', error);
      return [];
    }
  }
}

// Redis 서비스 인스턴스 생성
export function createRedisService(): RedisService | null {
  if (redisClient) {
    return new RedisService(redisClient);
  }
  return null;
}