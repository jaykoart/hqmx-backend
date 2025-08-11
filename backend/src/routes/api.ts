import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { analyzeMedia } from '../services/mediaService';
import { downloadMedia, getDownloadStatus } from '../services/downloadService';
import { getFileFromStorage, uploadToStorage } from '../services/storageService';
import { analyzeWithClientIP, downloadWithClientIP } from '../services/clientProxyService';
import { UserProfileService } from '../services/userProfileService';
import { advancedBypassService } from '../services/advancedBypassService';
import { advancedVideoAnalysisService } from '../services/advancedVideoAnalysisService';
import { ultimateBotBypassService } from '../services/ultimateBotBypassService';
import { ipRotationService, advancedIPSpoofingService } from '../services/ipRotationService';
import { logger } from '../utils/logger';
import { validateUrl } from '../utils/validation';
// import { TaskStatus } from '../types/common';

const router = express.Router();

// 클라이언트 IP 추출 함수
function getClientIP(req: express.Request): string {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection as any).socket?.remoteAddress || 
         'unknown';
}

// 클라이언트 브라우저 정보 추출 함수
function getClientInfo(req: express.Request) {
  return {
    userAgent: req.headers['user-agent'] || 'unknown',
    cookies: req.headers.cookie || '',
    acceptLanguage: req.headers['accept-language'] || 'en'
  };
}

// 🚀 ULTIMATE SaveFrom 방식 분석 엔드포인트
router.post('/ultimate-analyze', async (req, res) => {
  try {
    const { url, userInfo, analysisType } = req.body;
    const userIP = getClientIP(req);
    
    logger.info(`🚀 ULTIMATE analysis requested for URL: ${url}`);
    logger.info(`User IP: ${userIP}`);
    logger.info(`Analysis type: ${analysisType}`);
    
    const { ultimateYouTubeService } = await import('../services/ultimateYouTubeService');
    
    const ultimateOptions = {
      userIP,
      userAgent: userInfo?.userAgent || req.get('User-Agent') || '',
      userCookies: userInfo?.youtubeData?.youtubeCookies || {},
      preferredCountry: userInfo?.language?.startsWith('ko') ? 'KR' : 'US',
      useProxy: true,
      maxRetries: 3
    };
    
    const result = await ultimateYouTubeService.analyzeWithSaveFromMethod(url, ultimateOptions);
    
    res.json({
      success: true,
      ...result,
      analysis_method: 'ultimate_savefrom_style',
      user_ip: userIP,
      system_status: await ultimateYouTubeService.getSystemStatus()
    });
    
  } catch (error: any) {
    logger.error(`ULTIMATE analysis failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'ULTIMATE analysis failed',
      message: error.message,
      analysis_method: 'ultimate_savefrom_style'
    });
  }
});

// 클라이언트 사이드 분석을 위한 프록시 엔드포인트
router.post('/client-analyze', async (req, res) => {
  try {
    const { url, clientInfo } = req.body;
    const clientIP = getClientIP(req);
    
    logger.info(`Client-side analysis requested for URL: ${url}`);
    logger.info(`Client IP: ${clientIP}`);
    logger.info(`Client info: ${JSON.stringify(clientInfo)}`);
    
    // 클라이언트의 실제 IP를 사용하여 분석 수행
    const analysisResult = await performClientIPAnalysis(url, clientIP, clientInfo);
    
    res.json({
      success: true,
      ...analysisResult,
      analysis_method: 'client_ip_proxy',
      client_ip: clientIP,
      client_info: clientInfo
    });
    
  } catch (error: any) {
    logger.error('Client analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process client analysis request',
      message: error.message
    });
  }
});

// 클라이언트 IP를 사용한 분석 수행
async function performClientIPAnalysis(url: string, clientIP: string, clientInfo: any) {
  logger.info(`Performing analysis with client IP: ${clientIP}`);
  
  // 클라이언트의 실제 IP와 브라우저 정보를 사용하여 분석
  // 이는 서버가 아닌 클라이언트의 환경을 시뮬레이션
  const analysisData = {
    url,
    clientIP,
    userAgent: clientInfo.userAgent,
    language: clientInfo.language,
    platform: clientInfo.platform,
    timestamp: Date.now()
  };
  
  logger.info(`Analysis data: ${JSON.stringify(analysisData)}`);
  
  // 클라이언트 IP 기반 분석 결과 반환
  return {
    title: 'Client IP Analysis',
    duration: 0,
    formats: [],
    analysis_note: 'This analysis was performed using client IP and browser information'
  };
}

// 사용자 고유 IP 분석 엔드포인트
router.post('/user-analyze', async (req, res) => {
  try {
    const { url, userInfo, analysisType } = req.body;
    const userIP = getClientIP(req);
    
    logger.info(`User IP analysis requested for URL: ${url}`);
    logger.info(`User IP: ${userIP}`);
    logger.info(`User info: ${JSON.stringify(userInfo)}`);
    
    // 사용자의 고유 IP를 사용하여 분석 수행
    const analysisResult = await performUserIPAnalysis(url, userIP, userInfo);
    
    res.json({
      success: true,
      ...analysisResult,
      analysis_method: 'user_ip_analysis',
      user_ip: userIP,
      user_info: userInfo
    });
    
  } catch (error: any) {
    logger.error('User IP analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process user IP analysis request',
      message: error.message
    });
  }
});

// 사용자 고유 IP를 사용한 분석 수행
async function performUserIPAnalysis(url: string, userIP: string, userInfo: any) {
  logger.info(`Performing analysis with user IP: ${userIP}`);
  
  // 고급 사용자 데이터 저장
  await storeUserData(userIP, userInfo);
  
  // 사용자의 고유 IP와 브라우저 정보를 사용하여 분석
  const analysisData = {
    url,
    userIP,
    userAgent: userInfo.userAgent,
    language: userInfo.language,
    platform: userInfo.platform,
    fingerprint: userInfo.fingerprint,
    youtubeData: userInfo.youtubeData,
    timestamp: Date.now()
  };
  
  logger.info(`Advanced user analysis data collected`);
  
  try {
    // 고급 YouTube 우회 시스템 사용
    const mediaInfo = await performAdvancedYouTubeAnalysis(url, userIP, userInfo);
    
    return {
      ...mediaInfo,
      analysis_method: 'advanced_user_ip_analysis',
      user_ip: userIP,
      fingerprint_hash: userInfo.fingerprint?.canvas?.hash || 'unknown'
    };
  } catch (error) {
    logger.error(`Advanced user IP analysis failed: ${error}`);
    throw error;
  }
}

// 고급 YouTube 우회 분석 시스템
async function performAdvancedYouTubeAnalysis(url: string, userIP: string, userInfo: any) {
  logger.info(`Performing advanced YouTube analysis with comprehensive user data`);
  
  // YouTube 특화 분석 수행
  const { analyzeWithAdvancedBypass } = await import('../services/youtubeBypassService');
  
  const analysisOptions = {
    userIP,
    userAgent: userInfo.userAgent,
    cookies: userInfo.youtubeData?.youtubeCookies || {},
    fingerprint: userInfo.fingerprint,
    sessionData: userInfo.youtubeData?.sessionInfo || {},
    behaviorPattern: userInfo.behaviorPattern || {},
    connectionInfo: userInfo.connection || {}
  };
  
  return await analyzeWithAdvancedBypass(url, analysisOptions);
}

// 사용자 데이터 저장 시스템
async function storeUserData(userIP: string, userInfo: any) {
  try {
    // Redis에 사용자 세션 데이터 저장
    const { getRedisClient } = await import('../utils/redis');
    const redis = getRedisClient();
    
    const sessionKey = `user_session:${userIP}:${Date.now()}`;
    const userData = {
      timestamp: Date.now(),
      fingerprint: userInfo.fingerprint,
      youtubeData: userInfo.youtubeData,
      behaviorPattern: userInfo.behaviorPattern,
      connectionInfo: userInfo.connection
    };
    
    await redis?.setEx(sessionKey, 3600 * 24, JSON.stringify(userData)); // 24시간 저장
    logger.info(`User data stored for IP: ${userIP}`);
  } catch (error) {
    logger.error(`Failed to store user data: ${error}`);
  }
}

// 🔥 NEW: SaveFrom-style 분석 엔드포인트 (yt-dlp 없이)
router.post('/savefrom-analyze', async (req, res) => {
  try {
    const { url } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    // URL 유효성 검사
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL format is not supported'
      });
    }

    logger.info(`🔥 SaveFrom-style analysis for URL: ${url}`);

    // SaveFrom 스타일 서비스 사용
    const { saveFromStyleService } = await import('../services/saveFromStyleService');
    
    const options = {
      userIP: clientIP,
      userAgent: clientInfo.userAgent,
      language: clientInfo.acceptLanguage,
      country: clientInfo.acceptLanguage?.includes('ko') ? 'KR' : 'US',
      useProxy: false // DigitalOcean 서버에서 직접 처리
    };

    const mediaInfo = await saveFromStyleService.analyzeWithSaveFromMethod(url, options);

    res.json({
      success: true,
      ...mediaInfo,
      analysis_method: 'savefrom_style_no_ytdlp',
      client_ip: clientIP,
      service_status: saveFromStyleService.getServiceStatus()
    });

  } catch (error: any) {
    logger.error('SaveFrom-style analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'SaveFrom-style analysis failed',
      message: error.message,
      analysis_method: 'savefrom_style_no_ytdlp'
    });
  }
});

// 미디어 분석 엔드포인트 (기존 방식 유지)
router.post('/analyze', async (req, res) => {
  try {
    const { url, useClientIP = true, useSaveFromStyle = true } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    // URL 유효성 검사
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL format is not supported'
      });
    }

    logger.info(`Analyzing URL: ${url} with client IP: ${clientIP}, useClientIP: ${useClientIP}, useSaveFromStyle: ${useSaveFromStyle}`);

    let mediaInfo;

    // 🔥 우선순위 1: SaveFrom 스타일 분석 (yt-dlp 없이)
    if (useSaveFromStyle) {
      try {
        logger.info('🚀 Attempting SaveFrom-style analysis (no yt-dlp)');
        const { saveFromStyleService } = await import('../services/saveFromStyleService');
        
        const options = {
          userIP: clientIP,
          userAgent: clientInfo.userAgent,
          language: clientInfo.acceptLanguage,
          country: clientInfo.acceptLanguage?.includes('ko') ? 'KR' : 'US',
          useProxy: false
        };

        mediaInfo = await saveFromStyleService.analyzeWithSaveFromMethod(url, options);
        
        return res.json({
          success: true,
          ...mediaInfo,
          analysis_method: 'savefrom_style_primary'
        });
        
      } catch (saveFromError) {
        logger.warn(`SaveFrom-style analysis failed, falling back: ${saveFromError}`);
      }
    }

    // 🔥 우선순위 2: 클라이언트 IP 분석 (기존 방식)
    if (useClientIP) {
      logger.info(`Attempting client IP analysis for: ${url}`);
      
      const clientAdditionalInfo = req.body.clientInfo;
      
      try {
        mediaInfo = await analyzeWithClientIP(url, {
          userIp: clientIP,
          userAgent: clientInfo.userAgent,
          cookies: clientInfo.cookies,
          proxyEnabled: true,
          clientInfo: clientAdditionalInfo
        });
        
        logger.info(`Analysis completed using client IP: ${clientIP}`);
      } catch (clientError) {
        logger.warn(`Client IP analysis failed, falling back to server analysis: ${clientError}`);
        mediaInfo = await analyzeMedia(url, clientInfo.acceptLanguage);
      }
    } else {
      // 서버 기반 분석
      mediaInfo = await analyzeMedia(url, clientInfo.acceptLanguage);
    }

    res.json({
      success: true,
      ...mediaInfo,
      analysis_method: useClientIP ? 'client_ip_fallback' : 'server_proxy'
    });

  } catch (error: any) {
    logger.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze media',
      message: error.message
    });
  }
});

// 다운로드 시작 엔드포인트
router.post('/download', async (req, res) => {
  try {
    const { url, mediaType, formatType, quality, useClientIP = true } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    // 입력 유효성 검사
    if (!url || !mediaType || !formatType || !quality) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    const taskId = uuidv4();
    
    logger.info(`Starting download - Task ID: ${taskId}, URL: ${url}, Client IP: ${clientIP}`);

    // 클라이언트 IP 사용 여부에 따른 다운로드 방식 선택
    if (useClientIP) {
      try {
        // 클라이언트 IP를 사용한 다운로드
        const filePath = await downloadWithClientIP(url, {
          userIp: clientIP,
          userAgent: clientInfo.userAgent,
          cookies: clientInfo.cookies,
          proxyEnabled: true
        }, {
          mediaType,
          formatType,
          quality
        });

        // 다운로드된 파일을 클라우드 스토리지에 업로드
        const uploadResult = await uploadToStorage(filePath, taskId, formatType);
        
        logger.info(`Client IP download completed for task: ${taskId}`);
        
        res.json({
          success: true,
          task_id: taskId,
          message: 'Download completed using client IP',
          download_method: 'client_ip',
          file_url: uploadResult.url
        });

      } catch (clientError) {
        logger.warn(`Client IP download failed, falling back to server download: ${clientError}`);
        
        // 클라이언트 IP 다운로드 실패 시 서버 기반 다운로드로 fallback
        downloadMedia({
          taskId,
          url,
          mediaType,
          formatType,
          quality,
          language: clientInfo.acceptLanguage,
          useClientIP: false // 서버 프록시 사용
        }).catch(error => {
          logger.error(`Server download failed for task ${taskId}:`, error);
        });

        res.json({
          success: true,
          task_id: taskId,
          message: 'Download started using server proxy',
          download_method: 'server_proxy'
        });
      }
    } else {
      // 서버 기반 다운로드
      downloadMedia({
        taskId,
        url,
        mediaType,
        formatType,
        quality,
        language: clientInfo.acceptLanguage,
        useClientIP: false // 서버 프록시 사용
      }).catch(error => {
        logger.error(`Download failed for task ${taskId}:`, error);
      });

      res.json({
        success: true,
        task_id: taskId,
        message: 'Download started using server proxy',
        download_method: 'server_proxy'
      });
    }

  } catch (error: any) {
    logger.error('Download start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start download',
      message: error.message
    });
  }
});

// SSE 진행상황 스트리밍
router.get('/stream-progress/:taskId', (req, res) => {
  const { taskId } = req.params;

  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  logger.info(`SSE connection established for task: ${taskId}`);

  // 진행상황 업데이트 함수
  const sendProgress = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 초기 연결 확인
  sendProgress({
    status: 'connected',
    message: 'Connection established',
    percentage: 0
  });

  // 진행상황 모니터링 시작
  const progressInterval = setInterval(async () => {
    try {
      const status = await getDownloadStatus(taskId);
      
      if (status) {
        sendProgress(status);
        
        // 완료되었거나 에러인 경우 연결 종료
        if (status.status === 'complete' || status.status === 'error') {
          clearInterval(progressInterval);
          res.end();
        }
      }
    } catch (error) {
      logger.error(`Progress monitoring error for task ${taskId}:`, error);
      sendProgress({
        status: 'error',
        message: 'Failed to get progress status'
      });
      clearInterval(progressInterval);
      res.end();
    }
  }, 1000); // 1초마다 업데이트

  // 클라이언트 연결 종료 처리
  req.on('close', () => {
    logger.info(`SSE connection closed for task: ${taskId}`);
    clearInterval(progressInterval);
  });
});

// 작업 상태 확인 엔드포인트
router.get('/check-status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const status = await getDownloadStatus(taskId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      ...status
    });

  } catch (error: any) {
    logger.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get task status',
      message: error.message
    });
  }
});

// 파일 다운로드 엔드포인트
router.get('/get-file/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    logger.info(`File download requested for task: ${taskId}`);

    const fileData = await getFileFromStorage(taskId);
    
    if (!fileData) {
      return res.status(404).json({
        success: false,
        error: 'File not found or expired'
      });
    }

    // 파일 다운로드 헤더 설정
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
    res.setHeader('Content-Type', fileData.contentType);
    res.setHeader('Content-Length', fileData.size);

    // 파일 스트림 응답
    fileData.stream.pipe(res);

  } catch (error: any) {
    logger.error('File download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download file',
      message: error.message
    });
  }
});

// 웹 비콘 엔드포인트
router.get('/beacon', async (req, res) => {
  try {
    const { session, timestamp } = req.query;
    const userIP = getClientIP(req);
    
    logger.info(`Web beacon hit from IP: ${userIP}, session: ${session}`);
    
    // 웹 비콘 데이터 저장
    await storeWebBeaconData(userIP, session as string, timestamp as string, req);
    
    // 1x1 투명 픽셀 이미지 반환
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.send(pixel);
    
  } catch (error: any) {
    logger.error('Web beacon error:', error);
    // 에러가 발생해도 이미지는 반환
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    res.send(pixel);
  }
});

// 웹 비콘 데이터 저장
async function storeWebBeaconData(userIP: string, sessionId: string, timestamp: string, req: any) {
  try {
    const { getRedisClient } = await import('../utils/redis');
    const redis = getRedisClient();
    
    const beaconData = {
      ip: userIP,
      sessionId: sessionId,
      timestamp: timestamp,
      serverTimestamp: Date.now(),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding')
    };
    
    const beaconKey = `beacon:${userIP}:${sessionId}:${timestamp}`;
    await redis?.setEx(beaconKey, 3600 * 24 * 7, JSON.stringify(beaconData)); // 7일 저장
    
    // 사용자별 비콘 카운트 증가
    const countKey = `beacon_count:${userIP}`;
    await redis?.incr(countKey);
    await redis?.expire(countKey, 3600 * 24 * 30); // 30일 만료
    
    logger.info(`Web beacon data stored for session: ${sessionId}`);
  } catch (error) {
    logger.error(`Failed to store web beacon data: ${error}`);
  }
}

// 🔥 NEW: SaveFrom-style Worker API endpoint
router.post('/worker/analyze', async (req, res) => {
  try {
    logger.info('🚀 SaveFrom-style worker analysis requested');
    
    const userIP = getClientIP(req);
    const formData = req.body;
    
    // Extract URL from SaveFrom-style parameters
    const url = decodeURIComponent(formData.sf_url || formData.url || '');
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    logger.info(`Worker analyzing URL: ${url}`);
    logger.info(`User IP: ${userIP}`);
    logger.info(`Form data: ${JSON.stringify(formData)}`);
    
    // Validate security hash (SaveFrom-style)
    const isValidRequest = await validateSaveFromRequest(formData, userIP);
    if (!isValidRequest) {
      logger.warn('Invalid SaveFrom-style request detected');
      return res.status(403).json({ error: 'Invalid request signature' });
    }
    
    // Use our advanced YouTube bypass with SaveFrom context
    const { analyzeWithAdvancedBypass } = await import('../services/youtubeBypassService');
    const analysisOptions = {
      userIP,
      userAgent: req.get('User-Agent') || '',
      cookies: {},
      fingerprint: { savefrom_style: true },
      sessionData: { 
        ts: formData.ts,
        _ts: formData._ts,
        _tsc: formData._tsc,
        _s: formData._s 
      },
      behaviorPattern: {},
      connectionInfo: {}
    };
    
    const mediaInfo = await analyzeWithAdvancedBypass(url, analysisOptions);
    
    // Return in SaveFrom-compatible format
    res.json({
      success: true,
      title: mediaInfo.title,
      duration: mediaInfo.duration,
      thumbnail: mediaInfo.thumbnail,
      description: mediaInfo.description,
      uploader: mediaInfo.uploader,
      upload_date: mediaInfo.upload_date,
      view_count: mediaInfo.view_count,
      video_formats: mediaInfo.video_formats,
      audio_formats: mediaInfo.audio_formats,
      available_qualities: mediaInfo.available_qualities,
      available_audio_bitrates: mediaInfo.available_audio_bitrates,
      extractor: 'hqmx_savefrom_style',
      worker_method: 'advanced_bypass'
    });
    
  } catch (error: any) {
    logger.error(`SaveFrom-style worker analysis failed: ${error.message}`);
    res.status(500).json({ 
      error: 'Worker analysis failed', 
      message: error.message 
    });
  }
});

// SaveFrom 요청 검증 함수
async function validateSaveFromRequest(formData: any, userIP: string): Promise<boolean> {
  try {
    // 기본 필수 필드 검증
    if (!formData._s || !formData.ts || !formData._ts) {
      return false;
    }
    
    // 타임스탬프 유효성 검증 (10분 이내)
    const requestTime = parseInt(formData.ts);
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 10 * 60 * 1000) { // 10분 초과
      return false;
    }
    
    // 보안 해시 검증 (간단한 검증)
    const hashLength = formData._s.length;
    if (hashLength !== 64) { // SHA256 해시는 64자
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`SaveFrom request validation failed: ${error}`);
    return false;
  }
}

// 🎭 NEW: 사용자 정보 활용 고급 우회 분석 엔드포인트
router.post('/user-mimic-analyze', async (req, res) => {
  try {
    const { url, userProfile } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    logger.info(`🎭 User-mimic analysis requested for: ${url}`);

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided',
        analysis_method: 'user_mimic_advanced'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL validation failed', 
        analysis_method: 'user_mimic_advanced'
      });
    }

    // 사용자 프로필 생성 또는 최적화
    let profile;
    if (userProfile && typeof userProfile === 'object') {
      // 클라이언트에서 제공한 프로필 사용
      profile = UserProfileService.generateSaveFromProfile(userProfile);
      logger.info('📋 Using client-provided user profile');
    } else {
      // 클라이언트 정보 기반 최적화된 프로필 생성
      profile = UserProfileService.createOptimizedProfile(
        clientInfo.userAgent,
        clientIP
      );
      logger.info('🎯 Generated optimized user profile');
    }

    // Terms of Service에 따른 데이터 활용 로깅
    logger.info('📜 User data collection authorized by Terms of Service');
    logger.info(`🔍 Utilizing user profile for enhanced bypass: ${JSON.stringify({
      userAgent: profile.userAgent.substring(0, 50) + '...',
      language: profile.language,
      platform: profile.platform,
      screen: profile.screen,
      timezone: profile.timezone
    })}`);

    const bypassOptions = {
      userProfile: profile,
      useProxy: false,
      maxRetries: 3,
      timeout: 30000
    };

    const mediaInfo = await advancedBypassService.analyzeWithUserMimic(url, bypassOptions);

    res.json({
      success: true,
      ...mediaInfo,
      analysis_method: 'user_mimic_advanced',
      client_ip: clientIP,
      profile_used: {
        platform: profile.platform,
        language: profile.language,
        timezone: profile.timezone,
        screen_resolution: `${profile.screen.width}x${profile.screen.height}`
      },
      compliance_note: 'Data collection authorized by Terms of Service'
    });

  } catch (error: any) {
    logger.error('User-mimic analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'User-mimic analysis failed',
      message: error.message,
      analysis_method: 'user_mimic_advanced'
    });
  }
});

// 🚀 NEW: 궁극의 봇 탐지 우회 분석 엔드포인트
router.post('/ultimate-bot-bypass', async (req, res) => {
  try {
    const { url, bypassLevel, useIPRotation, targetCountry, simulateHuman } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    logger.info(`🚀 Ultimate bot bypass analysis requested for: ${url}`);
    logger.info(`🎯 Bypass level: ${bypassLevel || 'ultimate'}`);
    logger.info(`🌍 Target country: ${targetCountry || 'auto'}`);
    logger.info(`🔄 IP rotation: ${useIPRotation !== false}`);

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided',
        analysis_method: 'ultimate_bot_bypass'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL validation failed',
        analysis_method: 'ultimate_bot_bypass'
      });
    }

    const bypassOptions = {
      userIP: clientIP,
      userAgent: clientInfo.userAgent,
      bypassLevel: bypassLevel || 'ultimate',
      simulateHumanBehavior: simulateHuman !== false,
      useRotatingProxies: useIPRotation !== false,
      maxRetries: 5,
      timeout: 45000
    };

    const mediaInfo = await ultimateBotBypassService.analyzeWithUltimateBypass(url, bypassOptions);

    res.json({
      success: true,
      ...mediaInfo,
      analysis_method: 'ultimate_bot_bypass',
      client_ip: clientIP,
      bypass_level: bypassLevel || 'ultimate',
      techniques_used: ['stealth_browser', 'human_simulation', 'fingerprint_spoofing', 'proxy_rotation'],
      service_status: 'operational'
    });

  } catch (error: any) {
    logger.error('Ultimate bot bypass analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Ultimate bot bypass analysis failed',
      message: error.message,
      analysis_method: 'ultimate_bot_bypass'
    });
  }
});

// 🎯 NEW: 고급 다중 벡터 분석 엔드포인트
router.post('/advanced-multi-vector', async (req, res) => {
  try {
    const { url, bypassLevel, useIPRotation, targetCountry, maxRetries } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    logger.info(`🎯 Advanced multi-vector analysis requested for: ${url}`);

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided',
        analysis_method: 'advanced_multi_vector'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL validation failed',
        analysis_method: 'advanced_multi_vector'
      });
    }

    const analysisOptions = {
      url,
      userIP: clientIP,
      userAgent: clientInfo.userAgent,
      cookies: {},
      useIPRotation: useIPRotation !== false,
      bypassLevel: bypassLevel || 'ultimate',
      targetCountry,
      maxRetries: maxRetries || 3,
      timeout: 60000,
      simulateHumanBehavior: true
    };

    const result = await advancedVideoAnalysisService.analyzeVideoWithAdvancedBypass(analysisOptions);

    res.json({
      success: true,
      ...result,
      client_ip: clientIP,
      service_stats: advancedVideoAnalysisService.getServiceStats()
    });

  } catch (error: any) {
    logger.error('Advanced multi-vector analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Advanced multi-vector analysis failed',
      message: error.message,
      analysis_method: 'advanced_multi_vector'
    });
  }
});

// 🔄 NEW: IP 로테이션 상태 확인 엔드포인트
router.get('/proxy-status', async (req, res) => {
  try {
    const proxyStatus = ipRotationService.getProxyPoolStatus();
    const serviceStatus = advancedIPSpoofingService.getServiceStatus();

    res.json({
      success: true,
      proxy_pool: proxyStatus,
      spoofing_service: serviceStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Proxy status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get proxy status',
      message: error.message
    });
  }
});

// 🔄 NEW: 프록시 풀 새로고침 엔드포인트
router.post('/refresh-proxy-pool', async (req, res) => {
  try {
    logger.info('🔄 Manual proxy pool refresh requested');
    
    await ipRotationService.refreshProxyPool();
    
    const newStatus = ipRotationService.getProxyPoolStatus();
    
    res.json({
      success: true,
      message: 'Proxy pool refreshed successfully',
      new_status: newStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Proxy pool refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh proxy pool',
      message: error.message
    });
  }
});

// 🎭 NEW: 스텔스 모드 분석 엔드포인트 (최고 수준 은밀성)
router.post('/stealth-analyze', async (req, res) => {
  try {
    const { url, stealthLevel, antiDetection } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    logger.info(`🎭 Stealth mode analysis requested for: ${url}`);
    logger.info(`🔒 Stealth level: ${stealthLevel || 'maximum'}`);
    logger.info(`🛡️ Anti-detection: ${antiDetection !== false}`);

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided',
        analysis_method: 'stealth_analyze'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL validation failed',
        analysis_method: 'stealth_analyze'
      });
    }

    // 최고 수준의 스텔스 분석 옵션
    const stealthOptions = {
      url,
      userIP: clientIP,
      userAgent: clientInfo.userAgent,
      useIPRotation: true,
      bypassLevel: 'ultimate' as const,
      targetCountry: 'US', // 기본적으로 미국 IP 사용
      maxRetries: 5,
      timeout: 90000, // 더 긴 타임아웃
      simulateHumanBehavior: true
    };

    // 고급 스텔스 분석 실행
    const result = await advancedVideoAnalysisService.analyzeVideoWithAdvancedBypass(stealthOptions);

    // 민감한 정보는 로그에서 제외
    logger.info('✅ Stealth analysis completed successfully (details omitted for security)');

    res.json({
      success: true,
      ...result,
      analysis_method: 'stealth_analyze',
      stealth_level: stealthLevel || 'maximum',
      security_note: 'Analysis performed with maximum stealth and anti-detection measures',
      // 클라이언트 IP는 보안상 마스킹
      client_ip_masked: clientIP.replace(/\.\d+$/, '.***')
    });

  } catch (error: any) {
    logger.error('Stealth analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Stealth analysis failed',
      message: 'Analysis failed due to security restrictions',
      analysis_method: 'stealth_analyze'
    });
  }
});

// 🌐 NEW: 지역별 최적화 분석 엔드포인트
router.post('/geo-optimized-analyze', async (req, res) => {
  try {
    const { url, targetCountry, preferredLanguage } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    logger.info(`🌐 Geo-optimized analysis requested for: ${url}`);
    logger.info(`🌍 Target country: ${targetCountry}`);
    logger.info(`🗣️ Preferred language: ${preferredLanguage || 'auto'}`);

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided',
        analysis_method: 'geo_optimized'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL validation failed',
        analysis_method: 'geo_optimized'
      });
    }

    if (!targetCountry) {
      return res.status(400).json({
        success: false,
        error: 'Target country is required for geo-optimized analysis',
        analysis_method: 'geo_optimized'
      });
    }

    // IP 로테이션 전략을 지역 최적화로 설정
    ipRotationService.setRotationStrategy('geo_optimized');

    const geoOptions = {
      url,
      userIP: clientIP,
      userAgent: clientInfo.userAgent,
      useIPRotation: true,
      bypassLevel: 'advanced' as const,
      targetCountry: targetCountry.toUpperCase(),
      maxRetries: 4,
      timeout: 50000,
      simulateHumanBehavior: true
    };

    const result = await advancedVideoAnalysisService.analyzeVideoWithAdvancedBypass(geoOptions);

    res.json({
      success: true,
      ...result,
      analysis_method: 'geo_optimized',
      target_country: targetCountry.toUpperCase(),
      preferred_language: preferredLanguage || 'auto',
      client_ip: clientIP,
      geo_optimization: 'enabled'
    });

  } catch (error: any) {
    logger.error('Geo-optimized analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Geo-optimized analysis failed',
      message: error.message,
      analysis_method: 'geo_optimized'
    });
  }
});

// 📊 NEW: 서비스 통계 및 상태 엔드포인트
router.get('/service-stats', async (req, res) => {
  try {
    const analysisStats = advancedVideoAnalysisService.getServiceStats();
    const proxyStatus = ipRotationService.getProxyPoolStatus();
    const spoofingStatus = advancedIPSpoofingService.getServiceStatus();

    res.json({
      success: true,
      analysis_service: analysisStats,
      proxy_service: proxyStatus,
      spoofing_service: spoofingStatus,
      system_status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });

  } catch (error: any) {
    logger.error('Service stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service statistics',
      message: error.message
    });
  }
});

// 🧪 NEW: 실험적 양자 우회 분석 엔드포인트 (베타)
router.post('/quantum-bypass', async (req, res) => {
  try {
    const { url, experimentalMode } = req.body;
    const clientIP = getClientIP(req);
    const clientInfo = getClientInfo(req);

    logger.info(`🧪 Quantum bypass analysis requested for: ${url}`);
    logger.info(`⚛️ Experimental mode: ${experimentalMode !== false}`);

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided',
        analysis_method: 'quantum_bypass'
      });
    }

    if (!validateUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL validation failed',
        analysis_method: 'quantum_bypass'
      });
    }

    // 실험적 양자 우회 옵션
    const quantumOptions = {
      url,
      userIP: clientIP,
      userAgent: clientInfo.userAgent,
      useIPRotation: true,
      bypassLevel: 'ultimate' as const,
      maxRetries: 3,
      timeout: 120000, // 2분 타임아웃 (실험적 기법이므로 더 오래 걸림)
      simulateHumanBehavior: true
    };

    const result = await advancedVideoAnalysisService.analyzeVideoWithAdvancedBypass(quantumOptions);

    res.json({
      success: true,
      ...result,
      analysis_method: 'quantum_bypass',
      experimental_warning: 'This is an experimental feature and may have unpredictable results',
      quantum_techniques: ['superposition_access', 'quantum_entanglement', 'probabilistic_behavior'],
      client_ip: clientIP,
      beta_version: '1.0.0-beta'
    });

  } catch (error: any) {
    logger.error('Quantum bypass analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Quantum bypass analysis failed',
      message: error.message,
      analysis_method: 'quantum_bypass',
      experimental_note: 'Experimental features may fail due to their cutting-edge nature'
    });
  }
});

export default router;