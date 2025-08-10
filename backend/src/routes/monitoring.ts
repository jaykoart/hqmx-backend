import express from 'express';
import { logInfo, logError } from '../utils/logger';
import { getDiskUsage } from '../utils/fileManager';

const router = express.Router();

// 시스템 상태 모니터링
router.get('/status', async (req, res) => {
  try {
    const diskUsage = await getDiskUsage('/');
    
    const status = {
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        disk: diskUsage
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || 'development'
      },
      performance: {
        memoryUsage: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        }
      }
    };
    
    logInfo('System status requested', { ip: req.ip });
    res.json(status);
  } catch (error) {
    logError('Failed to get system status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 로그 조회 (최근 100줄)
router.get('/logs', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const logFile = path.join(process.cwd(), 'logs', 'combined.log');
    
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const recentLogs = lines.slice(-100); // 최근 100줄
      
      res.json({
        success: true,
        logs: recentLogs,
        totalLines: lines.length,
        recentLines: recentLogs.length
      });
    } catch (fileError) {
      res.json({
        success: true,
        logs: [],
        message: 'No log file found',
        totalLines: 0,
        recentLines: 0
      });
    }
  } catch (error) {
    logError('Failed to read logs', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 에러 로그 조회
router.get('/logs/errors', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const errorLogFile = path.join(process.cwd(), 'logs', 'error.log');
    
    try {
      const content = await fs.readFile(errorLogFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const recentErrors = lines.slice(-50); // 최근 50개 에러
      
      res.json({
        success: true,
        errors: recentErrors,
        totalErrors: lines.length,
        recentErrors: recentErrors.length
      });
    } catch (fileError) {
      res.json({
        success: true,
        errors: [],
        message: 'No error log file found',
        totalErrors: 0,
        recentErrors: 0
      });
    }
  } catch (error) {
    logError('Failed to read error logs', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read error logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API 사용량 통계
router.get('/stats', async (req, res) => {
  try {
    // 간단한 통계 (실제로는 Redis나 DB에서 가져와야 함)
    const stats = {
      success: true,
      timestamp: new Date().toISOString(),
      api: {
        totalRequests: 0, // TODO: Redis에서 가져오기
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      },
      downloads: {
        totalDownloads: 0,
        successfulDownloads: 0,
        failedDownloads: 0,
        averageDownloadTime: 0
      },
      storage: {
        totalFiles: 0,
        totalSize: 0,
        averageFileSize: 0
      }
    };
    
    logInfo('API stats requested', { ip: req.ip });
    res.json(stats);
  } catch (error) {
    logError('Failed to get API stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get API stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
