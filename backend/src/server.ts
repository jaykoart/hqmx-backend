import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';

// 라우터 import
import apiRoutes from './routes/api';
import healthRoutes from './routes/health';
import monitoringRoutes from './routes/monitoring';

// 미들웨어 import
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';

// 유틸리티 import
import { logger } from './utils/logger';
import { connectRedis } from './utils/redis';
import { initializeDirectories } from './utils/fileManager';
import { startCleanupJob } from './utils/cleanup';

// 환경 변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// 기본 디렉토리 생성
initializeDirectories();

// 보안 헤더 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS 설정 (프론트엔드와 연동)
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://hqmx.net',
    'https://www.hqmx.net',
    /^https:\/\/.*\.hqmx\.net$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
}));

// 압축 미들웨어
app.use(compression());

// JSON 파싱 설정
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅
app.use(requestLogger);

// Rate limiting
app.use(rateLimiter);

// 정적 파일 서빙 (필요시)
app.use('/static', express.static(path.join(__dirname, '../public')));

// API 라우트
app.use('/api', apiRoutes);
app.use('/health', healthRoutes);
app.use('/monitoring', monitoringRoutes);

// 메인 API 엔드포인트들 (프론트엔드와 호환)
app.use('/', apiRoutes);

// 404 처리
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// 에러 핸들러
app.use(errorHandler);

// 서버 시작
async function startServer() {
  try {
    // Redis 연결 (선택사항)
    if (process.env.REDIS_URL) {
      await connectRedis();
      logger.info('Redis connected successfully');
    }

    // 정리 작업 스케줄러 시작
    startCleanupJob();

    const server = createServer(app);
    
    server.listen(PORT, () => {
      logger.info(`🚀 HQMX Backend Server running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
    });

    // Graceful shutdown 처리
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 프로세스 예외 처리
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();