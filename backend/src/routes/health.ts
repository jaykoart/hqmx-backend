// 헬스체크 및 시스템 상태 라우터

import express from 'express';
import { logger } from '../utils/logger';
import { getRedisClient } from '../utils/redis';
import { checkStorageHealth } from '../services/storageService';

const router = express.Router();

// 기본 헬스체크
router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 상세 헬스체크
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthChecks = await Promise.allSettled([
      checkRedisHealth(),
      checkStorageHealth(),
      checkSystemHealth(),
      checkDiskSpace()
    ]);

    const [redisHealth, storageHealth, systemHealth, diskSpace] = healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { status: 'error', error: result.reason }
    );

    const overallStatus = [redisHealth, storageHealth, systemHealth, diskSpace]
      .every(check => check.status === 'healthy') ? 'healthy' : 'degraded';

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: {
        redis: redisHealth,
        storage: storageHealth,
        system: systemHealth,
        disk: diskSpace
      }
    });

  } catch (error: any) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Redis 상태 확인
async function checkRedisHealth(): Promise<any> {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return {
        status: 'healthy',
        message: 'Redis not configured (optional)'
      };
    }

    const startTime = Date.now();
    await redis.ping();
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      message: 'Redis connection successful'
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'Redis connection failed'
    };
  }
}

// 시스템 리소스 상태 확인
function checkSystemHealth(): Promise<any> {
  return new Promise((resolve) => {
    const memUsage = process.memoryUsage();
    const _cpuUsage = process.cpuUsage();
    
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    const isHealthy = memUsageMB.heapUsed < 1000; // 1GB 미만

    resolve({
      status: isHealthy ? 'healthy' : 'warning',
      memory: memUsageMB,
      uptime: Math.floor(process.uptime()),
      version: process.version,
      pid: process.pid,
      message: isHealthy ? 'System resources normal' : 'High memory usage detected'
    });
  });
}

// 디스크 공간 확인
async function checkDiskSpace(): Promise<any> {
  try {
    // 임시 디렉토리의 사용 가능한 공간 체크
    // 실제 구현에서는 시스템 명령어나 라이브러리 사용 필요
    return {
      status: 'healthy',
      message: 'Disk space check not implemented',
      available: 'Unknown'
    };
  } catch (error: any) {
    return {
      status: 'warning',
      error: error.message,
      message: 'Could not check disk space'
    };
  }
}

// 서비스 메트릭
router.get('/metrics', (req, res) => {
  const metrics = {
    success: true,
    timestamp: new Date().toISOString(),
    system: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    process: {
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      execPath: process.execPath
    }
  };

  res.json(metrics);
});

// 준비성 체크 (Kubernetes readiness probe)
router.get('/ready', async (req, res) => {
  try {
    // 필수 서비스들이 준비되었는지 확인
    const _redis = getRedisClient();
    const isStorageReady = await checkStorageHealth();

    const isReady = (
      process.uptime() > 5 && // 최소 5초 가동
      isStorageReady === true
    );

    if (isReady) {
      res.json({
        success: true,
        status: 'ready',
        message: 'Service is ready to accept requests'
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'not ready',
        message: 'Service is not ready yet'
      });
    }
  } catch (error: any) {
    res.status(503).json({
      success: false,
      status: 'not ready',
      error: error.message
    });
  }
});

// 생존성 체크 (Kubernetes liveness probe)
router.get('/live', (req, res) => {
  // 간단한 생존성 체크
  const isAlive = process.uptime() > 0;
  
  if (isAlive) {
    res.json({
      success: true,
      status: 'alive',
      uptime: Math.floor(process.uptime())
    });
  } else {
    res.status(503).json({
      success: false,
      status: 'dead'
    });
  }
});

// 시스템 정보
router.get('/info', (req, res) => {
  res.json({
    success: true,
    service: {
      name: 'HQMX Backend',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      uptime: Math.floor(process.uptime())
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid
    },
    features: {
      redis: !!getRedisClient(),
      storage: 'cloudflare-r2',
      mediaProcessor: 'yt-dlp'
    }
  });
});

export default router;