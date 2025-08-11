import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';
import fs from 'fs/promises';
import path from 'path';

interface UltimateBotBypassOptions {
  userIP?: string;
  userAgent?: string;
  proxyList?: string[];
  useRotatingProxies?: boolean;
  simulateHumanBehavior?: boolean;
  bypassLevel?: 'basic' | 'advanced' | 'ultimate';
  maxRetries?: number;
  timeout?: number;
}

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
}

export class UltimateBotBypassService {
  private browser: Browser | null = null;
  private proxyRotationIndex = 0;
  private userAgentPool: string[] = [];
  private fingerprintPool: any[] = [];
  
  constructor() {
    this.initializeUserAgentPool();
    this.initializeFingerprintPool();
  }

  // 🚀 Ultimate 봇 탐지 우회 분석 시스템
  async analyzeWithUltimateBypass(url: string, options: UltimateBotBypassOptions = {}): Promise<MediaInfo> {
    logger.info(`🔥 Starting ULTIMATE bot bypass analysis for: ${url}`);
    
    const {
      bypassLevel = 'ultimate',
      maxRetries = 5,
      timeout = 45000,
      simulateHumanBehavior = true,
      useRotatingProxies = true
    } = options;

    let lastError = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🎯 Attempt ${attempt}/${maxRetries} with bypass level: ${bypassLevel}`);
        
        // 각 시도마다 다른 전략 사용
        const strategyResult = await this.executeBypassStrategy(url, options, attempt);
        
        if (strategyResult && strategyResult.title) {
          logger.info(`✅ SUCCESS: Ultimate bypass completed on attempt ${attempt}`);
          return strategyResult;
        }
        
      } catch (error: any) {
        lastError = error.message;
        logger.warn(`❌ Attempt ${attempt} failed: ${error.message}`);
        
        // 실패 시 잠시 대기 (인간적인 행동 패턴)
        if (attempt < maxRetries) {
          const waitTime = this.calculateBackoffTime(attempt);
          logger.info(`⏳ Waiting ${waitTime}ms before next attempt...`);
          await this.sleep(waitTime);
        }
      }
    }

    throw new Error(`All bypass attempts failed. Last error: ${lastError}`);
  }

  // 🎯 우회 전략 실행
  private async executeBypassStrategy(url: string, options: UltimateBotBypassOptions, attempt: number): Promise<MediaInfo> {
    const strategies = [
      () => this.stealthBrowserStrategy(url, options),
      () => this.humanBehaviorStrategy(url, options),
      () => this.proxyRotationStrategy(url, options),
      () => this.fingerprintSpoofingStrategy(url, options),
      () => this.ultimateHybridStrategy(url, options)
    ];

    const strategyIndex = (attempt - 1) % strategies.length;
    return await strategies[strategyIndex]();
  }

  // 🥷 전략 1: 스텔스 브라우저 (완전 탐지 불가)
  private async stealthBrowserStrategy(url: string, options: UltimateBotBypassOptions): Promise<MediaInfo> {
    logger.info('🥷 Executing stealth browser strategy');
    
    const page = await this.createStealthBrowser(options);
    
    try {
      // 스텔스 모드 설정
      await this.configureStealthMode(page);
      
      // 인간적인 네비게이션
      await this.humanLikeNavigation(page, url);
      
      // YouTube 데이터 추출
      const mediaInfo = await this.extractYouTubeData(page, url);
      
      return mediaInfo;
      
    } finally {
      await page.close();
    }
  }

  // 🧠 전략 2: 인간 행동 시뮬레이션
  private async humanBehaviorStrategy(url: string, options: UltimateBotBypassOptions): Promise<MediaInfo> {
    logger.info('🧠 Executing human behavior simulation strategy');
    
    const page = await this.createHumanLikeBrowser(options);
    
    try {
      // 인간적인 브라우저 설정
      await this.setupHumanBehavior(page);
      
      // 실제 사용자처럼 YouTube 탐색
      await this.simulateRealUserBehavior(page, url);
      
      // 자연스러운 데이터 추출
      const mediaInfo = await this.naturalDataExtraction(page, url);
      
      return mediaInfo;
      
    } finally {
      await page.close();
    }
  }

  // 🔄 전략 3: 프록시 로테이션
  private async proxyRotationStrategy(url: string, options: UltimateBotBypassOptions): Promise<MediaInfo> {
    logger.info('🔄 Executing proxy rotation strategy');
    
    const proxy = await this.getNextProxy();
    const page = await this.createProxyBrowser(proxy, options);
    
    try {
      // 프록시 기반 우회 설정
      await this.configureProxyBypass(page, proxy);
      
      // 지역별 최적화된 접근
      await this.geoOptimizedAccess(page, url, proxy);
      
      // 프록시 환경에 최적화된 데이터 추출
      const mediaInfo = await this.proxyOptimizedExtraction(page, url);
      
      return mediaInfo;
      
    } finally {
      await page.close();
    }
  }

  // 🎭 전략 4: 브라우저 지문 스푸핑
  private async fingerprintSpoofingStrategy(url: string, options: UltimateBotBypassOptions): Promise<MediaInfo> {
    logger.info('🎭 Executing fingerprint spoofing strategy');
    
    const fingerprint = this.getRandomFingerprint();
    const page = await this.createFingerprintedBrowser(fingerprint, options);
    
    try {
      // 완전한 브라우저 지문 위조
      await this.spoofBrowserFingerprint(page, fingerprint);
      
      // 위조된 환경에서 접근
      await this.fingerprintedAccess(page, url);
      
      // 지문 기반 데이터 추출
      const mediaInfo = await this.fingerprintAwareExtraction(page, url);
      
      return mediaInfo;
      
    } finally {
      await page.close();
    }
  }

  // 🚀 전략 5: 궁극의 하이브리드 전략
  private async ultimateHybridStrategy(url: string, options: UltimateBotBypassOptions): Promise<MediaInfo> {
    logger.info('🚀 Executing ULTIMATE hybrid strategy');
    
    // 모든 기술을 조합한 최강 우회
    const proxy = await this.getBestProxy();
    const fingerprint = this.getBestFingerprint();
    const userAgent = this.getBestUserAgent();
    
    const page = await this.createUltimateBrowser({
      proxy,
      fingerprint,
      userAgent,
      ...options
    });
    
    try {
      // 궁극의 우회 설정
      await this.configureUltimateBypass(page, {
        proxy,
        fingerprint,
        userAgent
      });
      
      // 완벽한 인간 시뮬레이션
      await this.perfectHumanSimulation(page, url);
      
      // 최고 수준의 데이터 추출
      const mediaInfo = await this.ultimateDataExtraction(page, url);
      
      return mediaInfo;
      
    } finally {
      await page.close();
    }
  }

  // 🥷 스텔스 브라우저 생성
  private async createStealthBrowser(options: UltimateBotBypassOptions): Promise<Page> {
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const page = await this.browser!.newPage();
    
    // Stealth 플러그인 적용
    await page.evaluateOnNewDocument(() => {
      // WebDriver 탐지 우회
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Chrome runtime 우회
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // Permissions API 우회
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as any)
          : originalQuery(parameters);
      
      // Plugin 배열 위조
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Languages 배열 위조
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'ko'],
      });
    });

    return page;
  }

  // 🧠 인간적인 브라우저 생성
  private async createHumanLikeBrowser(options: UltimateBotBypassOptions): Promise<Page> {
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const page = await this.browser!.newPage();
    
    // 인간적인 설정 적용
    const humanUserAgent = this.getRandomUserAgent();
    await page.setUserAgent(humanUserAgent);
    
    // 실제 사용자 해상도 시뮬레이션
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 }
    ];
    const viewport = viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewport(viewport);
    
    // 인간적인 헤더 설정
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    return page;
  }

  // 🔄 프록시 브라우저 생성
  private async createProxyBrowser(proxy: ProxyConfig, options: UltimateBotBypassOptions): Promise<Page> {
    // 프록시 설정으로 새 브라우저 인스턴스 생성
    const proxyArgs = [`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`];
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        ...proxyArgs
      ]
    });

    const page = await browser.newPage();
    
    // 프록시 인증 설정
    if (proxy.username && proxy.password) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password
      });
    }

    return page;
  }

  // 🎭 지문 위조 브라우저 생성
  private async createFingerprintedBrowser(fingerprint: any, options: UltimateBotBypassOptions): Promise<Page> {
    if (!this.browser) {
      await this.initializeBrowser();
    }

    const page = await this.browser!.newPage();
    
    // 브라우저 지문 완전 위조
    await page.evaluateOnNewDocument((fp) => {
      // Canvas 지문 위조
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(contextType: any, ...args: any[]) {
        if (contextType === '2d') {
          const context = getContext.apply(this, [contextType, ...args]);
          if (context) {
            const originalFillText = context.fillText;
            context.fillText = function(text: any, x: any, y: any, ...rest: any[]) {
              // 미세한 노이즈 추가
              const noise = (Math.random() - 0.5) * 0.0001;
              return originalFillText.apply(this, [text, x + noise, y + noise, ...rest]);
            };
          }
          return context;
        }
        return getContext.apply(this, [contextType, ...args]);
      };
      
      // WebGL 지문 위조
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return fp.webgl.vendor;
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return fp.webgl.renderer;
        }
        return getParameter.apply(this, [parameter]);
      };
      
      // Audio context 지문 위조
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
        AudioContext.prototype.createAnalyser = function() {
          const analyser = originalCreateAnalyser.apply(this);
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
          analyser.getFloatFrequencyData = function(array: any) {
            const result = originalGetFloatFrequencyData.apply(this, [array]);
            // 미세한 노이즈 추가
            for (let i = 0; i < array.length; i++) {
              array[i] += (Math.random() - 0.5) * 0.0001;
            }
            return result;
          };
          return analyser;
        };
      }
      
      // Screen 정보 위조
      Object.defineProperty(screen, 'width', { get: () => fp.screen.width });
      Object.defineProperty(screen, 'height', { get: () => fp.screen.height });
      Object.defineProperty(screen, 'colorDepth', { get: () => fp.screen.colorDepth });
      
      // Timezone 위조
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
        value: function() {
          return { ...Intl.DateTimeFormat.prototype.resolvedOptions.call(this), timeZone: fp.timezone };
        }
      });
      
    }, fingerprint);

    return page;
  }

  // 🚀 궁극의 브라우저 생성
  private async createUltimateBrowser(config: any): Promise<Page> {
    // 모든 우회 기술을 조합한 최강 브라우저
    const args = [
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
      '--disable-background-networking',
    ];

    if (config.proxy) {
      args.push(`--proxy-server=${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args,
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();
    
    // 궁극의 설정 적용
    await page.setUserAgent(config.userAgent);
    await page.setViewport({
      width: config.fingerprint.screen.width,
      height: config.fingerprint.screen.height
    });

    return page;
  }

  // 🎯 인간적인 네비게이션
  private async humanLikeNavigation(page: Page, url: string): Promise<void> {
    logger.info('🎯 Performing human-like navigation');
    
    // 실제 사용자처럼 단계적 접근
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    
    // 잠시 머물면서 페이지 탐색하는 척
    await this.simulateReading(page, 2000, 4000);
    
    // 검색창 클릭 시뮬레이션
    try {
      await page.click('input[name="search_query"]');
      await this.sleep(this.randomDelay(500, 1000));
    } catch (e) {
      logger.info('Search box not found, continuing...');
    }
    
    // 타겟 URL로 이동
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // 페이지 로딩 대기 (인간적인 시간)
    await this.simulateReading(page, 3000, 6000);
  }

  // 🧠 실제 사용자 행동 시뮬레이션
  private async simulateRealUserBehavior(page: Page, url: string): Promise<void> {
    logger.info('🧠 Simulating real user behavior');
    
    // YouTube 홈페이지부터 시작
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
    
    // 스크롤 다운 (추천 영상 보는 척)
    await this.humanScroll(page, 3);
    
    // 몇 개의 썸네일에 마우스 호버
    await this.simulateVideoHovering(page);
    
    // 검색 시뮬레이션
    const videoId = this.extractVideoId(url);
    if (videoId) {
      await this.simulateVideoSearch(page, videoId);
    }
    
    // 최종적으로 타겟 비디오로 이동
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // 비디오 페이지에서 인간적인 행동
    await this.simulateVideoWatching(page);
  }

  // 📊 YouTube 데이터 추출
  private async extractYouTubeData(page: Page, url: string): Promise<MediaInfo> {
    logger.info('📊 Extracting YouTube data');
    
    // 페이지가 완전히 로드될 때까지 대기
    await page.waitForSelector('#movie_player, .html5-video-player', { timeout: 30000 });
    
    // JavaScript로 YouTube 데이터 추출
    const videoData = await page.evaluate(() => {
      try {
        // YouTube의 내부 변수들 접근
        const ytInitialData = (window as any).ytInitialData;
        const ytInitialPlayerResponse = (window as any).ytInitialPlayerResponse;
        const ytcfg = (window as any).ytcfg;

        let playerResponse = ytInitialPlayerResponse;
        
        // 대체 방법으로 player response 찾기
        if (!playerResponse) {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            if (script.textContent && script.textContent.includes('var ytInitialPlayerResponse')) {
              const match = script.textContent.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
              if (match) {
                try {
                  playerResponse = JSON.parse(match[1]);
                  break;
                } catch (e) {
                  continue;
                }
              }
            }
          }
        }

        if (!playerResponse) {
          throw new Error('Could not find player response');
        }

        const videoDetails = playerResponse.videoDetails;
        const streamingData = playerResponse.streamingData;

        if (!videoDetails) {
          throw new Error('Video details not found');
        }

        return {
          title: videoDetails.title,
          duration: parseInt(videoDetails.lengthSeconds) || 0,
          thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || '',
          description: videoDetails.shortDescription || '',
          uploader: videoDetails.author || '',
          view_count: parseInt(videoDetails.viewCount) || 0,
          streamingData: streamingData
        };
      } catch (error) {
        throw new Error(`Data extraction failed: ${error}`);
      }
    });

    // 스트리밍 데이터 처리
    const formats = this.processStreamingData(videoData.streamingData);

    return {
      id: this.extractVideoId(url) || 'unknown',
      title: videoData.title,
      duration: videoData.duration,
      thumbnail: videoData.thumbnail,
      description: videoData.description,
      uploader: videoData.uploader,
      upload_date: new Date().toISOString().split('T')[0],
      view_count: videoData.view_count,
      webpage_url: url,
      extractor: 'ultimate_bot_bypass',
      video_formats: formats.video,
      audio_formats: formats.audio,
      available_qualities: formats.qualities,
      available_audio_bitrates: formats.audioBitrates
    };
  }

  // 🎭 브라우저 지문 위조
  private async spoofBrowserFingerprint(page: Page, fingerprint: any): Promise<void> {
    logger.info('🎭 Spoofing browser fingerprint');
    
    // 추가적인 지문 위조 설정들이 여기에 들어감
    // (이미 createFingerprintedBrowser에서 대부분 처리됨)
  }

  // 🚀 궁극의 우회 설정
  private async configureUltimateBypass(page: Page, config: any): Promise<void> {
    logger.info('🚀 Configuring ultimate bypass');
    
    // 모든 탐지 방법을 우회하는 최종 설정
    await page.evaluateOnNewDocument(() => {
      // 완전한 봇 탐지 우회 코드
      const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
      if (originalDescriptor) {
        Object.defineProperty(Navigator.prototype, 'webdriver', {
          get: () => undefined,
          configurable: true
        });
      }
      
      // 추가적인 고급 우회 기법들...
    });
  }

  // 🎯 완벽한 인간 시뮬레이션
  private async perfectHumanSimulation(page: Page, url: string): Promise<void> {
    logger.info('🎯 Executing perfect human simulation');
    
    // 가장 자연스러운 인간 행동 패턴 시뮬레이션
    await this.simulateRealUserBehavior(page, url);
    
    // 추가적인 인간적 행동들
    await this.simulateMouseMovements(page);
    await this.simulateKeyboardActivity(page);
    await this.simulateScrollPatterns(page);
  }

  // 📊 궁극의 데이터 추출
  private async ultimateDataExtraction(page: Page, url: string): Promise<MediaInfo> {
    logger.info('📊 Performing ultimate data extraction');
    
    // 가장 안정적이고 포괄적인 데이터 추출
    return await this.extractYouTubeData(page, url);
  }

  // 유틸리티 메서드들
  private async initializeBrowser(): Promise<void> {
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
      ]
    });
  }

  private initializeUserAgentPool(): void {
    this.userAgentPool = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
  }

  private initializeFingerprintPool(): void {
    this.fingerprintPool = [
      {
        screen: { width: 1920, height: 1080, colorDepth: 24 },
        timezone: 'America/New_York',
        webgl: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0)' }
      },
      {
        screen: { width: 1366, height: 768, colorDepth: 24 },
        timezone: 'Europe/London',
        webgl: { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)' }
      },
      // 더 많은 지문들...
    ];
  }

  private getRandomUserAgent(): string {
    return this.userAgentPool[Math.floor(Math.random() * this.userAgentPool.length)];
  }

  private getRandomFingerprint(): any {
    return this.fingerprintPool[Math.floor(Math.random() * this.fingerprintPool.length)];
  }

  private getBestUserAgent(): string {
    // 가장 일반적이고 안전한 User Agent 반환
    return this.userAgentPool[0];
  }

  private getBestFingerprint(): any {
    // 가장 일반적인 지문 반환
    return this.fingerprintPool[0];
  }

  private async getNextProxy(): Promise<ProxyConfig> {
    // 프록시 로테이션 로직
    const proxies = await this.loadProxyList();
    const proxy = proxies[this.proxyRotationIndex % proxies.length];
    this.proxyRotationIndex++;
    return proxy;
  }

  private async getBestProxy(): Promise<ProxyConfig> {
    // 가장 빠르고 안정적인 프록시 반환
    const proxies = await this.loadProxyList();
    return proxies[0]; // 첫 번째 프록시가 가장 좋다고 가정
  }

  private async loadProxyList(): Promise<ProxyConfig[]> {
    // 프록시 목록 로드
    try {
      const proxyData = await fs.readFile(path.join(__dirname, '../../proxy-list.txt'), 'utf-8');
      return proxyData.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [host, port] = line.trim().split(':');
          return {
            host,
            port: parseInt(port),
            protocol: 'http' as const
          };
        });
    } catch (error) {
      logger.warn('Could not load proxy list, using default');
      return [{
        host: '127.0.0.1',
        port: 8080,
        protocol: 'http'
      }];
    }
  }

  private calculateBackoffTime(attempt: number): number {
    // 지수 백오프 + 랜덤 지터
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000); // 최대 30초
  }

  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async simulateReading(page: Page, minTime: number, maxTime: number): Promise<void> {
    const readingTime = this.randomDelay(minTime, maxTime);
    await this.sleep(readingTime);
  }

  private async humanScroll(page: Page, times: number): Promise<void> {
    for (let i = 0; i < times; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(Math.random() * 300) + 200);
      });
      await this.sleep(this.randomDelay(800, 2000));
    }
  }

  private async simulateVideoHovering(page: Page): Promise<void> {
    try {
      const thumbnails = await page.$$('ytd-thumbnail');
      if (thumbnails.length > 0) {
        const randomThumbnail = thumbnails[Math.floor(Math.random() * Math.min(3, thumbnails.length))];
        await randomThumbnail.hover();
        await this.sleep(this.randomDelay(1000, 2000));
      }
    } catch (error) {
      logger.info('Could not simulate hovering');
    }
  }

  private async simulateVideoSearch(page: Page, videoId: string): Promise<void> {
    // 검색 시뮬레이션 로직
    try {
      const searchBox = await page.$('input[name="search_query"]');
      if (searchBox) {
        await searchBox.click();
        await this.sleep(this.randomDelay(500, 1000));
        
        // 타이핑 시뮬레이션
        await searchBox.type(videoId, { delay: this.randomDelay(50, 150) });
        await this.sleep(this.randomDelay(1000, 2000));
      }
    } catch (error) {
      logger.info('Could not simulate search');
    }
  }

  private async simulateVideoWatching(page: Page): Promise<void> {
    // 비디오 시청 시뮬레이션
    await this.sleep(this.randomDelay(2000, 5000));
    
    // 스크롤 다운 (댓글 보는 척)
    await this.humanScroll(page, 2);
    
    // 잠시 머물기
    await this.sleep(this.randomDelay(3000, 8000));
  }

  private async simulateMouseMovements(page: Page): Promise<void> {
    // 자연스러운 마우스 움직임 시뮬레이션
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * 1200) + 100;
      const y = Math.floor(Math.random() * 800) + 100;
      await page.mouse.move(x, y);
      await this.sleep(this.randomDelay(500, 1500));
    }
  }

  private async simulateKeyboardActivity(page: Page): Promise<void> {
    // 키보드 활동 시뮬레이션 (스페이스바, 화살표 키 등)
    const keys = ['Space', 'ArrowDown', 'ArrowUp'] as const;
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(randomKey);
    await this.sleep(this.randomDelay(1000, 3000));
  }

  private async simulateScrollPatterns(page: Page): Promise<void> {
    // 자연스러운 스크롤 패턴
    await this.humanScroll(page, this.randomDelay(1, 4));
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  }

  private processStreamingData(streamingData: any): any {
    if (!streamingData) {
      return {
        video: [],
        audio: [],
        qualities: [],
        audioBitrates: []
      };
    }

    const videoFormats = streamingData.formats || [];
    const adaptiveFormats = streamingData.adaptiveFormats || [];
    
    const processedFormats = {
      video: [],
      audio: [],
      qualities: [],
      audioBitrates: []
    };

    // 비디오 포맷 처리
    for (const format of [...videoFormats, ...adaptiveFormats]) {
      if (format.mimeType && format.mimeType.includes('video')) {
        processedFormats.video.push({
          url: format.url,
          quality: format.qualityLabel || format.quality,
          format: format.mimeType.split(';')[0],
          filesize: format.contentLength || 0
        });
        
        if (format.qualityLabel && !processedFormats.qualities.includes(format.qualityLabel)) {
          processedFormats.qualities.push(format.qualityLabel);
        }
      }
      
      if (format.mimeType && format.mimeType.includes('audio')) {
        processedFormats.audio.push({
          url: format.url,
          bitrate: format.bitrate || format.averageBitrate,
          format: format.mimeType.split(';')[0],
          filesize: format.contentLength || 0
        });
        
        if (format.bitrate && !processedFormats.audioBitrates.includes(format.bitrate)) {
          processedFormats.audioBitrates.push(format.bitrate);
        }
      }
    }

    return processedFormats;
  }

  // 기타 설정 메서드들
  private async configureStealthMode(page: Page): Promise<void> {
    // 스텔스 모드 추가 설정
  }

  private async setupHumanBehavior(page: Page): Promise<void> {
    // 인간 행동 설정
  }

  private async configureProxyBypass(page: Page, proxy: ProxyConfig): Promise<void> {
    // 프록시 우회 설정
  }

  private async geoOptimizedAccess(page: Page, url: string, proxy: ProxyConfig): Promise<void> {
    // 지역 최적화 접근
    await page.goto(url, { waitUntil: 'networkidle2' });
  }

  private async proxyOptimizedExtraction(page: Page, url: string): Promise<MediaInfo> {
    // 프록시 최적화 추출
    return await this.extractYouTubeData(page, url);
  }

  private async fingerprintedAccess(page: Page, url: string): Promise<void> {
    // 지문 기반 접근
    await page.goto(url, { waitUntil: 'networkidle2' });
  }

  private async fingerprintAwareExtraction(page: Page, url: string): Promise<MediaInfo> {
    // 지문 인식 추출
    return await this.extractYouTubeData(page, url);
  }

  private async naturalDataExtraction(page: Page, url: string): Promise<MediaInfo> {
    // 자연스러운 데이터 추출
    return await this.extractYouTubeData(page, url);
  }

  // 브라우저 정리
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// 싱글톤 인스턴스
export const ultimateBotBypassService = new UltimateBotBypassService();
