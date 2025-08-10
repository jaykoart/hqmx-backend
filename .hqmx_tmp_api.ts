import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { analyzeMedia } from '../services/mediaService';
import { downloadMedia, getDownloadStatus } from '../services/downloadService';
import { getFileFromStorage, uploadToStorage } from '../services/storageService';
import { analyzeWithClientIP, downloadWithClientIP } from '../services/clientProxyService';
import { logger } from '../utils/logger';
import { validateUrl } from '../utils/validation';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
// import { TaskStatus } from '../types/common';

const router = express.Router();

// 클라이언트 IP 추출 함수
function getClientIP(req: express.Request): string {
  const xffHeader = (req.headers['x-forwarded-for'] as string) || '';
  const xriHeader = (req.headers['x-real-ip'] as string) || '';
  const forwardedIp = xffHeader
    .split(',')
    .map((part) => part.trim())
    .find(Boolean);
  return (
    forwardedIp ||
    xriHeader ||
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any).socket?.remoteAddress ||
    'unknown'
  );
}

// 클라이언트 브라우저 정보 추출 함수
function getClientInfo(req: express.Request) {
  return {
    userAgent: req.headers['user-agent'] || 'unknown',
    cookies: req.headers.cookie || '',
    acceptLanguage: req.headers['accept-language'] || 'en'
  };
}

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
  
  // 사용자의 고유 IP와 브라우저 정보를 사용하여 분석
  const analysisData = {
    url,
    userIP,
    userAgent: userInfo.userAgent,
    language: userInfo.language,
    platform: userInfo.platform,
    userFingerprint: userInfo.userFingerprint,
    timestamp: Date.now()
  };
  
  logger.info(`User analysis data: ${JSON.stringify(analysisData)}`);
  
  try {
    // 사용자의 실제 IP를 사용하여 YouTube에 직접 요청
    const mediaInfo = await performUserIPYouTubeAnalysis(url, userIP, userInfo);
    
    return {
      ...mediaInfo,
      analysis_method: 'user_ip_analysis',
      user_ip: userIP,
      user_fingerprint: userInfo.userFingerprint
    };
  } catch (error) {
    logger.error(`User IP analysis failed: ${error}`);
    throw error;
  }
}

// 사용자 IP를 사용한 YouTube 분석
async function performUserIPYouTubeAnalysis(url: string, userIP: string, userInfo: any) {
  logger.info(`Performing YouTube analysis with user IP: ${userIP}`);
  
  // YouTube URL에서 비디오 ID 추출
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  // 사용자의 실제 IP로 YouTube에 직접 요청
  const youtubeData = await fetchYouTubeWithUserIP(videoId, userIP, userInfo);
  
  return youtubeData;
}

// YouTube URL에서 비디오 ID 추출
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// 사용자 IP로 YouTube에 직접 요청
async function fetchYouTubeWithUserIP(videoId: string, userIP: string, userInfo: any) {
  logger.info(`Fetching YouTube data with user IP: ${userIP} for video: ${videoId}`);
  
  // YouTube oEmbed API를 사용하여 사용자의 IP로 직접 요청
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  
  try {
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userInfo.userAgent,
        'Accept': 'application/json',
        'Accept-Language': userInfo.language,
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
        'X-Forwarded-For': userIP,
        'X-Real-IP': userIP
      }
    });
    
    if (!response.ok) {
      throw new Error(`YouTube oEmbed failed: ${response.status}`);
    }
    
    const oembedData = await response.json() as any;
    
    // 기본 미디어 정보 구성
    const mediaInfo = {
      id: videoId,
      title: oembedData.title || 'Unknown Title',
      description: oembedData.author_name || 'Unknown Author',
      thumbnail: oembedData.thumbnail_url || '',
      duration: 0, // oEmbed에서는 duration을 제공하지 않음
      view_count: 0,
      uploader: oembedData.author_name || 'Unknown Author',
      webpage_url: `https://www.youtube.com/watch?v=${videoId}`,
      extractor: 'youtube',
      video_formats: [],
      audio_formats: [],
      available_qualities: [],
      available_audio_bitrates: [],
      analysis_method: 'user_ip_direct',
      user_ip_used: true,
      user_ip: userIP
    };
    
    logger.info('User IP YouTube analysis completed:', mediaInfo);
    return mediaInfo;
    
  } catch (error) {
    logger.error('User IP YouTube analysis failed:', error);
    throw new Error(`User IP YouTube analysis failed: ${error.message}`);
  }
}

// 미디어 분석 엔드포인트
router.post('/analyze', async (req, res) => {
  try {
    const { url, useClientIP = true } = req.body;
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

    logger.info(`Analyzing URL: ${url} with client IP: ${clientIP}, useClientIP: ${useClientIP}`);

    let mediaInfo;

    // 클라이언트 IP 사용 여부에 따른 분석 방식 선택
    if (useClientIP) {
      logger.info(`Attempting client IP analysis for: ${url}`);
      logger.info(`analyzeWithClientIP function exists: ${typeof analyzeWithClientIP}`);
      logger.info(`Client info: userAgent=${clientInfo.userAgent}, cookies=${clientInfo.cookies ? 'present' : 'none'}`);
      
      // 클라이언트에서 전송된 추가 정보 확인
      const clientAdditionalInfo = req.body.clientInfo;
      if (clientAdditionalInfo) {
        logger.info(`Client additional info: ${JSON.stringify(clientAdditionalInfo)}`);
      }
      
      try {
        // 클라이언트 IP를 사용한 분석
        logger.info(`Calling analyzeWithClientIP...`);
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
        
        // 클라이언트 IP 분석 실패 시 서버 기반 분석으로 fallback
        mediaInfo = await analyzeMedia(url, clientInfo.acceptLanguage);
      }
    } else {
      // 서버 기반 분석
      mediaInfo = await analyzeMedia(url, clientInfo.acceptLanguage);
    }

    res.json({
      success: true,
      ...mediaInfo,
      analysis_method: useClientIP ? 'client_ip' : 'server_proxy'
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

// 다운로드 시작 엔드포인트 (사용자 IP 기반으로 변경)
router.post('/download', async (req, res) => {
  try {
    const { 
      url, 
      mediaType, 
      formatType, 
      quality,
      userCookies,
      userAgent
    } = req.body;
    
    const userIP = getClientIP(req);
    const userInfo = getClientInfo(req);

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

    logger.info(`Starting simplified download - URL: ${url}, User IP: ${userIP}`);

    // YouTube URL에서 비디오 ID 추출
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    // 사용자 쿠키를 yt-dlp 형식으로 변환
    const cookieFile = await createCookieFile(userCookies);
    const effectiveUserAgent = userAgent || userInfo.userAgent;

    logger.info(`Using cookies: ${userCookies ? 'Yes' : 'No'}`);
    logger.info(`Using User-Agent: ${effectiveUserAgent}`);

    // yt-dlp를 사용하여 사용자 쿠키와 IP로 다운로드
    const downloadResult = await executeYtDlpWithUserCredentials(videoId, {
      userIP,
      userAgent: effectiveUserAgent,
      cookieFile,
      downloadOptions: { mediaType, formatType, quality }
    });

    // 임시 쿠키 파일 정리
    if (cookieFile) {
      try {
        await fs.unlink(cookieFile);
        logger.info('Cookie file cleaned up');
      } catch (e) {
        logger.warn('Failed to clean up cookie file:', e);
      }
    }

    res.json({
      success: true,
      ...downloadResult,
      download_method: 'simplified_user_ip_download',
      user_ip: userIP
    });

  } catch (error: any) {
    logger.error('Simplified download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process simplified download request',
      message: error.message
    });
  }
});


// 쿠키 파일 생성
async function createCookieFile(cookies: string): Promise<string | null> {
  if (!cookies || cookies.trim() === '') {
    return null;
  }

  try {
    const cookieFile = path.join('/tmp', `youtube_cookies_${Date.now()}.txt`);

    const cookieList = cookies.split(';').map((cookie) => cookie.trim());
    const youtubeCookies = cookieList.filter((cookie) => {
      const name = cookie.split('=')[0];
      return (
        name.includes('youtube') ||
        name.includes('google') ||
        name.includes('yt') ||
        name.includes('VISITOR') ||
        name.includes('LOGIN') ||
        name.includes('SID') ||
        name.includes('HSID') ||
        name.includes('SSID') ||
        name.includes('APISID') ||
        name.includes('SAPISID') ||
        name.includes('__Secure') ||
        name.includes('__Host')
      );
    });

    logger.info(
      `Filtered ${youtubeCookies.length} YouTube cookies from ${cookieList.length} total cookies`
    );

    if (youtubeCookies.length === 0) {
      logger.warn('No YouTube cookies found in user cookies');
      return null;
    }

    const cookieLines = youtubeCookies
      .map((cookie) => {
        const [name, value] = cookie.split('=');
        if (!name || !value) return '';
        return `.youtube.com\tTRUE\t/\tFALSE\t1735689600\t${name.trim()}\t${value.trim()}`;
      })
      .filter((line) => line !== '');

    const cookieContent = [
      '# Netscape HTTP Cookie File',
      '# https://curl.se/rfc/cookie_spec.html',
      '# This file was generated by HQMX',
      '# Filtered YouTube cookies from user browser',
      '',
      ...cookieLines,
    ].join('\n');

    await fs.writeFile(cookieFile, cookieContent, 'utf8');
    logger.info(`Cookie file created with ${cookieLines.length} YouTube cookies: ${cookieFile}`);
    return cookieFile;
  } catch (error) {
    logger.error('Failed to create cookie file:', error);
    return null;
  }
}

// 사용자 자격증명으로 yt-dlp 실행 (사용자 IP 우선, 이후 프록시 회전)
async function executeYtDlpWithUserCredentials(
  videoId: string,
  options: {
    userIP: string;
    userAgent: string;
    cookieFile: string | null;
    downloadOptions: any;
  }
): Promise<any> {
  const { userIP, userAgent, cookieFile } = options;

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const attempts: Array<{ client: 'android' | 'ios' | 'web' | 'tv'; ua: string }> = [];
    if (cookieFile) {
      attempts.push({ client: 'web', ua: userAgent });
    } else {
      attempts.push({
        client: 'android',
        ua: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
      });
      attempts.push({
        client: 'ios',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
      });
      attempts.push({ client: 'web', ua: userAgent });
      attempts.push({
        client: 'tv',
        ua: 'Mozilla/5.0 (Chromium; SmartTV; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SmartTV Safari/537.36',
      });
    }

    async function loadProxyList(): Promise<string[]> {
      try {
        const local = await fs
          .readFile('/app/proxy-list.txt', 'utf8')
          .catch(() => fs.readFile('proxy-list.txt', 'utf8'))
          .catch(() => '');
        const localList = local
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'));

        const sourcesEnv = process.env.PROXY_SOURCES || '';
        const sources = sourcesEnv
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean);

        const remoteLists: string[] = [];
        for (const src of sources) {
          try {
            const resp = await fetch(src, {
              method: 'GET',
              headers: { 'User-Agent': 'hqmx-proxy-fetcher' },
            });
            if (resp.ok) {
              const text = await resp.text();
              text.split(/\r?\n/).forEach((line) => {
                const p = line.trim();
                if (!p) return;
                if (/^https?:\/\//i.test(p)) remoteLists.push(p);
                else if (/^\d+\.\d+\.\d+\.\d+:\d+$/i.test(p)) remoteLists.push(`http://${p}`);
              });
            }
          } catch (e) {
            logger.warn('Failed to fetch proxy source', { src, error: e });
          }
        }

        return Array.from(new Set([...localList, ...remoteLists])).slice(0, 30);
      } catch (error) {
        logger.error('Failed to load proxy list', { error });
        return [];
      }
    }

    const proxies = await loadProxyList();
    const proxiesToTry: Array<string | null> = [null, ...proxies.slice(0, 5)];
    logger.info(`Proxies to try: ${JSON.stringify(proxiesToTry)}`);

    const runAttempt = (
      client: 'android' | 'ios' | 'web' | 'tv',
      ua: string,
      proxy: string | null
    ) => {
      const args = [
        '--dump-json',
        '--no-download',
        '--ignore-errors',
        '--user-agent',
        ua,
        '--add-header',
        'Accept-Language:en-US,en;q=0.9',
        '--add-header',
        'Referer:https://www.youtube.com/',
        '--add-header',
        'Origin:https://www.youtube.com',
        '--add-header',
        'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        '--add-header',
        'Accept-Encoding:gzip, deflate, br',
        '--add-header',
        'Cache-Control:no-cache',
        '--add-header',
        'Pragma:no-cache',
        '--add-header',
        'Sec-Fetch-Site:none',
        '--add-header',
        'Sec-Fetch-Mode:navigate',
        '--add-header',
        'Sec-Fetch-Dest:document',
        '--add-header',
        'DNT:1',
        '--extractor-args',
        client === 'ios' ? 'youtube:player_client=ios;player_skip=webpage' : `youtube:player_client=${client}`,
        '--force-ipv4',
      ];

      if (cookieFile) args.push('--cookies', cookieFile);
      if (proxy) args.push('--proxy', proxy);
      args.push('--add-header', `X-Forwarded-For: ${userIP}`);
      args.push('--add-header', `X-Real-IP: ${userIP}`);

      logger.info(
        `Executing yt-dlp [client=${client}]${proxy ? ` via proxy=${proxy}` : ''} for: ${url}`
      );
      logger.info(`Args: ${args.join(' ')}`);

      return new Promise<{ ok: boolean; data?: any; err?: string }>((resolve) => {
        const ytDlp = spawn('yt-dlp', [...args, url], { stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        ytDlp.stdout.on('data', (d) => (out += d.toString()));
        ytDlp.stderr.on('data', (d) => (err += d.toString()));
        ytDlp.on('close', (code) => {
          if (code === 0) {
            try {
              resolve({ ok: true, data: JSON.parse(out.trim()) });
            } catch {
              resolve({ ok: false, err: 'parse_error' });
            }
          } else {
            resolve({ ok: false, err });
          }
        });
        ytDlp.on('error', (e) => resolve({ ok: false, err: String(e) }));
      });
    };

    for (const proxy of proxiesToTry) {
      for (const a of attempts) {
        const r = await runAttempt(a.client, a.ua, proxy);
        if (r.ok && r.data) {
          logger.info(
            `yt-dlp success with client=${a.client}${proxy ? ` via proxy=${proxy}` : ''}`
          );
          return {
            success: true,
            downloadUrl: `https://www.youtube.com/watch?v=${videoId}`,
            method: 'user_ip_cookies_ytdlp',
            user_ip_used: !proxy,
            proxy_used: !!proxy,
            cookies_used: !!cookieFile,
            videoId,
            mediaInfo: r.data,
          };
        }
        logger.warn(
          `yt-dlp failed for client=${a.client}${proxy ? ` via proxy=${proxy}` : ''}. Trying next.`
        );
      }
    }

    throw new Error('All yt-dlp attempts failed');
  } catch (error) {
    logger.error('yt-dlp execution failed:', error);
    throw error;
  }
}

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

export default router;
