import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';
import puppeteer, { Browser, Page } from 'puppeteer';
import { solveYouTubeCaptcha } from './captchaSolvingService';

interface BrowserInstance {
  id: string;
  browser: Browser;
  page: Page;
  busy: boolean;
  created: number;
  lastUsed: number;
  userAgent: string;
  proxy?: string;
}

interface BrowserFarmOptions {
  maxInstances: number;
  maxIdleTime: number; // ms
  maxLifetime: number; // ms
  userAgents: string[];
  proxies?: string[];
}

class BrowserFarm {
  private instances: Map<string, BrowserInstance> = new Map();
  private options: BrowserFarmOptions;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: Partial<BrowserFarmOptions> = {}) {
    this.options = {
      maxInstances: options.maxInstances || 10,
      maxIdleTime: options.maxIdleTime || 300000, // 5분
      maxLifetime: options.maxLifetime || 1800000, // 30분
      userAgents: options.userAgents || [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      ],
      proxies: options.proxies || []
    };

    // 정기적으로 오래된 인스턴스 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupInstances();
    }, 60000); // 1분마다
  }

  // 사용 가능한 브라우저 인스턴스 가져오기
  async getAvailableInstance(userInfo?: any): Promise<BrowserInstance> {
    // 기존 사용 가능한 인스턴스 찾기
    for (const instance of this.instances.values()) {
      if (!instance.busy && this.isInstanceHealthy(instance)) {
        instance.busy = true;
        instance.lastUsed = Date.now();
        return instance;
      }
    }

    // 새 인스턴스 생성
    if (this.instances.size < this.options.maxInstances) {
      return await this.createInstance(userInfo);
    }

    // 대기 중인 인스턴스가 없으면 잠시 대기 후 재시도
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.getAvailableInstance(userInfo);
  }

  // 새 브라우저 인스턴스 생성
  private async createInstance(userInfo?: any): Promise<BrowserInstance> {
    const instanceId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userAgent = this.selectUserAgent(userInfo);
    const proxy = this.selectProxy();

    logger.info(`Creating new browser instance: ${instanceId}`);

    try {
      const launchOptions: any = {
        headless: 'new',
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
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          `--user-agent=${userAgent}`
        ]
      };

      // 프록시 설정
      if (proxy) {
        launchOptions.args.push(`--proxy-server=${proxy}`);
      }

      const browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();

      // 페이지 설정
      await this.setupPage(page, userAgent, userInfo);

      const instance: BrowserInstance = {
        id: instanceId,
        browser,
        page,
        busy: true,
        created: Date.now(),
        lastUsed: Date.now(),
        userAgent,
        proxy
      };

      this.instances.set(instanceId, instance);
      logger.info(`Browser instance created: ${instanceId}`);

      return instance;
    } catch (error) {
      logger.error(`Failed to create browser instance: ${error}`);
      throw error;
    }
  }

  // 페이지 초기 설정
  private async setupPage(page: Page, userAgent: string, userInfo?: any): Promise<void> {
    // User-Agent 설정
    await page.setUserAgent(userAgent);

    // 뷰포트 설정
    const viewport = userInfo?.screen ? {
      width: userInfo.screen.width,
      height: userInfo.screen.height
    } : {
      width: 1920,
      height: 1080
    };
    await page.setViewport(viewport);

    // 추가 헤더 설정
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': userInfo?.language || 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    // JavaScript 실행 환경 수정 (봇 감지 우회)
    await page.evaluateOnNewDocument(() => {
      // @ts-ignore - Puppeteer context
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // @ts-ignore - Puppeteer context
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      // @ts-ignore - Puppeteer context
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore - Puppeteer context
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Seoul' ? 'denied' : 'granted' }) :
          originalQuery(parameters)
      );

      // @ts-ignore - Puppeteer context
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // @ts-ignore - Puppeteer context
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // 쿠키 설정 (사용자 제공 시)
    if (userInfo?.youtubeData?.youtubeCookies) {
      const cookies = Object.entries(userInfo.youtubeData.youtubeCookies).map(([name, value]) => ({
        name,
        value: value as string,
        domain: '.youtube.com',
        path: '/'
      }));

      await page.setCookie(...cookies);
    }
  }

  // User-Agent 선택
  private selectUserAgent(userInfo?: any): string {
    if (userInfo?.userAgent) {
      return userInfo.userAgent;
    }
    return this.options.userAgents[Math.floor(Math.random() * this.options.userAgents.length)];
  }

  // 프록시 선택
  private selectProxy(): string | undefined {
    if (this.options.proxies && this.options.proxies.length > 0) {
      return this.options.proxies[Math.floor(Math.random() * this.options.proxies.length)];
    }
    return undefined;
  }

  // 인스턴스 상태 확인
  private isInstanceHealthy(instance: BrowserInstance): boolean {
    const now = Date.now();
    const age = now - instance.created;
    const idle = now - instance.lastUsed;

    return age < this.options.maxLifetime && idle < this.options.maxIdleTime;
  }

  // 인스턴스 반환
  releaseInstance(instance: BrowserInstance): void {
    instance.busy = false;
    instance.lastUsed = Date.now();
  }

  // 오래된 인스턴스 정리
  private async cleanupInstances(): Promise<void> {
    const toRemove: string[] = [];

    for (const [id, instance] of this.instances.entries()) {
      if (!instance.busy && !this.isInstanceHealthy(instance)) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const instance = this.instances.get(id);
      if (instance) {
        try {
          await instance.browser.close();
          this.instances.delete(id);
          logger.info(`Cleaned up browser instance: ${id}`);
        } catch (error) {
          logger.error(`Failed to cleanup browser instance ${id}: ${error}`);
        }
      }
    }
  }

  // 팜 종료
  async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval);

    const closePromises = Array.from(this.instances.values()).map(async (instance) => {
      try {
        await instance.browser.close();
      } catch (error) {
        logger.error(`Failed to close browser instance ${instance.id}: ${error}`);
      }
    });

    await Promise.all(closePromises);
    this.instances.clear();
    logger.info('Browser farm shutdown completed');
  }
}

// 글로벌 브라우저 팜 인스턴스
const browserFarm = new BrowserFarm();

// YouTube 분석을 위한 브라우저 기반 추출
export async function extractWithBrowserFarm(url: string, userInfo: any): Promise<MediaInfo> {
  let instance: BrowserInstance | null = null;

  try {
    logger.info(`Starting browser-based extraction for: ${url}`);
    
    // 브라우저 인스턴스 가져오기
    instance = await browserFarm.getAvailableInstance(userInfo);
    
    // YouTube 페이지로 이동
    await instance.page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // CAPTCHA 감지 및 해결
    await handleCaptcha(instance.page, url);

    // 페이지 로딩 완료까지 대기
    await instance.page.waitForSelector('video', { timeout: 15000 });

    // YouTube 데이터 추출
    const mediaData = await extractYouTubeData(instance.page, url);

    return mediaData;

  } catch (error) {
    logger.error(`Browser-based extraction failed: ${error}`);
    throw error;
  } finally {
    if (instance) {
      browserFarm.releaseInstance(instance);
    }
  }
}

// CAPTCHA 처리
async function handleCaptcha(page: Page, url: string): Promise<void> {
  try {
    // CAPTCHA 감지
    const captchaElement = await page.$('iframe[src*="recaptcha"]');
    
    if (captchaElement) {
      logger.info('CAPTCHA detected, attempting to solve...');
      
      // reCAPTCHA sitekey 추출
      const sitekey = await page.evaluate(() => {
        // @ts-ignore - Puppeteer context
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          // @ts-ignore - Puppeteer context
          const match = script.textContent?.match(/sitekey['"]\s*:\s*['"]([^'"]+)['"]/);
          if (match) return match[1];
        }
        return null;
      });

      if (sitekey) {
        const captchaSolution = await solveYouTubeCaptcha(url, sitekey);
        
        if (captchaSolution) {
          // CAPTCHA 솔루션 주입
          await page.evaluate((solution) => {
            // @ts-ignore - Puppeteer context
            const textarea = document.querySelector('#g-recaptcha-response');
            if (textarea) {
              // @ts-ignore - Puppeteer context
              textarea.style.display = 'block';
              // @ts-ignore - Puppeteer context
              textarea.value = solution;
              
              // CAPTCHA 콜백 실행
              // @ts-ignore - Puppeteer context
              if (window.grecaptcha) {
                // @ts-ignore - Puppeteer context
                window.grecaptcha.getResponse = () => solution;
              }
            }
          }, captchaSolution);

          // 제출 버튼 클릭
          await page.click('button[type="submit"], input[type="submit"]');
          await page.waitForNavigation({ waitUntil: 'networkidle2' });
          
          logger.info('CAPTCHA solved successfully');
        }
      }
    }
  } catch (error) {
    logger.warn(`CAPTCHA handling failed: ${error}`);
    // CAPTCHA 실패해도 계속 진행
  }
}

// YouTube 데이터 추출
async function extractYouTubeData(page: Page, url: string): Promise<MediaInfo> {
  try {
    // 페이지에서 ytInitialPlayerResponse 추출
    const playerData = await page.evaluate(() => {
      // @ts-ignore - Puppeteer context
      const scripts = Array.from(document.querySelectorAll('script'));
      
      for (const script of scripts) {
        // @ts-ignore - Puppeteer context
        const content = script.textContent || '';
        const match = content.match(/var ytInitialPlayerResponse = ({.+?});/);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {
            continue;
          }
        }
      }
      
      return null;
    });

    if (!playerData) {
      throw new Error('Could not extract player data');
    }

    // 메타데이터 추출
    const videoDetails = playerData.videoDetails || {};
    const streamingData = playerData.streamingData || {};

    // 포맷 데이터 처리
    const formats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptiveFormats || [])
    ];

    const videoFormats = formats
      .filter((format: any) => format.mimeType?.includes('video'))
      .map((format: any) => ({
        format_id: format.itag?.toString() || '',
        ext: getExtensionFromMimeType(format.mimeType) || 'mp4',
        width: format.width || 0,
        height: format.height || 0,
        fps: format.fps || 0,
        vcodec: extractCodec(format.mimeType, 'video') || '',
        acodec: extractCodec(format.mimeType, 'audio') || '',
        filesize: parseInt(format.contentLength) || 0,
        quality: format.height || 0
      }));

    const audioFormats = formats
      .filter((format: any) => format.mimeType?.includes('audio'))
      .map((format: any) => ({
        format_id: format.itag?.toString() || '',
        ext: getExtensionFromMimeType(format.mimeType) || 'm4a',
        acodec: extractCodec(format.mimeType, 'audio') || '',
        abr: format.averageBitrate || format.bitrate || 0,
        asr: format.audioSampleRate || 0,
        filesize: parseInt(format.contentLength) || 0,
        quality: format.averageBitrate || format.bitrate || 0
      }));

    return {
      id: videoDetails.videoId || '',
      title: videoDetails.title || 'Unknown',
      duration: parseInt(videoDetails.lengthSeconds) || 0,
      thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || '',
      description: videoDetails.shortDescription || '',
      uploader: videoDetails.author || 'Unknown',
      upload_date: '', // 별도 추출 필요
      view_count: parseInt(videoDetails.viewCount) || 0,
      webpage_url: url,
      extractor: 'browser_farm',
      video_formats: videoFormats,
      audio_formats: audioFormats,
      available_qualities: [...new Set(videoFormats.map(f => f.height).filter(h => h > 0))].sort((a, b) => b - a),
      available_audio_bitrates: [...new Set(audioFormats.map(f => f.abr).filter(b => b > 0))].sort((a, b) => b - a)
    };

  } catch (error) {
    logger.error(`Failed to extract YouTube data: ${error}`);
    throw error;
  }
}

// 유틸리티 함수들
function getExtensionFromMimeType(mimeType: string): string {
  if (!mimeType) return 'mp4';
  
  const mimeMap: { [key: string]: string } = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3'
  };
  
  for (const [mime, ext] of Object.entries(mimeMap)) {
    if (mimeType.includes(mime)) {
      return ext;
    }
  }
  
  return 'mp4';
}

function extractCodec(mimeType: string, type: 'video' | 'audio'): string {
  if (!mimeType) return '';
  
  const codecMatch = mimeType.match(/codecs="([^"]+)"/);
  if (!codecMatch) return '';
  
  const codecs = codecMatch[1].split(',').map(c => c.trim());
  
  if (type === 'video') {
    return codecs.find(c => c.includes('avc') || c.includes('vp') || c.includes('av01')) || '';
  } else {
    return codecs.find(c => c.includes('mp4a') || c.includes('opus') || c.includes('vorbis')) || '';
  }
}

// 팜 종료 시 정리
process.on('SIGTERM', async () => {
  await browserFarm.shutdown();
});

process.on('SIGINT', async () => {
  await browserFarm.shutdown();
});

export { browserFarm };
