// 정리 작업 및 스케줄링 유틸리티

import cron from 'node-cron';
import { logger } from './logger';
import { cleanupTempFiles } from './fileManager';
import { cleanupCompletedTasks } from '../services/downloadService';
import { getRedisClient } from './redis';

// 정리 작업 스케줄러 시작
export function startCleanupJob(): void {
  const cleanupHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24');
  
  // 매일 새벽 2시에 정리 작업 실행
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting scheduled cleanup job...');
    await performCleanup(cleanupHours);
  });

  // 1시간마다 가벼운 정리 작업
  cron.schedule('0 * * * *', async () => {
    await performLightCleanup();
  });

  logger.info('Cleanup scheduler started');
}

// 전체 정리 작업
export async function performCleanup(maxAgeHours: number = 24): Promise<void> {
  try {
    logger.info(`Starting cleanup process (max age: ${maxAgeHours} hours)`);
    
    const cleanupResults = await Promise.allSettled([
      cleanupTempFiles(maxAgeHours),
      cleanupCompletedTasks(),
      cleanupRedisCache(),
      cleanupOldLogs()
    ]);

    // 결과 로깅
    cleanupResults.forEach((result, index) => {
      const taskNames = ['Temp Files', 'Completed Tasks', 'Redis Cache', 'Old Logs'];
      if (result.status === 'fulfilled') {
        logger.info(`${taskNames[index]} cleanup completed successfully`);
      } else {
        logger.error(`${taskNames[index]} cleanup failed:`, result.reason);
      }
    });

    logger.info('Cleanup process completed');
  } catch (error) {
    logger.error('Cleanup process failed:', error);
  }
}

// 가벼운 정리 작업 (1시간마다)
async function performLightCleanup(): Promise<void> {
  try {
    // 메모리 사용량 확인
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    logger.debug('Memory usage:', memUsageMB);

    // 메모리 사용량이 높으면 가비지 컬렉션 강제 실행
    if (memUsageMB.heapUsed > 500) { // 500MB 이상
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection executed');
      }
    }

    // 임시 파일 정리 (1시간 이상 된 것만)
    await cleanupTempFiles(1);

  } catch (error) {
    logger.error('Light cleanup failed:', error);
  }
}

// Redis 캐시 정리
async function cleanupRedisCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) {
      logger.debug('Redis not available, skipping cache cleanup');
      return;
    }

    // 만료된 작업 상태 정리
    const taskKeys = await redis.keys('task:*');
    let cleanedCount = 0;

    for (const key of taskKeys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) { // TTL이 설정되지 않은 키
        await redis.expire(key, 3600); // 1시간 TTL 설정
        cleanedCount++;
      }
    }

    logger.info(`Redis cache cleanup: ${cleanedCount} keys processed`);
  } catch (error) {
    logger.error('Redis cache cleanup failed:', error);
  }
}

// 오래된 로그 파일 정리
async function cleanupOldLogs(): Promise<void> {
  try {
    const { listFiles, deleteFile, formatFileSize } = await import('./fileManager');
    
    const logDir = 'logs';
    const maxLogAge = 7 * 24; // 7일
    
    const logFiles = await listFiles(logDir, {
      extensions: ['log'],
      maxAge: maxLogAge
    });

    let totalSize = 0;
    let deletedCount = 0;

    for (const file of logFiles) {
      totalSize += file.size;
      const deleted = await deleteFile(file.path);
      if (deleted) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old log files (${formatFileSize(totalSize)})`);
    }
  } catch (error) {
    logger.error('Log cleanup failed:', error);
  }
}

// 시스템 리소스 모니터링
export function monitorResources(): void {
  // 10분마다 리소스 상태 체크
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const _cpuUsage = process.cpuUsage();

    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
    };

    // 메모리 사용량이 임계치를 넘으면 경고
    if (memUsageMB.heapUsed > 1000) { // 1GB
      logger.warn('High memory usage detected:', memUsageMB);
    }

    // 개발 환경에서만 디버그 로깅
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Resource usage:', { memory: memUsageMB, uptime: Math.round(process.uptime()) });
    }

  }, 10 * 60 * 1000); // 10분
}

// 수동 정리 실행
export async function manualCleanup(): Promise<{
  success: boolean;
  message: string;
  details: any;
}> {
  try {
    const startTime = Date.now();
    
    const [tempFiles, completedTasks] = await Promise.all([
      cleanupTempFiles(1), // 1시간 이상 된 임시 파일
      cleanupCompletedTasks()
    ]);

    const duration = Date.now() - startTime;
    
    const result = {
      success: true,
      message: 'Manual cleanup completed successfully',
      details: {
        tempFilesRemoved: tempFiles,
        completedTasksRemoved: completedTasks,
        durationMs: duration
      }
    };

    logger.info('Manual cleanup completed:', result.details);
    return result;

  } catch (error: any) {
    logger.error('Manual cleanup failed:', error);
    return {
      success: false,
      message: `Cleanup failed: ${error.message}`,
      details: { error: error.message }
    };
  }
}

// 프로세스 종료 시 정리
export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      // 진행 중인 다운로드 정리
      await performCleanup(0.5); // 30분 이상 된 것들 정리
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}