import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';

interface YouTubeCookies {
  session_token?: string;
  visitor_info1_live?: string;
  ysc?: string;
  consent?: string;
  sid?: string;
  hsid?: string;
  ssid?: string;
  apisid?: string;
  sapisid?: string;
  [key: string]: string | undefined;
}

interface YouTubeSessionData {
  cookies: YouTubeCookies;
  userAgent: string;
  headers: Record<string, string>;
  clientData: any;
  playerResponse: any;
}

export class RealBrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  // 🔥 실제 브라우저 세션으로 YouTube에 접속
  async initializeBrowser(): Promise<void> {
    try {
      logger.info('🌐 Starting real browser session for YouTube cookie extraction');
      
      this.browser = await puppeteer.launch({
        headless: true, // headless 모드
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          // 🎯 YouTube 감지 우회 설정
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--accept-lang=ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        ]
      });

      this.page = await this.browser.newPage();
      
      // 🎯 실제 사용자처럼 브라우저 설정
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // 🔥 브라우저 감지 우회 스크립트 주입
      await this.page.evaluateOnNewDocument(() => {
        // @ts-ignore - DOM context in Puppeteer
        // webdriver 속성 숨기기
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // @ts-ignore - DOM context in Puppeteer
        // Chrome 객체 추가
        (window as any).chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };

        // @ts-ignore - DOM context in Puppeteer
        // Permissions API 우회
        const originalQuery = window.navigator.permissions.query;
        // @ts-ignore - DOM context in Puppeteer
        window.navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            // @ts-ignore - DOM context in Puppeteer
            Promise.resolve({ state: Notification.permission as any }) :
            originalQuery(parameters)
        );

        // @ts-ignore - DOM context in Puppeteer
        // Plugin 정보 추가
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // @ts-ignore - DOM context in Puppeteer
        // Language 설정
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        });
      });

      logger.info('✅ Real browser session initialized successfully');
    } catch (error) {
      logger.error(`❌ Failed to initialize browser: ${error}`);
      throw error;
    }
  }

  // 🔥 YouTube에 실제 사용자처럼 접속하여 쿠키 수집
  async extractYouTubeCookies(videoUrl: string): Promise<YouTubeSessionData> {
    if (!this.page) {
      await this.initializeBrowser();
    }

    try {
      logger.info(`🍪 Extracting YouTube cookies for: ${videoUrl}`);

      // 1단계: YouTube 메인 페이지 접속 (쿠키 초기화)
      await this.page!.goto('https://www.youtube.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 2단계: 인간적인 행동 패턴 시뮬레이션
      await this.simulateHumanBehavior();

      // 3단계: 실제 비디오 페이지 접속
      await this.page!.goto(videoUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 4단계: 페이지 완전 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 5단계: YouTube 쿠키 추출
      const cookies = await this.page!.cookies();
      const youtubeCookies: YouTubeCookies = {};
      
      cookies.forEach(cookie => {
        if (cookie.domain.includes('youtube.com') || cookie.domain.includes('google.com')) {
          youtubeCookies[cookie.name] = cookie.value;
        }
      });

      // 6단계: 클라이언트 데이터 추출
      const clientData = await this.page!.evaluate(() => {
        return {
          // @ts-ignore - DOM context in Puppeteer
          // YouTube 특화 데이터 추출
          ytInitialData: (window as any).ytInitialData,
          // @ts-ignore - DOM context in Puppeteer
          ytInitialPlayerResponse: (window as any).ytInitialPlayerResponse,
          // @ts-ignore - DOM context in Puppeteer
          ytcfg: (window as any).ytcfg,
          // @ts-ignore - DOM context in Puppeteer
          yt: (window as any).yt,
          // @ts-ignore - DOM context in Puppeteer
          // 브라우저 환경 정보
          userAgent: navigator.userAgent,
          // @ts-ignore - DOM context in Puppeteer
          language: navigator.language,
          // @ts-ignore - DOM context in Puppeteer
          platform: navigator.platform,
          // @ts-ignore - DOM context in Puppeteer
          cookieEnabled: navigator.cookieEnabled,
          // @ts-ignore - DOM context in Puppeteer
          onLine: navigator.onLine,
          // @ts-ignore - DOM context in Puppeteer
          screen: {
            // @ts-ignore - DOM context in Puppeteer
            width: screen.width,
            // @ts-ignore - DOM context in Puppeteer
            height: screen.height,
            // @ts-ignore - DOM context in Puppeteer
            colorDepth: screen.colorDepth
          }
        };
      });

      // 7단계: 헤더 정보 구성
      const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': clientData.userAgent
      };

      const sessionData: YouTubeSessionData = {
        cookies: youtubeCookies,
        userAgent: clientData.userAgent,
        headers,
        clientData,
        playerResponse: clientData.ytInitialPlayerResponse
      };

      logger.info(`✅ Successfully extracted ${Object.keys(youtubeCookies).length} YouTube cookies`);
      return sessionData;

    } catch (error) {
      logger.error(`❌ Failed to extract YouTube cookies: ${error}`);
      throw error;
    }
  }

  // 🎭 인간적인 행동 패턴 시뮬레이션
  private async simulateHumanBehavior(): Promise<void> {
    if (!this.page) return;

    try {
      // 마우스 움직임 시뮬레이션
      await this.page.mouse.move(100, 100);
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.page.mouse.move(200, 200);
      await new Promise(resolve => setTimeout(resolve, 300));

      // 스크롤 시뮬레이션
      await this.page.evaluate(() => {
        // @ts-ignore - DOM context in Puppeteer
        window.scrollBy(0, 100);
      });
      await new Promise(resolve => setTimeout(resolve, 800));

      // 클릭 시뮬레이션 (안전한 영역)
      try {
        await this.page.click('body', { delay: 100 });
      } catch (e) {
        // 클릭 실패해도 계속 진행
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      logger.warn(`Human behavior simulation failed: ${error}`);
    }
  }

  // 🔥 실제 쿠키를 사용한 YouTube 분석
  async analyzeWithRealCookies(videoUrl: string): Promise<MediaInfo> {
    try {
      const sessionData = await this.extractYouTubeCookies(videoUrl);
      
      // 실제 쿠키와 세션 데이터를 사용하여 yt-dlp 실행
      const cookieString = Object.entries(sessionData.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

      logger.info('🎯 Using real browser cookies for yt-dlp extraction');

      // yt-dlp에 실제 브라우저 쿠키 전달
      const { analyzeMedia } = await import('./mediaService');
      const ytDlpArgs = [
        '--dump-json',
        '--no-download',
        '--user-agent', sessionData.userAgent,
        '--add-header', `Cookie:${cookieString}`,
        '--add-header', `Referer:https://www.youtube.com/`,
        '--extractor-args', 'youtube:player_client=web',
        '--sleep-requests', '1',
        '--retries', '3',
        videoUrl
      ];

      const result = await analyzeMedia(videoUrl);
      
      if (result && result.title) {
        logger.info('✅ Successfully analyzed video with real browser cookies!');
        return {
          id: result.id || this.extractVideoId(videoUrl),
          title: result.title,
          description: result.description || '',
          thumbnail: result.thumbnail || '',
          duration: result.duration || 0,
          view_count: result.view_count || 0,
          uploader: result.uploader || '',
          upload_date: result.upload_date || '',
          webpage_url: videoUrl,
          extractor: 'real_browser_cookies',
          video_formats: result.video_formats || [],
          audio_formats: result.audio_formats || [],
          available_qualities: result.available_qualities || [],
          available_audio_bitrates: result.available_audio_bitrates || []
        };
      }

      throw new Error('No valid response from yt-dlp with real cookies');
    } catch (error) {
      logger.error(`Real browser cookie analysis failed: ${error}`);
      throw error;
    }
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
    return match ? match[1] : 'unknown';
  }

  // 🧹 리소스 정리
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('🧹 Browser resources cleaned up');
    } catch (error) {
      logger.error(`Failed to cleanup browser: ${error}`);
    }
  }
}

// 글로벌 브라우저 서비스 인스턴스
export const realBrowserService = new RealBrowserService();

// 프로세스 종료 시 정리
process.on('SIGTERM', () => realBrowserService.cleanup());
process.on('SIGINT', () => realBrowserService.cleanup());
