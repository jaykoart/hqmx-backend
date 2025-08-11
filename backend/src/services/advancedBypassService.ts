import { logger } from '../utils/logger';
import { UserProfile, UserProfileService } from './userProfileService';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface BypassOptions {
  userProfile: UserProfile;
  useProxy?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export class AdvancedBypassService {
  private browser: Browser | null = null;
  private sessionCookies: { [domain: string]: any[] } = {};

  constructor() {
    this.initializeBrowser();
  }

  /**
   * 🔥 HAR 분석 기반 SaveFrom 완전 모방 시스템
   */
  async analyzeWithUserMimic(url: string, options: BypassOptions): Promise<any> {
    try {
      logger.info('🎭 Starting user-mimic analysis with SaveFrom patterns');
      
      await this.initializeBrowser();
      const page = await this.browser!.newPage();

      // 1. 사용자 프로필 적용
      await this.applyUserProfile(page, options.userProfile);
      
      // 2. SaveFrom 스타일 세션 초기화
      await this.initializeSaveFromSession(page, options.userProfile);
      
      // 3. YouTube 페이지 접근 (SaveFrom 패턴)
      const videoData = await this.accessYouTubeWithSaveFromPattern(page, url, options.userProfile);
      
      // 4. 고급 데이터 추출
      const mediaInfo = await this.extractWithAdvancedTechniques(page, videoData);
      
      await page.close();
      
      logger.info('✅ User-mimic analysis completed successfully');
      return mediaInfo;
      
    } catch (error: any) {
      logger.error('❌ User-mimic analysis failed:', error);
      throw error;
    }
  }

  /**
   * 🎭 사용자 프로필 완전 적용
   */
  private async applyUserProfile(page: Page, profile: UserProfile): Promise<void> {
    logger.info('🎯 Applying comprehensive user profile');

    // User-Agent 설정
    await page.setUserAgent(profile.userAgent);
    
    // 뷰포트 설정
    await page.setViewport({
      width: profile.screen.width,
      height: profile.screen.height
    });

    // 지리적 위치 설정
    if (profile.timezone) {
      await page.emulateTimezone(profile.timezone);
    }

    // 언어 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': profile.languages.join(','),
    });

    // 고급 브라우저 환경 설정
    await page.evaluateOnNewDocument((profile: UserProfile) => {
      // Screen 정보 오버라이드
      Object.defineProperty(window.screen, 'width', { value: profile.screen.width });
      Object.defineProperty(window.screen, 'height', { value: profile.screen.height });
      Object.defineProperty(window.screen, 'availWidth', { value: profile.screen.availWidth });
      Object.defineProperty(window.screen, 'availHeight', { value: profile.screen.availHeight });
      Object.defineProperty(window.screen, 'colorDepth', { value: profile.screen.colorDepth });
      Object.defineProperty(window.screen, 'pixelDepth', { value: profile.screen.pixelDepth });

      // Navigator 정보 오버라이드
      Object.defineProperty(navigator, 'platform', { value: profile.platform });
      Object.defineProperty(navigator, 'language', { value: profile.language });
      Object.defineProperty(navigator, 'languages', { value: profile.languages });

      // WebDriver 감지 우회
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Chrome runtime 시뮬레이션
      (window as any).chrome = {
        runtime: {
          onConnect: null,
          onMessage: null
        },
        loadTimes: function() {
          return {
            requestTime: profile.timestamp / 1000,
            startLoadTime: profile.timestamp / 1000,
            commitLoadTime: profile.timestamp / 1000,
            finishDocumentLoadTime: profile.timestamp / 1000,
            finishLoadTime: profile.timestamp / 1000,
            firstPaintTime: profile.timestamp / 1000,
            firstPaintAfterLoadTime: 0,
            navigationType: "Other"
          };
        },
        csi: function() {
          return {
            startE: profile.timestamp,
            onloadT: profile.timestamp,
            pageT: Date.now() - profile.timestamp,
            tran: 15
          };
        }
      };

      // Plugin 정보 설정
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: null },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: null },
            description: "Portable Document Format", 
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          }
        ]
      });

      // Canvas 핑거프린트 조작
      if (profile.fingerprint.canvas) {
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
          return profile.fingerprint.canvas!;
        };
      }

      // WebGL 정보 조작
      if (profile.fingerprint.webgl) {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return profile.fingerprint.webgl!.vendor;
          if (parameter === 37446) return profile.fingerprint.webgl!.renderer;
          return getParameter.call(this, parameter);
        };
      }

      // Permissions API 조작
      const originalQuery = navigator.permissions.query;
      (navigator.permissions as any).query = (parameters: any) => {
        return Promise.resolve({ 
          state: 'granted',
          name: parameters.name || 'unknown',
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true
        });
      };

    }, profile);
  }

  /**
   * 🍪 SaveFrom 스타일 세션 초기화
   */
  private async initializeSaveFromSession(page: Page, profile: UserProfile): Promise<void> {
    logger.info('🔑 Initializing SaveFrom-style session');

    // YouTube 도메인 쿠키 설정
    const youtubeDomain = 'https://www.youtube.com';
    await page.goto(youtubeDomain, { waitUntil: 'networkidle0' });

    // SaveFrom HAR에서 분석한 필수 쿠키들
    const cookies = [
      {
        name: 'CONSENT',
        value: 'YES+cb.20210720-07-p0.en+FX+410',
        domain: '.youtube.com'
      },
      {
        name: 'YSC',
        value: this.generateYouTubeSessionId(),
        domain: '.youtube.com'
      },
      {
        name: 'VISITOR_INFO1_LIVE',
        value: this.generateVisitorInfo(),
        domain: '.youtube.com'
      },
      {
        name: 'GPS',
        value: '1',
        domain: '.youtube.com'
      },
      {
        name: 'PREF',
        value: `f4=4000000&tz=${profile.timezone.replace('/', '.')}&f6=40000000&f5=30000`,
        domain: '.youtube.com'
      }
    ];

    for (const cookie of cookies) {
      await page.setCookie(cookie);
    }

    // SaveFrom worker 토큰 생성
    const workerToken = this.generateSaveFromWorkerToken();
    await page.setCookie({
      name: 'sf-token',
      value: workerToken,
      domain: '.youtube.com'
    });

    logger.info('✅ SaveFrom session initialized');
  }

  /**
   * 🎯 SaveFrom 패턴으로 YouTube 접근
   */
  private async accessYouTubeWithSaveFromPattern(page: Page, url: string, profile: UserProfile): Promise<any> {
    logger.info('🎬 Accessing YouTube with SaveFrom access pattern');

    // 1. 먼저 YouTube 홈페이지 방문 (실제 사용자 행동 모방)
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle0' });
    
    // 2. 사용자 행동 패턴 시뮬레이션
    await this.simulateUserBehavior(page, profile.behaviorPattern);
    
    // 3. 목표 비디오로 이동
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // 4. 페이지 로딩 후 추가 행동 시뮬레이션
    await this.simulateVideoPageBehavior(page, profile.behaviorPattern);
    
    // 5. YouTube 데이터 추출
    return await this.extractYouTubeData(page);
  }

  /**
   * 🎭 사용자 행동 패턴 시뮬레이션
   */
  private async simulateUserBehavior(page: Page, behaviorPattern: UserProfile['behaviorPattern']): Promise<void> {
    logger.info('🎪 Simulating realistic user behavior');

    try {
      // 클릭 패턴 시뮬레이션
      for (const click of behaviorPattern.clickPattern) {
        await page.waitForSelector(click.selector, { timeout: 5000 }).catch(() => {});
        await page.click(click.selector).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, click.delay));
      }

      // 스크롤 패턴 시뮬레이션
      for (const scroll of behaviorPattern.scrollPattern) {
        await page.evaluate((x, y) => {
          window.scrollTo(x, y);
        }, scroll.x, scroll.y);
        await new Promise(resolve => setTimeout(resolve, scroll.wait));
      }
    } catch (error) {
      logger.warn('⚠️ Behavior simulation partially failed:', error);
    }
  }

  /**
   * 📺 비디오 페이지 특화 행동 시뮬레이션
   */
  private async simulateVideoPageBehavior(page: Page, behaviorPattern: UserProfile['behaviorPattern']): Promise<void> {
    logger.info('📺 Simulating video page specific behavior');

    try {
      // 플레이어 로딩 대기
      await page.waitForSelector('#movie_player', { timeout: 10000 });
      
      // 비디오 메타데이터 로딩 대기
      await page.waitForFunction(() => {
        return (window as any).ytInitialPlayerResponse || 
               document.querySelector('script[nonce]')?.textContent?.includes('ytInitialPlayerResponse');
      }, { timeout: 15000 });

      // 플레이어와 상호작용
      await page.hover('#movie_player').catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 설명란까지 스크롤
      await page.evaluate(() => {
        window.scrollTo(0, 400);
      });
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      logger.warn('⚠️ Video page behavior simulation failed:', error);
    }
  }

  /**
   * 🎯 고급 기법으로 YouTube 데이터 추출
   */
  private async extractYouTubeData(page: Page): Promise<any> {
    logger.info('🔍 Extracting YouTube data with advanced techniques');

    return await page.evaluate(() => {
      try {
        // 1. Window 객체에서 직접 추출
        let playerResponse = (window as any).ytInitialPlayerResponse;
        let initialData = (window as any).ytInitialData;

        // 2. 스크립트 태그에서 추출
        if (!playerResponse) {
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const content = script.textContent || '';
            
            // ytInitialPlayerResponse 추출
            if (content.includes('ytInitialPlayerResponse') && !playerResponse) {
              const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
              if (match) {
                try {
                  playerResponse = JSON.parse(match[1]);
                } catch (e) {
                  console.log('PlayerResponse parse error:', e);
                }
              }
            }
            
            // ytInitialData 추출
            if (content.includes('ytInitialData') && !initialData) {
              const match = content.match(/ytInitialData\s*=\s*({.+?});/);
              if (match) {
                try {
                  initialData = JSON.parse(match[1]);
                } catch (e) {
                  console.log('InitialData parse error:', e);
                }
              }
            }
          }
        }

        // 3. DOM에서 추가 정보 추출
        const videoTitle = document.querySelector('meta[name="title"]')?.getAttribute('content') ||
                          document.querySelector('title')?.textContent ||
                          'Unknown Title';

        return {
          success: !!(playerResponse?.streamingData),
          playerResponse,
          initialData,
          title: videoTitle,
          url: window.location.href,
          timestamp: Date.now()
        };

      } catch (error) {
        return {
          success: false,
          error: error.toString(),
          timestamp: Date.now()
        };
      }
    });
  }

  /**
   * 🎵 고급 기법으로 미디어 정보 생성
   */
  private async extractWithAdvancedTechniques(page: Page, videoData: any): Promise<any> {
    if (!videoData.success || !videoData.playerResponse?.streamingData) {
      throw new Error(`Advanced extraction failed: ${videoData.error || 'No streaming data'}`);
    }

    const playerResponse = videoData.playerResponse;
    const streamingData = playerResponse.streamingData;
    
    // 포맷 처리
    const formats = streamingData.formats || [];
    const adaptiveFormats = streamingData.adaptiveFormats || [];
    
    const videoFormats = formats
      .filter((f: any) => f.mimeType?.includes('video'))
      .slice(0, 3)
      .map((f: any) => ({
        format_id: f.itag?.toString(),
        url: f.url || this.generateFallbackUrl(videoData.url, f.itag),
        ext: 'mp4',
        quality: f.qualityLabel || 'unknown',
        filesize: parseInt(f.contentLength || '0')
      }));

    const audioFormats = adaptiveFormats
      .filter((f: any) => f.mimeType?.includes('audio'))
      .slice(0, 4)
      .map((f: any) => ({
        format_id: f.itag?.toString(),
        url: f.url || this.generateFallbackUrl(videoData.url, f.itag),
        ext: f.mimeType?.includes('webm') ? 'webm' : 'mp4',
        quality: f.audioQuality || 'unknown',
        bitrate: f.bitrate || 128
      }));

    return {
      title: videoData.title,
      duration: parseInt(playerResponse.videoDetails?.lengthSeconds || '0'),
      view_count: parseInt(playerResponse.videoDetails?.viewCount || '0'),
      video_formats: videoFormats,
      audio_formats: audioFormats,
      available_qualities: videoFormats.map((f: any) => f.quality),
      available_audio_bitrates: audioFormats.map((f: any) => f.bitrate),
      extractor: 'hqmx_advanced_bypass'
    };
  }

  // 유틸리티 메서드들
  private async initializeBrowser(): Promise<void> {
    if (this.browser) return;

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
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      timeout: 30000
    });
  }

  private generateYouTubeSessionId(): string {
    return Array.from({ length: 20 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        .charAt(Math.floor(Math.random() * 62))
    ).join('');
  }

  private generateVisitorInfo(): string {
    return Array.from({ length: 22 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        .charAt(Math.floor(Math.random() * 62))
    ).join('');
  }

  private generateSaveFromWorkerToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return Buffer.from(`${timestamp}-${random}-savefrom`).toString('base64');
  }

  private generateFallbackUrl(originalUrl: string, itag: number): string {
    const videoId = originalUrl.match(/[?&]v=([^&]+)/)?.[1] || 'unknown';
    return `https://www.youtube.com/watch?v=${videoId}&itag=${itag}`;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const advancedBypassService = new AdvancedBypassService();
