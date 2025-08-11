import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
  country?: string;
  speed?: number;
  reliability?: number;
  lastUsed?: number;
  failCount?: number;
  isWorking?: boolean;
}

interface ProxyTestResult {
  proxy: ProxyConfig;
  responseTime: number;
  isWorking: boolean;
  error?: string;
}

interface GeoLocation {
  country: string;
  region: string;
  city: string;
  ip: string;
  timezone: string;
}

export class IPRotationService {
  private proxyPool: ProxyConfig[] = [];
  private currentProxyIndex = 0;
  private proxyHealthCheck: Map<string, ProxyTestResult> = new Map();
  private geoCache: Map<string, GeoLocation> = new Map();
  private rotationStrategy: 'round_robin' | 'performance' | 'geo_optimized' = 'performance';

  constructor() {
    this.initializeProxyPool();
    this.startHealthCheckInterval();
  }

  // 🔄 프록시 풀 초기화 (빠른 시작)
  private async initializeProxyPool(): Promise<void> {
    try {
      logger.info('🔄 Initializing proxy pool (fast mode)...');
      
      // 프록시 리스트 파일에서 로드
      await this.loadProxiesFromFile();
      
      // API에서 제한된 수만 로드 (빠른 시작을 위해)
      await this.loadLimitedProxiesFromAPI();
      
      // 백그라운드에서 프록시 테스트 (서버 시작을 차단하지 않음)
      this.testProxiesInBackground();
      
      logger.info(`✅ Proxy pool initialized with ${this.proxyPool.length} proxies (testing in background)`);
      
    } catch (error) {
      logger.error(`Failed to initialize proxy pool: ${error}`);
    }
  }

  // 📁 파일에서 프록시 로드
  private async loadProxiesFromFile(): Promise<void> {
    try {
      const proxyFilePath = path.join(__dirname, '../../proxy-list.txt');
      const proxyData = await fs.readFile(proxyFilePath, 'utf-8');
      
      const proxies = proxyData.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(':');
          if (parts.length >= 2) {
            return {
              host: parts[0],
              port: parseInt(parts[1]),
              username: parts[2] || undefined,
              password: parts[3] || undefined,
              protocol: 'http' as const,
              speed: 0,
              reliability: 100,
              lastUsed: 0,
              failCount: 0,
              isWorking: true
            };
          }
          return null;
        })
        .filter(proxy => proxy !== null) as ProxyConfig[];

      this.proxyPool.push(...proxies);
      logger.info(`📁 Loaded ${proxies.length} proxies from file`);
      
    } catch (error) {
      logger.warn(`Could not load proxies from file: ${error}`);
    }
  }

  // 🌐 API에서 제한된 프록시 로드 (빠른 시작)
  private async loadLimitedProxiesFromAPI(): Promise<void> {
    try {
      logger.info('🌐 Loading limited proxies from APIs (fast mode)...');
      
      // 빠른 시작을 위해 첫 번째 API만 사용
      const apiUrl = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all&format=textplain&limit=100';

      try {
        const response = await axios.get(apiUrl, { timeout: 5000 });
        const proxies = this.parseProxyResponse(response.data);
        this.proxyPool.push(...proxies);
        logger.info(`📡 Loaded ${proxies.length} proxies from API (limited for fast start)`);
        
      } catch (error) {
        logger.warn(`Failed to load from API: ${error}`);
      }
      
    } catch (error) {
      logger.warn(`Could not load proxies from APIs: ${error}`);
    }
  }

  // 🌐 전체 API에서 프록시 로드 (백그라운드)
  private async loadProxiesFromAPI(): Promise<void> {
    try {
      logger.info('🌐 Loading proxies from public APIs...');
      
      // 무료 프록시 API들 (예시)
      const proxyAPIs = [
        'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt'
      ];

      for (const apiUrl of proxyAPIs) {
        try {
          const response = await axios.get(apiUrl, { timeout: 10000 });
          const proxies = this.parseProxyResponse(response.data);
          this.proxyPool.push(...proxies);
          logger.info(`📡 Loaded ${proxies.length} proxies from ${apiUrl}`);
          
          // API 호출 간 딜레이
          await this.sleep(2000);
          
        } catch (error) {
          logger.warn(`Failed to load from API ${apiUrl}: ${error}`);
        }
      }
      
    } catch (error) {
      logger.warn(`Could not load proxies from APIs: ${error}`);
    }
  }

  // 📊 프록시 응답 파싱
  private parseProxyResponse(data: string): ProxyConfig[] {
    return data.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.trim().split(':');
        if (parts.length >= 2) {
          const host = parts[0];
          const port = parseInt(parts[1]);
          
          if (this.isValidIP(host) && port > 0 && port < 65536) {
            return {
              host,
              port,
              protocol: 'http' as const,
              speed: 0,
              reliability: 100,
              lastUsed: 0,
              failCount: 0,
              isWorking: true
            };
          }
        }
        return null;
      })
      .filter(proxy => proxy !== null) as ProxyConfig[];
  }

  // ✅ 백그라운드에서 프록시 테스트 (서버 시작 차단 안함)
  private testProxiesInBackground(): void {
    logger.info('🔄 Starting proxy testing in background...');
    
    // 서버 시작을 차단하지 않도록 백그라운드에서 실행
    setTimeout(async () => {
      await this.testAllProxies();
    }, 5000); // 5초 후 백그라운드에서 시작
  }

  // ✅ 모든 프록시 테스트
  private async testAllProxies(): Promise<void> {
    logger.info('✅ Testing all proxies...');
    
    // 배치 단위로 테스트 (메모리 절약)
    const batchSize = 100;
    let workingCount = 0;
    let totalTested = 0;
    
    for (let i = 0; i < this.proxyPool.length; i += batchSize) {
      const batch = this.proxyPool.slice(i, i + batchSize);
      const testPromises = batch.map(proxy => this.testProxy(proxy));
      const results = await Promise.allSettled(testPromises);
      
      results.forEach((result, index) => {
        const proxyIndex = i + index;
        if (result.status === 'fulfilled' && result.value.isWorking) {
          workingCount++;
          this.proxyPool[proxyIndex].isWorking = true;
          this.proxyPool[proxyIndex].speed = result.value.responseTime;
          this.proxyHealthCheck.set(this.getProxyKey(this.proxyPool[proxyIndex]), result.value);
        } else {
          this.proxyPool[proxyIndex].isWorking = false;
          this.proxyPool[proxyIndex].failCount = (this.proxyPool[proxyIndex].failCount || 0) + 1;
        }
      });
      
      totalTested += batch.length;
      
      // 진행 상황 로그
      if (totalTested % 1000 === 0) {
        logger.info(`🔄 Tested ${totalTested}/${this.proxyPool.length} proxies, ${workingCount} working`);
      }
      
      // 배치 간 짧은 딜레이
      await this.sleep(100);
    }

    // 작동하지 않는 프록시 제거
    this.proxyPool = this.proxyPool.filter(proxy => proxy.isWorking);
    
    logger.info(`✅ Proxy testing completed: ${workingCount}/${totalTested} working`);
  }

  // 🧪 개별 프록시 테스트
  private async testProxy(proxy: ProxyConfig): Promise<ProxyTestResult> {
    const startTime = Date.now();
    
    try {
      const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      const config: any = {
        proxy: {
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      if (proxy.username && proxy.password) {
        config.proxy.auth = {
          username: proxy.username,
          password: proxy.password
        };
      }

      // 간단한 HTTP 요청으로 테스트
      await axios.get('http://httpbin.org/ip', config);
      
      const responseTime = Date.now() - startTime;
      
      return {
        proxy,
        responseTime,
        isWorking: true
      };
      
    } catch (error) {
      return {
        proxy,
        responseTime: Date.now() - startTime,
        isWorking: false,
        error: error.toString()
      };
    }
  }

  // 🎯 최적 프록시 선택
  async getBestProxy(criteria: {
    country?: string;
    maxResponseTime?: number;
    excludeRecent?: boolean;
  } = {}): Promise<ProxyConfig | null> {
    
    const workingProxies = this.proxyPool.filter(proxy => proxy.isWorking);
    
    if (workingProxies.length === 0) {
      logger.warn('No working proxies available');
      return null;
    }

    let filteredProxies = workingProxies;

    // 국가별 필터링
    if (criteria.country) {
      const geoFilteredProxies = [];
      for (const proxy of filteredProxies) {
        const geo = await this.getProxyGeoLocation(proxy);
        if (geo && geo.country.toLowerCase() === criteria.country.toLowerCase()) {
          geoFilteredProxies.push(proxy);
        }
      }
      if (geoFilteredProxies.length > 0) {
        filteredProxies = geoFilteredProxies;
      }
    }

    // 응답 시간 필터링
    if (criteria.maxResponseTime) {
      filteredProxies = filteredProxies.filter(proxy => 
        (proxy.speed || 0) <= criteria.maxResponseTime
      );
    }

    // 최근 사용한 프록시 제외
    if (criteria.excludeRecent) {
      const recentThreshold = Date.now() - (5 * 60 * 1000); // 5분
      filteredProxies = filteredProxies.filter(proxy => 
        (proxy.lastUsed || 0) < recentThreshold
      );
    }

    if (filteredProxies.length === 0) {
      logger.warn('No proxies match the criteria, using any available proxy');
      filteredProxies = workingProxies;
    }

    // 전략에 따른 선택
    let selectedProxy: ProxyConfig;
    
    switch (this.rotationStrategy) {
      case 'round_robin':
        selectedProxy = this.selectRoundRobin(filteredProxies);
        break;
      case 'performance':
        selectedProxy = this.selectByPerformance(filteredProxies);
        break;
      case 'geo_optimized':
        selectedProxy = await this.selectGeoOptimized(filteredProxies, criteria.country);
        break;
      default:
        selectedProxy = this.selectByPerformance(filteredProxies);
    }

    // 사용 시간 업데이트
    selectedProxy.lastUsed = Date.now();
    
    logger.info(`🎯 Selected proxy: ${selectedProxy.host}:${selectedProxy.port} (${selectedProxy.speed}ms)`);
    
    return selectedProxy;
  }

  // 🔄 라운드 로빈 선택
  private selectRoundRobin(proxies: ProxyConfig[]): ProxyConfig {
    const proxy = proxies[this.currentProxyIndex % proxies.length];
    this.currentProxyIndex++;
    return proxy;
  }

  // ⚡ 성능 기반 선택
  private selectByPerformance(proxies: ProxyConfig[]): ProxyConfig {
    // 속도와 신뢰성을 종합한 점수 계산
    const scoredProxies = proxies.map(proxy => ({
      proxy,
      score: this.calculateProxyScore(proxy)
    }));

    scoredProxies.sort((a, b) => b.score - a.score);
    return scoredProxies[0].proxy;
  }

  // 🌍 지역 최적화 선택
  private async selectGeoOptimized(proxies: ProxyConfig[], targetCountry?: string): Promise<ProxyConfig> {
    if (!targetCountry) {
      return this.selectByPerformance(proxies);
    }

    // 타겟 국가의 프록시 우선 선택
    for (const proxy of proxies) {
      const geo = await this.getProxyGeoLocation(proxy);
      if (geo && geo.country.toLowerCase() === targetCountry.toLowerCase()) {
        return proxy;
      }
    }

    // 타겟 국가 프록시가 없으면 성능 기반 선택
    return this.selectByPerformance(proxies);
  }

  // 📊 프록시 점수 계산
  private calculateProxyScore(proxy: ProxyConfig): number {
    const speedScore = proxy.speed ? Math.max(0, 100 - (proxy.speed / 100)) : 0;
    const reliabilityScore = proxy.reliability || 0;
    const failPenalty = (proxy.failCount || 0) * 10;
    
    return speedScore + reliabilityScore - failPenalty;
  }

  // 🌍 프록시 지리적 위치 확인
  private async getProxyGeoLocation(proxy: ProxyConfig): Promise<GeoLocation | null> {
    const cacheKey = `${proxy.host}:${proxy.port}`;
    
    if (this.geoCache.has(cacheKey)) {
      return this.geoCache.get(cacheKey)!;
    }

    try {
      // 지리적 위치 확인 API 사용
      const response = await axios.get(`http://ip-api.com/json/${proxy.host}`, {
        timeout: 5000
      });

      if (response.data.status === 'success') {
        const geoData: GeoLocation = {
          country: response.data.country,
          region: response.data.regionName,
          city: response.data.city,
          ip: response.data.query,
          timezone: response.data.timezone
        };

        this.geoCache.set(cacheKey, geoData);
        return geoData;
      }
      
    } catch (error) {
      logger.warn(`Could not get geo location for ${proxy.host}: ${error}`);
    }

    return null;
  }

  // 🔄 프록시 로테이션 설정
  setRotationStrategy(strategy: 'round_robin' | 'performance' | 'geo_optimized'): void {
    this.rotationStrategy = strategy;
    logger.info(`🔄 Rotation strategy set to: ${strategy}`);
  }

  // 📊 프록시 풀 상태
  getProxyPoolStatus(): {
    total: number;
    working: number;
    failed: number;
    averageSpeed: number;
    topCountries: string[];
  } {
    const working = this.proxyPool.filter(p => p.isWorking);
    const failed = this.proxyPool.filter(p => !p.isWorking);
    
    const averageSpeed = working.length > 0 
      ? working.reduce((sum, p) => sum + (p.speed || 0), 0) / working.length
      : 0;

    const countries = new Map<string, number>();
    working.forEach(async (proxy) => {
      const geo = await this.getProxyGeoLocation(proxy);
      if (geo) {
        countries.set(geo.country, (countries.get(geo.country) || 0) + 1);
      }
    });

    const topCountries = Array.from(countries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country]) => country);

    return {
      total: this.proxyPool.length,
      working: working.length,
      failed: failed.length,
      averageSpeed: Math.round(averageSpeed),
      topCountries
    };
  }

  // ❌ 프록시 실패 보고
  reportProxyFailure(proxy: ProxyConfig, error?: string): void {
    const proxyKey = this.getProxyKey(proxy);
    proxy.failCount = (proxy.failCount || 0) + 1;
    
    // 실패 횟수가 임계값을 넘으면 비활성화
    if (proxy.failCount >= 3) {
      proxy.isWorking = false;
      logger.warn(`❌ Proxy ${proxy.host}:${proxy.port} marked as failed (${proxy.failCount} failures)`);
    }

    // 건강 상태 업데이트
    this.proxyHealthCheck.set(proxyKey, {
      proxy,
      responseTime: 0,
      isWorking: false,
      error
    });
  }

  // ✅ 프록시 성공 보고
  reportProxySuccess(proxy: ProxyConfig, responseTime: number): void {
    const proxyKey = this.getProxyKey(proxy);
    proxy.failCount = 0;
    proxy.isWorking = true;
    proxy.speed = responseTime;
    proxy.lastUsed = Date.now();

    this.proxyHealthCheck.set(proxyKey, {
      proxy,
      responseTime,
      isWorking: true
    });
  }

  // 🔄 프록시 풀 새로고침
  async refreshProxyPool(): Promise<void> {
    logger.info('🔄 Refreshing proxy pool...');
    
    this.proxyPool = [];
    this.proxyHealthCheck.clear();
    this.geoCache.clear();
    
    await this.initializeProxyPool();
  }

  // ⏰ 정기 건강 검사 시작
  private startHealthCheckInterval(): void {
    setInterval(async () => {
      logger.info('⏰ Running periodic proxy health check...');
      await this.testAllProxies();
    }, 10 * 60 * 1000); // 10분마다 실행
  }

  // 🔧 유틸리티 메서드들
  private getProxyKey(proxy: ProxyConfig): string {
    return `${proxy.host}:${proxy.port}`;
  }

  private isValidIP(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 🧹 정리
  async cleanup(): Promise<void> {
    this.proxyPool = [];
    this.proxyHealthCheck.clear();
    this.geoCache.clear();
    logger.info('🧹 IP rotation service cleaned up');
  }
}

// 🌐 고급 IP 위장 서비스
export class AdvancedIPSpoofingService {
  private ipRotationService: IPRotationService;
  private userAgentRotation: string[] = [];
  private headerTemplates: Map<string, any> = new Map();

  constructor() {
    this.ipRotationService = new IPRotationService();
    this.initializeUserAgents();
    this.initializeHeaderTemplates();
  }

  // 🎭 완전한 IP 위장 설정
  async createSpoofedRequest(options: {
    targetUrl: string;
    country?: string;
    userAgentType?: 'chrome' | 'firefox' | 'safari' | 'random';
    headerProfile?: 'desktop' | 'mobile' | 'tablet';
    maxResponseTime?: number;
  }) {
    const proxy = await this.ipRotationService.getBestProxy({
      country: options.country,
      maxResponseTime: options.maxResponseTime,
      excludeRecent: true
    });

    if (!proxy) {
      throw new Error('No suitable proxy available for IP spoofing');
    }

    const userAgent = this.selectUserAgent(options.userAgentType);
    const headers = this.generateHeaders(options.headerProfile, userAgent);

    return {
      proxy: {
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        auth: proxy.username && proxy.password ? {
          username: proxy.username,
          password: proxy.password
        } : undefined
      },
      headers,
      userAgent,
      timeout: 30000
    };
  }

  // 🔄 User-Agent 초기화
  private initializeUserAgents(): void {
    this.userAgentRotation = [
      // Chrome
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      
      // Firefox
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      
      // Safari
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    ];
  }

  // 📋 헤더 템플릿 초기화
  private initializeHeaderTemplates(): void {
    this.headerTemplates.set('desktop', {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });

    this.headerTemplates.set('mobile', {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });
  }

  // 🎯 User-Agent 선택
  private selectUserAgent(type?: 'chrome' | 'firefox' | 'safari' | 'random'): string {
    if (!type || type === 'random') {
      return this.userAgentRotation[Math.floor(Math.random() * this.userAgentRotation.length)];
    }

    const filtered = this.userAgentRotation.filter(ua => {
      switch (type) {
        case 'chrome': return ua.includes('Chrome');
        case 'firefox': return ua.includes('Firefox');
        case 'safari': return ua.includes('Safari') && !ua.includes('Chrome');
        default: return true;
      }
    });

    return filtered[Math.floor(Math.random() * filtered.length)] || this.userAgentRotation[0];
  }

  // 📋 헤더 생성
  private generateHeaders(profile: 'desktop' | 'mobile' | 'tablet' = 'desktop', userAgent: string): any {
    const baseHeaders = this.headerTemplates.get(profile) || this.headerTemplates.get('desktop')!;
    
    return {
      ...baseHeaders,
      'User-Agent': userAgent
    };
  }

  // 📊 서비스 상태
  getServiceStatus() {
    return {
      proxyPool: this.ipRotationService.getProxyPoolStatus(),
      userAgentPool: this.userAgentRotation.length,
      headerTemplates: this.headerTemplates.size
    };
  }
}

// 싱글톤 인스턴스들
export const ipRotationService = new IPRotationService();
export const advancedIPSpoofingService = new AdvancedIPSpoofingService();
