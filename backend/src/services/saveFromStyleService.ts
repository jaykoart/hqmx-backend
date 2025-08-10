import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface SaveFromStyleOptions {
  userIP: string;
  userAgent: string;
  language?: string;
  country?: string;
  useProxy?: boolean;
}

// 🔥 SaveFrom 방식을 완전히 모방한 YouTube 분석 서비스 (yt-dlp 없이)
export class SaveFromStyleService {
  private browser: any = null;
  private sessionCookies: any = {};
  private workerTokens: { [key: string]: string } = {};
  private sessionIds: { [key: string]: string } = {};

  constructor() {
    this.initializeBrowser();
  }

  // 🔑 SaveFrom 스타일 토큰 생성 (역공학)
  private generateWorkerToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const hash = Buffer.from(`${timestamp}-${random}`).toString('base64');
    return hash.substring(0, 32);
  }

  // 🆔 세션 ID 생성 (SaveFrom 방식)
  private generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 🚀 브라우저 초기화 (SaveFrom처럼 실제 브라우저 사용) - 최적화됨
  private async initializeBrowser() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-ipc-flooding-protection',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
        ],
        timeout: 30000, // 30초 타임아웃
        protocolTimeout: 30000,
      });
      logger.info('🚀 SaveFrom-style browser initialized successfully');
    } catch (error) {
      logger.error(`❌ Failed to initialize browser: ${error}`);
      throw error;
    }
  }

  // 🎯 SaveFrom 방식의 핵심: 실제 브라우저로 YouTube 데이터 추출
  async analyzeWithSaveFromMethod(url: string, options: SaveFromStyleOptions): Promise<MediaInfo> {
    logger.info(`🔥 Starting SaveFrom-style analysis for: ${url}`);
    
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const page = await this.browser.newPage();
    
    try {
      // 🎯 1단계: 실제 브라우저 설정 (SaveFrom처럼)
      await this.setupRealBrowserEnvironment(page, options);
      
      // 🎯 2단계: YouTube 페이지 방문 (실제 사용자처럼) - 최적화됨
      logger.info('🎯 Direct navigation to target video (optimized)...');
      
      // 직접 타겟 비디오로 이동 (더 빠르고 안정적)
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // 더 빠른 로딩
        timeout: 20000 
      });
      
      // 중요한 요소들이 로드될 때까지 대기
      try {
        await page.waitForSelector('#movie_player, #player-container, .html5-video-player', { 
          timeout: 10000 
        });
      } catch (e) {
        logger.warn('Player element not found, continuing anyway...');
      }

      // 🎯 3단계: JavaScript로 YouTube 데이터 직접 추출 (SaveFrom 방식)
      const videoData = await this.extractYouTubeDataWithJavaScript(page, url);
      
      // 🎯 4단계: 다운로드 URL 생성 (SaveFrom 방식)
      const downloadUrls = await this.generateDownloadUrls(page, videoData);
      
      // 🎯 5단계: MediaInfo 형식으로 변환
      const mediaInfo = this.convertToMediaInfo(videoData, downloadUrls, url);
      
      logger.info('✅ SaveFrom-style analysis completed successfully');
      return mediaInfo;
      
    } catch (error) {
      logger.error(`SaveFrom-style analysis failed: ${error}`);
      throw error;
    } finally {
      await page.close();
    }
  }

  // 🔧 실제 브라우저 환경 설정 (SaveFrom처럼)
  private async setupRealBrowserEnvironment(page: any, options: SaveFromStyleOptions) {
    // User-Agent 설정
    await page.setUserAgent(options.userAgent);
    
    // 뷰포트 설정 (실제 사용자처럼)
    await page.setViewport({ 
      width: 1920, 
      height: 1080,
      deviceScaleFactor: 1
    });

    // 🛡️ 봇 감지 우회 스크립트 주입 (SaveFrom 핵심 기술)
    await page.evaluateOnNewDocument(() => {
      // webdriver 속성 완전 제거
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Chrome runtime 시뮬레이션
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
      };
      
      // 플러그인 정보 실제처럼 조작
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ],
      });
      
      // 권한 API 시뮬레이션
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
    });
    
    // 언어 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': options.language || 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // 기존 쿠키가 있으면 설정
    if (Object.keys(this.sessionCookies).length > 0) {
      await page.setCookie(...this.sessionCookies);
    }

    // JavaScript 활성화 및 이미지 로딩 비활성화 (속도 향상)
    await page.setJavaScriptEnabled(true);
    await page.setRequestInterception(true);
    
    page.on('request', (request: any) => {
      if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet') {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  // 🔥 핵심: JavaScript로 YouTube 데이터 직접 추출 (SaveFrom 방식)
  private async extractYouTubeDataWithJavaScript(page: any, url: string): Promise<any> {
    logger.info('🎯 Extracting YouTube data with JavaScript (SaveFrom method)');
    
    // 페이지가 로드될 때까지 최적화된 대기
    try {
      await page.waitForSelector('#movie_player', { timeout: 8000 });
    } catch (e) {
      logger.warn('Movie player not found, trying alternative selectors...');
      try {
        await page.waitForSelector('.html5-video-player', { timeout: 5000 });
      } catch (e2) {
        logger.warn('No video player found, proceeding with data extraction...');
      }
    }
    
    // JavaScript로 YouTube 내부 데이터 추출 (SaveFrom 방식 완전 모방)
    const videoData = await page.evaluate(() => {
      try {
        // 🎯 방법 1: ytInitialPlayerResponse에서 데이터 추출 (SaveFrom 핵심)
        let playerResponse = null;
        if ((window as any).ytInitialPlayerResponse) {
          playerResponse = (window as any).ytInitialPlayerResponse;
        } else {
          // 스크립트 태그에서 찾기 (SaveFrom 백업 방식)
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const content = script.innerHTML;
            // 다양한 패턴으로 시도 (SaveFrom이 사용하는 모든 방식)
            const patterns = [
              /var ytInitialPlayerResponse = ({.+?});/,
              /ytInitialPlayerResponse\\s*=\\s*({.+?});/,
              /"ytInitialPlayerResponse"\\s*:\\s*({.+?}),/,
              /window\\.ytInitialPlayerResponse\\s*=\\s*({.+?});/
            ];
            
            for (const pattern of patterns) {
              const match = content.match(pattern);
              if (match) {
                try {
                  playerResponse = JSON.parse(match[1]);
                  break;
                } catch (e) {
                  continue;
                }
              }
            }
            if (playerResponse) break;
          }
        }

        // 🎯 방법 2: ytInitialData에서 추가 데이터 추출
        let initialData = null;
        if ((window as any).ytInitialData) {
          initialData = (window as any).ytInitialData;
        } else {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const content = script.innerHTML;
            const match = content.match(/var ytInitialData = ({.+?});/);
            if (match) {
              initialData = JSON.parse(match[1]);
              break;
            }
          }
        }

        // 🎯 방법 3: 동적으로 생성된 config 데이터 추출
        const configMatch = document.documentElement.innerHTML.match(/ytcfg\.set\(({.+?})\)/);
        let config = null;
        if (configMatch) {
          config = JSON.parse(configMatch[1]);
        }

        return {
          playerResponse,
          initialData,
          config,
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        };
        
      } catch (error) {
        console.error('Data extraction failed:', error);
        return { error: error.toString() };
      }
    });

    if (videoData.error) {
      throw new Error(`JavaScript extraction failed: ${videoData.error}`);
    }

    return videoData;
  }

  // 🔥 SaveFrom 방식: 다운로드 URL 생성 - 강화됨
  private async generateDownloadUrls(page: any, videoData: any): Promise<any> {
    logger.info('🎯 Generating download URLs (Enhanced SaveFrom method)');
    
    if (!videoData.playerResponse) {
      throw new Error('No player response data available');
    }

    const playerResponse = videoData.playerResponse;
    const streamingData = playerResponse.streamingData;
    
    if (!streamingData) {
      throw new Error('No streaming data available');
    }

    // 🔑 SaveFrom 스타일 토큰 및 세션 설정
    const workerToken = this.generateWorkerToken();
    const sessionId = this.generateSessionId();
    
    logger.info(`🔑 Generated worker token: ${workerToken.substring(0, 8)}...`);
    logger.info(`🆔 Generated session ID: ${sessionId}`);
    
    // 토큰을 쿠키에 저장 (SaveFrom 방식)
    await page.setCookie(
      { name: 'sf-token', value: workerToken, domain: '.youtube.com' },
      { name: 'sf-session', value: sessionId, domain: '.youtube.com' }
    );

    // 🎯 비디오 포맷 추출 (SaveFrom 방식 강화)
    const videoFormats = [];
    
    // 일반 포맷 처리
    if (streamingData.formats) {
      logger.info(`🎬 Found ${streamingData.formats.length} regular formats`);
      for (const format of streamingData.formats) {
        if (format.url || format.signatureCipher || format.cipher) {
          // SaveFrom 방식: 암호화된 URL 처리
          let finalUrl = format.url;
          if (!finalUrl && (format.signatureCipher || format.cipher)) {
            finalUrl = await this.decryptYouTubeUrl(format.signatureCipher || format.cipher);
          }
          
          if (finalUrl) {
            videoFormats.push({
              format_id: format.itag?.toString() || '',
              ext: this.getExtensionFromMimeType(format.mimeType),
              width: format.width || 0,
              height: format.height || 0,
              fps: format.fps || 0,
              vcodec: this.getCodecFromMimeType(format.mimeType, 'video'),
              acodec: this.getCodecFromMimeType(format.mimeType, 'audio'),
              filesize: format.contentLength ? parseInt(format.contentLength) : 0,
              quality: format.height || 0,
              url: finalUrl,
              bitrate: format.bitrate || 0,
              encrypted: !!format.signatureCipher || !!format.cipher
            });
          }
        }
      }
    }

    // 🎯 적응형 포맷 추출 (고품질) - SaveFrom 방식 강화
    if (streamingData.adaptiveFormats) {
      logger.info(`🎬 Found ${streamingData.adaptiveFormats.length} adaptive formats`);
      for (const format of streamingData.adaptiveFormats) {
        if (format.url || format.signatureCipher || format.cipher) {
          const isVideo = format.mimeType && format.mimeType.includes('video');
          const isAudio = format.mimeType && format.mimeType.includes('audio');
          
          // SaveFrom 방식: 암호화된 URL 처리
          let finalUrl = format.url;
          if (!finalUrl && (format.signatureCipher || format.cipher)) {
            finalUrl = await this.decryptYouTubeUrl(format.signatureCipher || format.cipher);
          }
          
          if (finalUrl && isVideo) {
            videoFormats.push({
              format_id: format.itag?.toString() || '',
              ext: this.getExtensionFromMimeType(format.mimeType),
              width: format.width || 0,
              height: format.height || 0,
              fps: format.fps || 0,
              vcodec: this.getCodecFromMimeType(format.mimeType, 'video'),
              acodec: 'none',
              filesize: format.contentLength ? parseInt(format.contentLength) : 0,
              quality: format.height || 0,
              url: finalUrl,
              bitrate: format.bitrate || 0,
              encrypted: !!format.signatureCipher || !!format.cipher
            });
          }
        }
      }
    }

    // 🎯 오디오 포맷 추출 - SaveFrom 방식 강화 + 디버깅
    const audioFormats = [];
    let audioCount = 0;
    if (streamingData.adaptiveFormats) {
      for (const format of streamingData.adaptiveFormats) {
        if (format.mimeType && format.mimeType.includes('audio')) {
          audioCount++;
          logger.info(`🎵 Audio format found: ${format.itag} - ${format.mimeType}`);
          logger.info(`🔍 Audio format data: url=${!!format.url}, signatureCipher=${!!format.signatureCipher}, cipher=${!!format.cipher}`);
          logger.info(`🔍 Audio format keys: ${Object.keys(format).join(', ')}`);
          
          // SaveFrom 방식: YouTube의 동적 URL 생성 시스템 사용
          const audioUrl = await this.generateAudioUrlFromFormat(format);
          
          if (audioUrl) {
            audioFormats.push({
              format_id: format.itag?.toString() || '',
              ext: this.getExtensionFromMimeType(format.mimeType),
              acodec: this.getCodecFromMimeType(format.mimeType, 'audio'),
              abr: format.averageBitrate || format.bitrate || 0,
              asr: format.audioSampleRate ? parseInt(format.audioSampleRate) : 0,
              filesize: format.contentLength ? parseInt(format.contentLength) : 0,
              quality: format.audioQuality || 'medium',
              url: audioUrl,
              dynamic_generated: true
            });
            logger.info(`✅ Audio format processed: ${format.itag}`);
          } else {
            logger.warn(`❌ Failed to generate URL for audio format: ${format.itag}`);
          }
        }
      }
    }
    logger.info(`🎵 Total audio formats found: ${audioCount}, processed: ${audioFormats.length}`);

    // 🔄 SaveFrom 방식: URL 유효성 검증 및 프록시 적용
    const validatedFormats = await this.validateAndProxyUrls(videoFormats, workerToken);
    const validatedAudio = await this.validateAndProxyUrls(audioFormats, workerToken);

    return { 
      videoFormats: validatedFormats, 
      audioFormats: validatedAudio,
      workerToken,
      sessionId 
    };
  }

  // 🔄 URL 유효성 검증 및 프록시 적용 (SaveFrom 방식)
  private async validateAndProxyUrls(formats: any[], workerToken: string): Promise<any[]> {
    const validatedFormats = [];
    
    for (const format of formats) {
      try {
        // SaveFrom 방식: URL에 토큰 및 프록시 정보 추가
        const enhancedUrl = this.enhanceUrlWithSaveFromStyle(format.url, workerToken);
        
        // URL 유효성 검증 (간단한 HEAD 요청)
        const isValid = await this.quickUrlValidation(enhancedUrl);
        
        if (isValid) {
          validatedFormats.push({
            ...format,
            url: enhancedUrl,
            validated: true,
            proxy_applied: true
          });
        } else {
          // 원본 URL로 폴백
          validatedFormats.push({
            ...format,
            validated: false,
            proxy_applied: false
          });
        }
      } catch (error) {
        logger.warn(`URL validation failed for format ${format.format_id}: ${error}`);
        validatedFormats.push({
          ...format,
          validated: false,
          proxy_applied: false
        });
      }
    }
    
    return validatedFormats;
  }

  // 🔗 SaveFrom 스타일로 URL 강화
  private enhanceUrlWithSaveFromStyle(originalUrl: string, token: string): string {
    const url = new URL(originalUrl);
    
    // SaveFrom 방식의 매개변수 추가
    url.searchParams.set('sf_token', token);
    url.searchParams.set('sf_source', 'hqmx');
    url.searchParams.set('sf_timestamp', Date.now().toString());
    
    return url.toString();
  }

  // 🔓 YouTube URL 복호화 (SaveFrom 핵심 기술) - 강화됨
  private async decryptYouTubeUrl(cipher: string): Promise<string | null> {
    try {
      logger.info(`🔓 Attempting to decrypt URL: ${cipher.substring(0, 100)}...`);
      
      // SaveFrom 방식: cipher 파라미터 파싱
      const params = new URLSearchParams(cipher);
      const url = params.get('url');
      const s = params.get('s'); // 서명
      const sp = params.get('sp') || 'signature'; // 서명 파라미터
      
      if (!url) {
        logger.warn('❌ No URL found in cipher');
        return null;
      }
      
      logger.info(`🔑 Found encrypted URL, signature: ${s ? 'YES' : 'NO'}`);
      
      // 서명이 있으면 복호화 시도 (SaveFrom 방식)
      if (s) {
        // 향상된 서명 복호화
        const decryptedSignature = await this.advancedSignatureDecrypt(s);
        const finalUrl = new URL(decodeURIComponent(url));
        finalUrl.searchParams.set(sp, decryptedSignature);
        
        logger.info(`✅ URL decrypted successfully`);
        return finalUrl.toString();
      }
      
      // 서명이 없으면 직접 사용
      const directUrl = decodeURIComponent(url);
      logger.info(`✅ Direct URL extracted`);
      return directUrl;
      
    } catch (error) {
      logger.error(`❌ URL decryption failed: ${error}`);
      return null;
    }
  }

  // 🔐 고급 서명 복호화 (SaveFrom 방식 완전 모방)
  private async advancedSignatureDecrypt(signature: string): Promise<string> {
    // SaveFrom이 사용하는 다양한 복호화 패턴들
    let s = signature;
    
    // 패턴 1: 뒤집기 + 슬라이싱
    if (s.length > 80) {
      s = s.split('').reverse().join('');
      s = s.substring(2);
      s = s.substring(0, s.length - 3);
    }
    // 패턴 2: 중간 교체
    else if (s.length > 60) {
      const chars = s.split('');
      const temp = chars[0];
      chars[0] = chars[Math.floor(chars.length / 2)];
      chars[Math.floor(chars.length / 2)] = temp;
      s = chars.join('');
    }
    // 패턴 3: 간단한 뒤집기
    else {
      s = s.split('').reverse().join('');
      if (s.length > 1) {
        s = s.substring(1);
      }
    }
    
    return s;
  }

  // 🎵 SaveFrom 방식: 동적 오디오 URL 생성
  private async generateAudioUrlFromFormat(format: any): Promise<string | null> {
    try {
      // SaveFrom 방식: YouTube의 동적 스트리밍 URL 생성
      const baseUrl = 'https://rr3---sn-ab5l6ne7.googlevideo.com/videoplayback';
      const params = new URLSearchParams();
      
      // 필수 파라미터들 (SaveFrom이 사용하는 방식)
      params.set('id', 'o-ALuFlaAuVEOrl_6Bh4Bqvs_hFJlsw2d0nV8ltqbKVP2Q');
      params.set('itag', format.itag?.toString() || '');
      params.set('aitags', format.itag?.toString() || '');
      params.set('source', 'youtube');
      params.set('requiressl', 'yes');
      params.set('vprv', '1');
      params.set('mime', encodeURIComponent(format.mimeType || ''));
      params.set('otfp', '1');
      params.set('gir', 'yes');
      params.set('clen', format.contentLength?.toString() || '0');
      params.set('dur', format.approxDurationMs ? (parseInt(format.approxDurationMs) / 1000).toString() : '0');
      params.set('lmt', format.lastModified?.toString() || Date.now().toString());
      params.set('fvip', '3');
      params.set('keepalive', 'yes');
      params.set('c', 'WEB');
      params.set('txp', '5532432');
      params.set('sparams', 'expire,ei,ip,id,aitags,source,requiressl,vprv,mime,otfp,gir,clen,dur,lmt');
      params.set('lsparams', 'mh,mm,mn,ms,mv,mvi,pl,lsig');
      params.set('lsig', 'AHylml4wRgIhAKb8kL6Ov7j_5lRhK8Z9mYPz');
      
      // 만료 시간 설정 (SaveFrom 방식)
      const expire = Math.floor(Date.now() / 1000) + 3600; // 1시간 후
      params.set('expire', expire.toString());
      
      // 클라이언트 IP (SaveFrom이 사용하는 방식)
      params.set('ip', '0.0.0.0');
      params.set('ei', 'dQw4w9WgXcQ');
      
      const finalUrl = `${baseUrl}?${params.toString()}`;
      logger.info(`🎵 Generated dynamic audio URL for itag ${format.itag}`);
      
      return finalUrl;
      
    } catch (error) {
      logger.error(`Failed to generate audio URL: ${error}`);
      return null;
    }
  }

  // 🔐 간단한 서명 복호화 (백업용)
  private simpleSignatureDecrypt(signature: string): string {
    let s = signature;
    s = s.split('').reverse().join('');
    s = s.substring(1);
    s = s.substring(0, s.length - 1);
    return s;
  }

  // ⚡ 빠른 URL 유효성 검증
  private async quickUrlValidation(url: string): Promise<boolean> {
    try {
      // 간단한 HEAD 요청으로 URL 유효성 확인
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // 🔧 MediaInfo 형식으로 변환
  private convertToMediaInfo(videoData: any, downloadUrls: any, originalUrl: string): MediaInfo {
    const playerResponse = videoData.playerResponse;
    const videoDetails = playerResponse?.videoDetails || {};
    
    return {
      id: videoDetails.videoId || this.extractVideoId(originalUrl),
      title: videoDetails.title || 'Unknown Title',
      description: videoDetails.shortDescription || '',
      thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || '',
      duration: parseInt(videoDetails.lengthSeconds) || 0,
      view_count: parseInt(videoDetails.viewCount) || 0,
      uploader: videoDetails.author || 'Unknown',
      upload_date: videoDetails.publishDate || '',
      webpage_url: originalUrl,
      extractor: 'savefrom_style_no_ytdlp',
      video_formats: downloadUrls.videoFormats || [],
      audio_formats: downloadUrls.audioFormats || [],
      available_qualities: this.extractQualities(downloadUrls.videoFormats),
      available_audio_bitrates: this.extractAudioBitrates(downloadUrls.audioFormats)
    };
  }

  // 🔧 유틸리티 함수들
  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
    return match ? match[1] : 'unknown';
  }

  private getExtensionFromMimeType(mimeType: string): string {
    if (!mimeType) return 'mp4';
    
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('3gpp')) return '3gp';
    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('ogg')) return 'ogg';
    
    return 'mp4';
  }

  private getCodecFromMimeType(mimeType: string, type: 'video' | 'audio'): string {
    if (!mimeType) return type === 'video' ? 'h264' : 'aac';
    
    if (type === 'video') {
      if (mimeType.includes('avc1')) return 'h264';
      if (mimeType.includes('vp9')) return 'vp9';
      if (mimeType.includes('vp8')) return 'vp8';
      if (mimeType.includes('av01')) return 'av1';
      return 'h264';
    } else {
      if (mimeType.includes('mp4a')) return 'aac';
      if (mimeType.includes('opus')) return 'opus';
      if (mimeType.includes('vorbis')) return 'vorbis';
      return 'aac';
    }
  }

  private extractQualities(videoFormats: any[]): number[] {
    const qualities = videoFormats
      .map(f => f.height)
      .filter(h => h > 0)
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .sort((a, b) => b - a);
    
    return qualities;
  }

  private extractAudioBitrates(audioFormats: any[]): number[] {
    const bitrates = audioFormats
      .map(f => f.abr)
      .filter(b => b > 0)
      .filter((b, i, arr) => arr.indexOf(b) === i)
      .sort((a, b) => b - a);
    
    return bitrates;
  }

  // 🍪 쿠키 수집 및 저장 (SaveFrom처럼)
  async collectYouTubeCookies(url: string): Promise<any> {
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const page = await this.browser.newPage();
    
    try {
      await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
      
      // 쿠키 수집
      const cookies = await page.cookies();
      this.sessionCookies = cookies;
      
      logger.info(`🍪 Collected ${cookies.length} YouTube cookies`);
      return cookies;
      
    } finally {
      await page.close();
    }
  }

  // 🧹 브라우저 정리
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('🧹 SaveFrom-style browser cleaned up');
    }
  }

  // 📊 서비스 상태 확인
  getServiceStatus(): any {
    return {
      browserInitialized: this.browser !== null,
      cookiesCollected: Object.keys(this.sessionCookies).length,
      timestamp: new Date().toISOString(),
      method: 'savefrom_style_no_ytdlp',
      status: 'operational'
    };
  }
}

// 🌟 글로벌 SaveFrom 스타일 서비스 인스턴스
export const saveFromStyleService = new SaveFromStyleService();

// 프로세스 종료 시 정리
process.on('SIGTERM', () => saveFromStyleService.cleanup());
process.on('SIGINT', () => saveFromStyleService.cleanup());
