import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface AdvancedBypassOptions {
  userIP: string;
  userAgent: string;
  cookies: any;
  fingerprint: any;
  sessionData: any;
  behaviorPattern: any;
  connectionInfo: any;
}

// 🚀 최종 고급 YouTube 우회 분석 시스템
export async function analyzeWithAdvancedBypass(url: string, options: AdvancedBypassOptions): Promise<MediaInfo> {
  logger.info(`🎯 Starting ULTIMATE YouTube bypass analysis for: ${url}`);
  
  try {
    const { intelligentRateLimiter } = await import('./rateLimitingService');
    const { hybridYouTubeAnalysis } = await import('./youtubeApiService');
    const { extractWithBrowserFarm } = await import('./browserFarmService');
    const { behaviorAnalyzer } = await import('./behaviorAnalysisService');

    // 🔍 지능형 레이트 리미팅 확인
    const rateLimitCheck = await intelligentRateLimiter.applyIntelligentRateLimit(
      { ip: options.userIP, user: { id: options.userIP } }, 
      'user-analyze'
    );
    
    if (!rateLimitCheck.allowed) {
      logger.warn(`Rate limit applied: ${rateLimitCheck.reason}, wait: ${rateLimitCheck.waitTime}ms`);
      if (rateLimitCheck.waitTime) {
        await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime));
      }
    }

    // 🎯 1단계: SaveFrom 스타일 분석 (NEW!)
    try {
      logger.info('🔥 Attempting SaveFrom-style analysis');
      const { saveFromBypassService } = await import('./saveFromBypassService');
      const saveFromResult = await saveFromBypassService.analyzeWithSaveFromMethod(url, options);
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: SaveFrom-style analysis completed');
      return saveFromResult;
    } catch (error) {
      logger.warn(`❌ SaveFrom-style analysis failed: ${error}`);
      await intelligentRateLimiter.learnFromYouTubeResponse(error.toString(), 'user-analyze', options.userIP);
    }

    // 🎯 2단계: 하이브리드 API + 스크래핑 분석
    try {
      logger.info('🔥 Attempting hybrid YouTube API + scraping analysis');
      const hybridResult = await hybridYouTubeAnalysis(url, options);
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: Hybrid analysis completed');
      return hybridResult;
    } catch (error) {
      logger.warn(`❌ Hybrid analysis failed: ${error}`);
      await intelligentRateLimiter.learnFromYouTubeResponse(error.toString(), 'user-analyze', options.userIP);
    }

    // 🎯 3단계: 분산 브라우저 팜 분석
    try {
      logger.info('🌐 Attempting distributed browser farm analysis');
      const browserResult = await extractWithBrowserFarm(url, options);
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: Browser farm analysis completed');
      return browserResult;
    } catch (error) {
      logger.warn(`❌ Browser farm analysis failed: ${error}`);
      await intelligentRateLimiter.learnFromYouTubeResponse(error.toString(), 'user-analyze', options.userIP);
    }

    // 🎯 4단계: 사용자 쿠키와 세션 정보를 사용한 분석
    const cookieAnalysis = await analyzeWithUserCookies(url, options);
    if (cookieAnalysis.success) {
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: User cookies analysis completed');
      return cookieAnalysis.data;
    }
    
    // 🎯 5단계: 브라우저 핑거프린팅을 활용한 분석
    const fingerprintAnalysis = await analyzeWithFingerprint(url, options);
    if (fingerprintAnalysis.success) {
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: Browser fingerprinting analysis completed');
      return fingerprintAnalysis.data;
    }
    
    // 🎯 6단계: 동적 User-Agent와 헤더 로테이션
    const rotationAnalysis = await analyzeWithRotation(url, options);
    if (rotationAnalysis.success) {
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: Header rotation analysis completed');
      return rotationAnalysis.data;
    }
    
    // 🎯 7단계: 인간 행동 패턴 시뮬레이션
    const behaviorAnalysis = await analyzeWithBehaviorSimulation(url, options);
    if (behaviorAnalysis.success) {
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: Behavior simulation analysis completed');
      return behaviorAnalysis.data;
    }
    
    // 🎯 8단계: 프록시 체인을 통한 분석
    const proxyAnalysis = await analyzeWithProxyChain(url, options);
    if (proxyAnalysis.success) {
      await intelligentRateLimiter.updateSuccessRate('user-analyze', true);
      logger.info('✅ SUCCESS: Proxy chain analysis completed');
      return proxyAnalysis.data;
    }
    
    // ⚠️ 모든 8단계 고급 방법이 실패한 경우
    logger.error('🚨 ALL 8 ADVANCED BYPASS METHODS FAILED - Using fallback');
    await intelligentRateLimiter.updateSuccessRate('user-analyze', false);
    return await basicFallbackAnalysis(url, options);
    
  } catch (error) {
    logger.error(`💥 ULTIMATE YouTube bypass failed: ${error}`);
    const { intelligentRateLimiter: rateLimiter } = await import('./rateLimitingService');
    await rateLimiter.updateSuccessRate('user-analyze', false);
    throw error;
  }
}

// 사용자 쿠키를 활용한 분석
async function analyzeWithUserCookies(url: string, options: AdvancedBypassOptions) {
  try {
    logger.info('Attempting analysis with user cookies');
    
    // 쿠키 파일 생성
    const cookieFile = await createCookieFile(options.cookies);
    
    const ytDlpArgs = [
      '--dump-json',
      '--no-download',
      '--cookies', cookieFile,
      '--user-agent', `"${options.userAgent}"`,
      '--add-header', `X-Forwarded-For:${options.userIP}`,
      '--add-header', `CF-Connecting-IP:${options.userIP}`,
      '--extractor-args', 'youtube:player_client=web,html5',
      url
    ];
    
    const result = await executeYtDlp(ytDlpArgs);
    
    // 임시 쿠키 파일 삭제
    fs.unlinkSync(cookieFile);
    
    if (result) {
      return { success: true, data: result };
    }
    
    return { success: false };
  } catch (error) {
    logger.error(`Cookie-based analysis failed: ${error}`);
    return { success: false };
  }
}

// 브라우저 핑거프린팅을 활용한 분석
async function analyzeWithFingerprint(url: string, options: AdvancedBypassOptions) {
  try {
    logger.info('Attempting analysis with browser fingerprinting');
    
    const customUserAgent = generateCustomUserAgent(options.fingerprint);
    
    const ytDlpArgs = [
      '--dump-json',
      '--no-download',
      '--user-agent', `"${customUserAgent}"`,
      '--add-header', `X-Real-IP:${options.userIP}`,
      '--add-header', `X-Canvas-Fingerprint:${options.fingerprint?.canvas?.hash || 'unknown'}`,
      '--add-header', `X-WebGL-Vendor:${options.fingerprint?.webgl?.vendor || 'unknown'}`,
      '--extractor-args', 'youtube:player_client=web,html5,android',
      '--geo-bypass-country', 'US',
      url
    ];
    
    const result = await executeYtDlp(ytDlpArgs);
    
    if (result) {
      return { success: true, data: result };
    }
    
    return { success: false };
  } catch (error) {
    logger.error(`Fingerprint-based analysis failed: ${error}`);
    return { success: false };
  }
}

// 동적 헤더 로테이션 분석
async function analyzeWithRotation(url: string, options: AdvancedBypassOptions) {
  try {
    logger.info('Attempting analysis with header rotation');
    
    const rotatedHeaders = generateRotatedHeaders(options);
    
    const ytDlpArgs = [
      '--dump-json',
      '--no-download',
      '--user-agent', `"${rotatedHeaders.userAgent}"`,
      '--add-header', `Accept:${rotatedHeaders.accept}`,
      '--add-header', `Accept-Language:${rotatedHeaders.acceptLanguage}`,
      '--add-header', `Accept-Encoding:${rotatedHeaders.acceptEncoding}`,
      '--add-header', `DNT:1`,
      '--add-header', `Upgrade-Insecure-Requests:1`,
      '--extractor-args', 'youtube:player_client=web,html5,ios',
      '--sleep-interval', '1',
      '--max-sleep-interval', '3',
      url
    ];
    
    const result = await executeYtDlp(ytDlpArgs);
    
    if (result) {
      return { success: true, data: result };
    }
    
    return { success: false };
  } catch (error) {
    logger.error(`Rotation-based analysis failed: ${error}`);
    return { success: false };
  }
}

// 인간 행동 패턴 시뮬레이션
async function analyzeWithBehaviorSimulation(url: string, options: AdvancedBypassOptions) {
  try {
    logger.info('Attempting analysis with behavior simulation');
    
    // 랜덤 지연 시간 추가 (인간적인 행동 모방)
    const delay = Math.random() * 2000 + 1000; // 1-3초 랜덤 지연
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const ytDlpArgs = [
      '--dump-json',
      '--no-download',
      '--user-agent', `"${options.userAgent}"`,
      '--extractor-args', 'youtube:player_client=web,html5,android,ios',
      '--sleep-requests', '1',
      '--sleep-interval', '2',
      '--max-sleep-interval', '5',
      '--retries', '3',
      '--fragment-retries', '3',
      url
    ];
    
    const result = await executeYtDlp(ytDlpArgs);
    
    if (result) {
      return { success: true, data: result };
    }
    
    return { success: false };
  } catch (error) {
    logger.error(`Behavior simulation analysis failed: ${error}`);
    return { success: false };
  }
}

// 프록시 체인을 통한 분석
async function analyzeWithProxyChain(url: string, options: AdvancedBypassOptions) {
  try {
    logger.info('Attempting analysis with proxy chain');
    
    // 사용자 IP를 프록시로 사용하는 시뮬레이션
    const ytDlpArgs = [
      '--dump-json',
      '--no-download',
      '--user-agent', `"${options.userAgent}"`,
      '--add-header', `X-Forwarded-For:${options.userIP}`,
      '--add-header', `X-Real-IP:${options.userIP}`,
      '--add-header', `X-Original-Forwarded-For:${options.userIP}`,
      '--extractor-args', 'youtube:player_client=web,html5',
      '--geo-bypass',
      url
    ];
    
    const result = await executeYtDlp(ytDlpArgs);
    
    if (result) {
      return { success: true, data: result };
    }
    
    return { success: false };
  } catch (error) {
    logger.error(`Proxy chain analysis failed: ${error}`);
    return { success: false };
  }
}

// 기본 폴백 분석
async function basicFallbackAnalysis(url: string, options: AdvancedBypassOptions): Promise<MediaInfo> {
  logger.info('Performing basic fallback analysis');
  
  const ytDlpArgs = [
    '--dump-json',
    '--no-download',
    '--user-agent', `"${options.userAgent}"`,
    '--ignore-errors',
    url
  ];
  
  const result = await executeYtDlp(ytDlpArgs);
  
  if (result) {
    return result;
  }
  
  // 최후의 수단: 기본 정보만 반환
  return {
    title: 'Analysis Failed - Bot Detection',
    duration: 0,
    video_formats: [],
    audio_formats: [],
    available_qualities: [],
    available_audio_bitrates: [],
    thumbnail: '',
    description: 'Unable to analyze due to bot detection. Please try again later.',
    uploader: 'Unknown',
    upload_date: '',
    view_count: 0,
    webpage_url: url,
    extractor: 'youtube',
    id: extractVideoId(url) || 'unknown'
  };
}

// 유틸리티 함수들
async function createCookieFile(cookies: any): Promise<string> {
  const cookieFile = path.join('/tmp', `cookies_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`);
  
  let cookieContent = '# Netscape HTTP Cookie File\n';
  
  for (const [name, value] of Object.entries(cookies)) {
    if (value) {
      cookieContent += `.youtube.com\tTRUE\t/\tFALSE\t${Math.floor(Date.now() / 1000) + 86400}\t${name}\t${value}\n`;
    }
  }
  
  fs.writeFileSync(cookieFile, cookieContent);
  return cookieFile;
}

function generateCustomUserAgent(fingerprint: any): string {
  const base = 'Mozilla/5.0';
  const platform = fingerprint?.hardware?.platform || 'Windows NT 10.0; Win64; x64';
  const engine = 'AppleWebKit/537.36 (KHTML, like Gecko)';
  const browser = 'Chrome/120.0.0.0 Safari/537.36';
  
  return `${base} (${platform}) ${engine} ${browser}`;
}

function generateRotatedHeaders(options: AdvancedBypassOptions) {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  return {
    userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    acceptLanguage: 'en-US,en;q=0.9,ko;q=0.8',
    acceptEncoding: 'gzip, deflate, br'
  };
}

function extractVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function executeYtDlp(args: string[]): Promise<MediaInfo | null> {
  return new Promise((resolve, reject) => {
    logger.info(`Executing yt-dlp with args: ${args.join(' ')}`);
    
    const process = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('{'));
          
          if (jsonLine) {
            const data = JSON.parse(jsonLine);
            const videoFormats = (data.formats || [])
              .filter((format: any) => format.vcodec && format.vcodec !== 'none')
              .map((format: any) => ({
                format_id: format.format_id || '',
                ext: format.ext || '',
                width: format.width || 0,
                height: format.height || 0,
                fps: format.fps || 0,
                vcodec: format.vcodec || '',
                acodec: format.acodec || '',
                filesize: format.filesize || 0,
                quality: format.quality || 0
              }));

            const audioFormats = (data.formats || [])
              .filter((format: any) => format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none'))
              .map((format: any) => ({
                format_id: format.format_id || '',
                ext: format.ext || '',
                acodec: format.acodec || '',
                abr: format.abr || 0,
                asr: format.asr || 0,
                filesize: format.filesize || 0,
                quality: format.quality || 0
              }));

            const mediaInfo: MediaInfo = {
              id: data.id || '',
              title: data.title || 'Unknown',
              duration: data.duration || 0,
              thumbnail: data.thumbnail || '',
              description: data.description || '',
              uploader: data.uploader || 'Unknown',
              upload_date: data.upload_date || '',
              view_count: data.view_count || 0,
              webpage_url: data.webpage_url || '',
              extractor: data.extractor || 'youtube',
              video_formats: videoFormats,
              audio_formats: audioFormats,
              available_qualities: [...new Set(videoFormats.map(f => f.height).filter(h => h > 0))] as number[],
              available_audio_bitrates: [...new Set(audioFormats.map(f => f.abr).filter(b => b > 0))] as number[]
            };
            
            resolve(mediaInfo);
          } else {
            resolve(null);
          }
        } catch (parseError) {
          logger.error(`Failed to parse yt-dlp output: ${parseError}`);
          resolve(null);
        }
      } else {
        logger.error(`yt-dlp failed with code ${code}: ${stderr}`);
        resolve(null);
      }
    });
    
    process.on('error', (error) => {
      logger.error(`yt-dlp process error: ${error}`);
      reject(error);
    });
  });
}
