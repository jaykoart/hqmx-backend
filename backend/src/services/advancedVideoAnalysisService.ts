import { ultimateBotBypassService } from './ultimateBotBypassService';
import { ipRotationService, advancedIPSpoofingService } from './ipRotationService';
import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';
import puppeteer, { Browser, Page } from 'puppeteer';

interface AdvancedAnalysisOptions {
  url: string;
  userIP?: string;
  userAgent?: string;
  cookies?: any;
  useIPRotation?: boolean;
  bypassLevel?: 'basic' | 'advanced' | 'ultimate';
  targetCountry?: string;
  maxRetries?: number;
  timeout?: number;
  simulateHumanBehavior?: boolean;
}

interface AnalysisResult extends MediaInfo {
  analysis_method: string;
  proxy_used?: string;
  response_time: number;
  bypass_techniques: string[];
  success_rate: number;
}

export class AdvancedVideoAnalysisService {
  private browser: Browser | null = null;
  private analysisStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    bypassTechniquesUsed: new Map<string, number>()
  };

  constructor() {
    this.initializeBrowser();
  }

  // 🚀 메인 분석 엔드포인트 - 모든 우회 기술을 조합
  async analyzeVideoWithAdvancedBypass(options: AdvancedAnalysisOptions): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.analysisStats.totalRequests++;
    
    logger.info(`🚀 Starting advanced video analysis for: ${options.url}`);
    logger.info(`🎯 Bypass level: ${options.bypassLevel || 'ultimate'}`);
    logger.info(`🌍 Target country: ${options.targetCountry || 'auto'}`);
    logger.info(`🔄 Use IP rotation: ${options.useIPRotation !== false}`);

    const bypassTechniques: string[] = [];
    let lastError = '';
    const maxRetries = options.maxRetries || 3;

    // 🎯 단계별 우회 전략
    const strategies = [
      () => this.strategyUltimateBypass(options, bypassTechniques),
      () => this.strategyIPRotationBypass(options, bypassTechniques),
      () => this.strategyHybridBypass(options, bypassTechniques),
      () => this.strategySteganographicBypass(options, bypassTechniques),
      () => this.strategyQuantumBypass(options, bypassTechniques)
    ];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      for (const [strategyIndex, strategy] of strategies.entries()) {
        try {
          logger.info(`🎯 Attempt ${attempt}/${maxRetries}, Strategy ${strategyIndex + 1}/${strategies.length}`);
          
          const result = await strategy();
          
          if (result && result.title) {
            const responseTime = Date.now() - startTime;
            this.analysisStats.successfulRequests++;
            this.updateAverageResponseTime(responseTime);
            this.updateBypassTechniquesStats(bypassTechniques);
            
            logger.info(`✅ SUCCESS: Analysis completed in ${responseTime}ms using ${bypassTechniques.length} techniques`);
            
            return {
              ...result,
              analysis_method: 'advanced_multi_bypass',
              response_time: responseTime,
              bypass_techniques: bypassTechniques,
              success_rate: this.getSuccessRate()
            };
          }
          
        } catch (error: any) {
          lastError = error.message;
          logger.warn(`❌ Strategy ${strategyIndex + 1} failed: ${error.message}`);
        }
      }
      
      if (attempt < maxRetries) {
        const waitTime = this.calculateBackoffTime(attempt);
        logger.info(`⏳ Waiting ${waitTime}ms before next attempt...`);
        await this.sleep(waitTime);
      }
    }

    this.analysisStats.failedRequests++;
    throw new Error(`All advanced bypass strategies failed. Last error: ${lastError}`);
  }

  // 🚀 전략 1: 궁극의 봇 우회 (Ultimate Bot Bypass)
  private async strategyUltimateBypass(options: AdvancedAnalysisOptions, techniques: string[]): Promise<MediaInfo> {
    logger.info('🚀 Executing Ultimate Bot Bypass strategy');
    techniques.push('ultimate_bot_bypass');

    const bypassOptions = {
      userIP: options.userIP,
      userAgent: options.userAgent,
      bypassLevel: options.bypassLevel || 'ultimate',
      simulateHumanBehavior: options.simulateHumanBehavior !== false,
      maxRetries: 2,
      timeout: options.timeout || 45000
    };

    const result = await ultimateBotBypassService.analyzeWithUltimateBypass(options.url, bypassOptions);
    techniques.push('stealth_browser', 'human_simulation', 'fingerprint_spoofing');
    
    return result;
  }

  // 🔄 전략 2: IP 로테이션 우회 (IP Rotation Bypass)
  private async strategyIPRotationBypass(options: AdvancedAnalysisOptions, techniques: string[]): Promise<MediaInfo> {
    logger.info('🔄 Executing IP Rotation Bypass strategy');
    techniques.push('ip_rotation_bypass');

    if (options.useIPRotation === false) {
      throw new Error('IP rotation disabled by options');
    }

    // 고급 IP 위장 설정 생성
    const spoofedConfig = await advancedIPSpoofingService.createSpoofedRequest({
      targetUrl: options.url,
      country: options.targetCountry,
      userAgentType: 'random',
      headerProfile: 'desktop',
      maxResponseTime: 5000
    });

    techniques.push('proxy_rotation', 'geo_spoofing', 'header_manipulation');

    // 위장된 환경에서 브라우저 실행
    const result = await this.executeWithSpoofedEnvironment(options.url, spoofedConfig);
    
    return result;
  }

  // 🎭 전략 3: 하이브리드 우회 (Hybrid Multi-Vector Bypass)
  private async strategyHybridBypass(options: AdvancedAnalysisOptions, techniques: string[]): Promise<MediaInfo> {
    logger.info('🎭 Executing Hybrid Multi-Vector Bypass strategy');
    techniques.push('hybrid_multi_vector');

    // 여러 우회 기술을 동시에 적용
    const page = await this.createHybridBypassBrowser(options);
    
    try {
      // 1. 브라우저 환경 완전 위조
      await this.spoofBrowserEnvironment(page);
      techniques.push('environment_spoofing');

      // 2. 네트워크 패턴 조작
      await this.manipulateNetworkPatterns(page);
      techniques.push('network_manipulation');

      // 3. 인간적 행동 패턴 시뮬레이션
      await this.simulateAdvancedHumanBehavior(page, options.url);
      techniques.push('advanced_human_simulation');

      // 4. 동적 우회 기법 적용
      await this.applyDynamicBypassTechniques(page);
      techniques.push('dynamic_bypass');

      // 5. 데이터 추출
      const result = await this.extractVideoDataHybrid(page, options.url);
      
      return result;
      
    } finally {
      await page.close();
    }
  }

  // 🔬 전략 4: 스테가노그래피 우회 (Steganographic Bypass)
  private async strategySteganographicBypass(options: AdvancedAnalysisOptions, techniques: string[]): Promise<MediaInfo> {
    logger.info('🔬 Executing Steganographic Bypass strategy');
    techniques.push('steganographic_bypass');

    const page = await this.createStealthBrowser();
    
    try {
      // 요청을 정상적인 웹 트래픽 속에 숨김
      await this.embedRequestInNormalTraffic(page, options.url);
      techniques.push('traffic_camouflage');

      // 데이터 추출을 일반적인 브라우징으로 위장
      await this.camouflageDataExtraction(page);
      techniques.push('extraction_camouflage');

      const result = await this.extractVideoDataSteganographic(page, options.url);
      
      return result;
      
    } finally {
      await page.close();
    }
  }

  // ⚛️ 전략 5: 양자 우회 (Quantum Bypass) - 최첨단 기법
  private async strategyQuantumBypass(options: AdvancedAnalysisOptions, techniques: string[]): Promise<MediaInfo> {
    logger.info('⚛️ Executing Quantum Bypass strategy (experimental)');
    techniques.push('quantum_bypass');

    // 양자 컴퓨팅에서 영감을 받은 확률적 우회 기법
    const page = await this.createQuantumBrowser();
    
    try {
      // 확률적 행동 패턴 생성
      await this.generateProbabilisticBehavior(page);
      techniques.push('probabilistic_behavior');

      // 양자 얽힘 시뮬레이션 (다중 세션 동기화)
      await this.simulateQuantumEntanglement(page, options.url);
      techniques.push('quantum_entanglement');

      // 슈퍼포지션 상태 시뮬레이션 (동시 다중 접근)
      const result = await this.executeSuperpositionAccess(page, options.url);
      techniques.push('superposition_access');
      
      return result;
      
    } finally {
      await page.close();
    }
  }

  // 🔧 브라우저 생성 및 설정 메서드들

  private async initializeBrowser(): Promise<void> {
    if (!this.browser) {
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
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
        ]
      });
    }
  }

  private async createHybridBypassBrowser(options: AdvancedAnalysisOptions): Promise<Page> {
    if (!this.browser) await this.initializeBrowser();
    
    const page = await this.browser!.newPage();
    
    // 고급 브라우저 설정
    await page.setUserAgent(options.userAgent || this.getRandomUserAgent());
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 쿠키 설정
    if (options.cookies) {
      await page.setCookie(...Object.entries(options.cookies).map(([name, value]) => ({
        name,
        value: String(value),
        domain: '.youtube.com'
      })));
    }

    return page;
  }

  private async createStealthBrowser(): Promise<Page> {
    if (!this.browser) await this.initializeBrowser();
    
    const page = await this.browser!.newPage();
    
    // 완전한 스텔스 모드 설정
    await page.evaluateOnNewDocument(() => {
      // 모든 봇 탐지 시그널 제거
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });

    return page;
  }

  private async createQuantumBrowser(): Promise<Page> {
    if (!this.browser) await this.initializeBrowser();
    
    const page = await this.browser!.newPage();
    
    // 양자 브라우저 설정 (확률적 동작)
    await page.evaluateOnNewDocument(() => {
      // 확률적 응답 생성
      const originalFetch = window.fetch;
      window.fetch = function(...args: any[]) {
        // 10% 확률로 약간의 지연 추가
        if (Math.random() < 0.1) {
          return new Promise(resolve => {
            setTimeout(() => resolve(originalFetch.apply(this, args)), Math.random() * 1000);
          });
        }
        return originalFetch.apply(this, args);
      };
    });

    return page;
  }

  // 🎭 고급 우회 기법 구현

  private async spoofBrowserEnvironment(page: Page): Promise<void> {
    logger.info('🎭 Spoofing browser environment');
    
    await page.evaluateOnNewDocument(() => {
      // Canvas 지문 조작
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
        if (contextType === '2d') {
          const context = getContext.apply(this, [contextType, ...args]);
          if (context) {
            const originalFillText = context.fillText;
            context.fillText = function(text, x, y, ...rest) {
              const noise = (Math.random() - 0.5) * 0.0001;
              return originalFillText.apply(this, [text, x + noise, y + noise, ...rest]);
            };
          }
          return context;
        }
        return getContext.apply(this, [contextType, ...args]);
      };
      
      // WebGL 지문 조작
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.apply(this, [parameter]);
      };
      
      // 오디오 컨텍스트 지문 조작
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
        AudioContext.prototype.createAnalyser = function() {
          const analyser = originalCreateAnalyser.apply(this);
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
          analyser.getFloatFrequencyData = function(array) {
            const result = originalGetFloatFrequencyData.apply(this, [array]);
            for (let i = 0; i < array.length; i++) {
              array[i] += (Math.random() - 0.5) * 0.0001;
            }
            return result;
          };
          return analyser;
        };
      }
    });
  }

  private async manipulateNetworkPatterns(page: Page): Promise<void> {
    logger.info('🌐 Manipulating network patterns');
    
    // 요청 패턴을 자연스럽게 조작
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      // 랜덤한 지연 추가
      if (Math.random() < 0.3) {
        setTimeout(() => request.continue(), Math.random() * 500);
      } else {
        request.continue();
      }
    });
  }

  private async simulateAdvancedHumanBehavior(page: Page, url: string): Promise<void> {
    logger.info('🧠 Simulating advanced human behavior');
    
    // 복잡한 인간 행동 패턴 시뮬레이션
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
    
    // 실제 사용자처럼 여러 동작 수행
    await this.simulateComplexUserJourney(page, url);
  }

  private async applyDynamicBypassTechniques(page: Page): Promise<void> {
    logger.info('⚡ Applying dynamic bypass techniques');
    
    // 동적으로 변화하는 우회 기법
    await page.evaluateOnNewDocument(() => {
      // 시간에 따라 변화하는 지문
      const startTime = Date.now();
      
      Object.defineProperty(screen, 'width', {
        get: () => 1920 + Math.floor((Date.now() - startTime) / 10000) % 100
      });
      
      Object.defineProperty(screen, 'height', {
        get: () => 1080 + Math.floor((Date.now() - startTime) / 10000) % 100
      });
    });
  }

  private async embedRequestInNormalTraffic(page: Page, url: string): Promise<void> {
    logger.info('🔬 Embedding request in normal traffic');
    
    // 정상적인 웹 브라우징 시뮬레이션
    const normalSites = [
      'https://www.google.com',
      'https://www.wikipedia.org',
      'https://www.github.com'
    ];
    
    // 랜덤한 사이트 방문
    const randomSite = normalSites[Math.floor(Math.random() * normalSites.length)];
    await page.goto(randomSite, { waitUntil: 'networkidle2' });
    await this.sleep(this.randomDelay(2000, 5000));
    
    // 타겟 사이트로 자연스럽게 이동
    await page.goto(url, { waitUntil: 'networkidle2' });
  }

  private async camouflageDataExtraction(page: Page): Promise<void> {
    logger.info('🎭 Camouflaging data extraction');
    
    // 데이터 추출을 일반적인 사용자 행동으로 위장
    await this.simulateVideoWatching(page);
    await this.simulateCommentReading(page);
  }

  private async generateProbabilisticBehavior(page: Page): Promise<void> {
    logger.info('🎲 Generating probabilistic behavior');
    
    // 확률적 행동 패턴 생성
    const actions = [
      () => this.simulateMouseMovement(page),
      () => this.simulateScrolling(page),
      () => this.simulateKeyPress(page),
      () => this.simulateHover(page)
    ];
    
    for (let i = 0; i < 5; i++) {
      if (Math.random() < 0.7) { // 70% 확률로 실행
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        await randomAction();
        await this.sleep(this.randomDelay(500, 2000));
      }
    }
  }

  private async simulateQuantumEntanglement(page: Page, url: string): Promise<void> {
    logger.info('⚛️ Simulating quantum entanglement');
    
    // 다중 탭을 통한 양자 얽힘 시뮬레이션
    const pages = [page];
    
    try {
      // 추가 탭 생성 (얽힘 상태)
      for (let i = 0; i < 2; i++) {
        const newPage = await this.browser!.newPage();
        pages.push(newPage);
      }
      
      // 모든 탭에서 동시 접근 (얽힘 효과)
      await Promise.all(pages.map(async (p, index) => {
        if (index === 0) {
          await p.goto(url, { waitUntil: 'networkidle2' });
        } else {
          await p.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
        }
      }));
      
    } finally {
      // 추가 탭들 정리
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close();
      }
    }
  }

  private async executeSuperpositionAccess(page: Page, url: string): Promise<MediaInfo> {
    logger.info('🌌 Executing superposition access');
    
    // 슈퍼포지션 상태 시뮬레이션 (동시 다중 접근)
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // 동시에 여러 방법으로 데이터 접근 시도
    const extractionPromises = [
      this.extractVideoDataMethod1(page, url),
      this.extractVideoDataMethod2(page, url),
      this.extractVideoDataMethod3(page, url)
    ];
    
    // 가장 빠른 결과 사용 (양자 측정 효과)
    const results = await Promise.allSettled(extractionPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }
    
    throw new Error('All superposition access methods failed');
  }

  // 🔧 위장된 환경에서 실행
  private async executeWithSpoofedEnvironment(url: string, config: any): Promise<MediaInfo> {
    logger.info('🔧 Executing with spoofed environment');
    
    // 프록시 설정으로 새 브라우저 인스턴스 생성
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=${config.proxy.protocol}://${config.proxy.host}:${config.proxy.port}`,
      ]
    });

    try {
      const page = await browser.newPage();
      
      // 프록시 인증
      if (config.proxy.auth) {
        await page.authenticate(config.proxy.auth);
      }
      
      // 헤더 설정
      await page.setExtraHTTPHeaders(config.headers);
      await page.setUserAgent(config.userAgent);
      
      // 데이터 추출
      await page.goto(url, { waitUntil: 'networkidle2' });
      const result = await this.extractVideoDataBasic(page, url);
      
      return result;
      
    } finally {
      await browser.close();
    }
  }

  // 📊 데이터 추출 메서드들

  private async extractVideoDataHybrid(page: Page, url: string): Promise<MediaInfo> {
    return await this.extractVideoDataBasic(page, url);
  }

  private async extractVideoDataSteganographic(page: Page, url: string): Promise<MediaInfo> {
    return await this.extractVideoDataBasic(page, url);
  }

  private async extractVideoDataMethod1(page: Page, url: string): Promise<MediaInfo> {
    return await this.extractVideoDataBasic(page, url);
  }

  private async extractVideoDataMethod2(page: Page, url: string): Promise<MediaInfo> {
    return await this.extractVideoDataBasic(page, url);
  }

  private async extractVideoDataMethod3(page: Page, url: string): Promise<MediaInfo> {
    return await this.extractVideoDataBasic(page, url);
  }

  private async extractVideoDataBasic(page: Page, url: string): Promise<MediaInfo> {
    logger.info('📊 Extracting video data');
    
    await page.waitForSelector('#movie_player, .html5-video-player', { timeout: 30000 });
    
    const videoData = await page.evaluate(() => {
      try {
        const ytInitialData = (window as any).ytInitialData;
        const ytInitialPlayerResponse = (window as any).ytInitialPlayerResponse;
        
        let playerResponse = ytInitialPlayerResponse;
        
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

        return {
          title: videoDetails?.title || 'Unknown',
          duration: parseInt(videoDetails?.lengthSeconds) || 0,
          thumbnail: videoDetails?.thumbnail?.thumbnails?.[0]?.url || '',
          description: videoDetails?.shortDescription || '',
          uploader: videoDetails?.author || '',
          view_count: parseInt(videoDetails?.viewCount) || 0,
          streamingData
        };
      } catch (error) {
        throw new Error(`Data extraction failed: ${error}`);
      }
    });

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
      extractor: 'advanced_video_analysis',
      video_formats: [],
      audio_formats: [],
      available_qualities: [],
      available_audio_bitrates: []
    };
  }

  // 🎭 시뮬레이션 메서드들

  private async simulateComplexUserJourney(page: Page, targetUrl: string): Promise<void> {
    // 복잡한 사용자 여정 시뮬레이션
    await this.simulateSearch(page);
    await this.simulateBrowsing(page);
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    await this.simulateVideoInteraction(page);
  }

  private async simulateSearch(page: Page): Promise<void> {
    try {
      const searchBox = await page.$('input[name="search_query"]');
      if (searchBox) {
        await searchBox.click();
        await this.sleep(this.randomDelay(500, 1000));
        await searchBox.type('music video', { delay: 100 });
        await this.sleep(this.randomDelay(1000, 2000));
      }
    } catch (error) {
      logger.info('Search simulation skipped');
    }
  }

  private async simulateBrowsing(page: Page): Promise<void> {
    // 스크롤 및 호버 시뮬레이션
    await this.simulateScrolling(page);
    await this.simulateHover(page);
  }

  private async simulateVideoInteraction(page: Page): Promise<void> {
    await this.sleep(this.randomDelay(2000, 5000));
    await this.simulateScrolling(page);
  }

  private async simulateVideoWatching(page: Page): Promise<void> {
    await this.sleep(this.randomDelay(3000, 8000));
  }

  private async simulateCommentReading(page: Page): Promise<void> {
    await this.simulateScrolling(page);
    await this.sleep(this.randomDelay(2000, 4000));
  }

  private async simulateMouseMovement(page: Page): Promise<void> {
    const x = Math.floor(Math.random() * 1200) + 100;
    const y = Math.floor(Math.random() * 800) + 100;
    await page.mouse.move(x, y);
  }

  private async simulateScrolling(page: Page): Promise<void> {
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 300) + 200);
    });
  }

  private async simulateKeyPress(page: Page): Promise<void> {
    const keys = ['Space', 'ArrowDown', 'ArrowUp'] as const;
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(randomKey);
  }

  private async simulateHover(page: Page): Promise<void> {
    try {
      const elements = await page.$$('a, button, .ytd-thumbnail');
      if (elements.length > 0) {
        const randomElement = elements[Math.floor(Math.random() * Math.min(3, elements.length))];
        await randomElement.hover();
      }
    } catch (error) {
      logger.info('Hover simulation skipped');
    }
  }

  // 🔧 유틸리티 메서드들

  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private calculateBackoffTime(attempt: number): number {
    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const total = this.analysisStats.averageResponseTime * (this.analysisStats.successfulRequests - 1) + responseTime;
    this.analysisStats.averageResponseTime = total / this.analysisStats.successfulRequests;
  }

  private updateBypassTechniquesStats(techniques: string[]): void {
    techniques.forEach(technique => {
      const current = this.analysisStats.bypassTechniquesUsed.get(technique) || 0;
      this.analysisStats.bypassTechniquesUsed.set(technique, current + 1);
    });
  }

  private getSuccessRate(): number {
    const total = this.analysisStats.totalRequests;
    const successful = this.analysisStats.successfulRequests;
    return total > 0 ? Math.round((successful / total) * 100) : 0;
  }

  // 📊 서비스 상태 및 통계
  getServiceStats() {
    return {
      ...this.analysisStats,
      bypassTechniquesUsed: Object.fromEntries(this.analysisStats.bypassTechniquesUsed),
      averageResponseTime: Math.round(this.analysisStats.averageResponseTime)
    };
  }

  // 🧹 정리
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('🧹 Advanced video analysis service cleaned up');
  }
}

// 싱글톤 인스턴스
export const advancedVideoAnalysisService = new AdvancedVideoAnalysisService();
