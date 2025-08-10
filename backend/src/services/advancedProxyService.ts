import { logger } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';

interface ProxyConfig {
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  country?: string;
  speed?: number;
  reliability?: number;
  lastUsed?: number;
  failCount?: number;
}

interface ProxyChainResult {
  success: boolean;
  data?: any;
  proxy?: ProxyConfig;
  responseTime?: number;
  error?: string;
}

export class AdvancedProxyService {
  private proxyPool: ProxyConfig[] = [];
  private workingProxies: ProxyConfig[] = [];
  private failedProxies: Set<string> = new Set();
  private readonly MAX_RETRIES = 3;
  private readonly TIMEOUT = 15000;

  constructor() {
    this.initializeProxyPool();
  }

  // 🌐 프록시 풀 초기화
  private initializeProxyPool(): void {
    // 고품질 프록시 서버들 (예시)
    const proxyConfigs: ProxyConfig[] = [
      // 미국 프록시
      { host: '198.23.239.134', port: 6540, protocol: 'http', country: 'US', speed: 95, reliability: 98 },
      { host: '207.244.217.165', port: 6712, protocol: 'http', country: 'US', speed: 92, reliability: 96 },
      
      // 유럽 프록시
      { host: '185.199.229.156', port: 7492, protocol: 'http', country: 'DE', speed: 88, reliability: 94 },
      { host: '185.199.228.220', port: 7300, protocol: 'http', country: 'NL', speed: 90, reliability: 95 },
      
      // 아시아 프록시
      { host: '103.127.204.106', port: 25327, protocol: 'http', country: 'SG', speed: 85, reliability: 92 },
      { host: '202.61.51.204', port: 3128, protocol: 'http', country: 'JP', speed: 87, reliability: 93 },
      
      // 로컬 프록시 (사용자 IP 우회용)
      { host: 'localhost', port: 8888, protocol: 'http', country: 'LOCAL', speed: 100, reliability: 100 }
    ];

    this.proxyPool = proxyConfigs.map(config => ({
      ...config,
      failCount: 0,
      lastUsed: 0
    }));

    logger.info(`🌐 Initialized proxy pool with ${this.proxyPool.length} proxies`);
  }

  // 🎯 최적 프록시 선택
  private selectBestProxy(): ProxyConfig | null {
    // 실패한 프록시 제외
    const availableProxies = this.proxyPool.filter(proxy => {
      const proxyKey = `${proxy.host}:${proxy.port}`;
      return !this.failedProxies.has(proxyKey) && (proxy.failCount || 0) < this.MAX_RETRIES;
    });

    if (availableProxies.length === 0) {
      logger.warn('⚠️ No available proxies in pool');
      return null;
    }

    // 성능과 신뢰성 기준으로 정렬
    availableProxies.sort((a, b) => {
      const scoreA = (a.speed || 0) * 0.6 + (a.reliability || 0) * 0.4 - (a.failCount || 0) * 10;
      const scoreB = (b.speed || 0) * 0.6 + (b.reliability || 0) * 0.4 - (b.failCount || 0) * 10;
      return scoreB - scoreA;
    });

    const selectedProxy = availableProxies[0];
    selectedProxy.lastUsed = Date.now();

    logger.info(`🎯 Selected proxy: ${selectedProxy.host}:${selectedProxy.port} (${selectedProxy.country})`);
    return selectedProxy;
  }

  // 🔗 프록시 체인을 통한 YouTube 요청
  async requestThroughProxyChain(url: string, options: any = {}): Promise<ProxyChainResult> {
    const proxy = this.selectBestProxy();
    
    if (!proxy) {
      return { success: false, error: 'No available proxies' };
    }

    const startTime = Date.now();

    try {
      const axiosConfig = this.buildAxiosConfig(proxy, options);
      const response = await axios.get(url, axiosConfig);
      
      const responseTime = Date.now() - startTime;
      
      // 성공한 프록시 성능 업데이트
      this.updateProxyPerformance(proxy, true, responseTime);
      
      logger.info(`✅ Proxy request successful in ${responseTime}ms`);
      
      return {
        success: true,
        data: response.data,
        proxy,
        responseTime
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // 실패한 프록시 처리
      this.updateProxyPerformance(proxy, false, responseTime);
      
      logger.error(`❌ Proxy request failed: ${error.message}`);
      
      return {
        success: false,
        proxy,
        responseTime,
        error: error.message
      };
    }
  }

  // ⚙️ Axios 설정 구성
  private buildAxiosConfig(proxy: ProxyConfig, options: any): any {
    const config: any = {
      timeout: this.TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true
      })
    };

    // 프록시 설정
    if (proxy.host !== 'localhost') {
      config.proxy = {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol
      };

      if (proxy.auth) {
        config.proxy.auth = proxy.auth;
      }
    }

    // 쿠키 설정
    if (options.cookies) {
      config.headers['Cookie'] = options.cookies;
    }

    return config;
  }

  // 📊 프록시 성능 업데이트
  private updateProxyPerformance(proxy: ProxyConfig, success: boolean, responseTime: number): void {
    const proxyKey = `${proxy.host}:${proxy.port}`;

    if (success) {
      // 성공 시 신뢰성 향상
      proxy.reliability = Math.min(100, (proxy.reliability || 0) + 1);
      proxy.speed = Math.max(0, 100 - (responseTime / 100));
      proxy.failCount = 0;
      
      // 실패 목록에서 제거
      this.failedProxies.delete(proxyKey);
      
      // 작동하는 프록시 목록에 추가
      if (!this.workingProxies.find(p => p.host === proxy.host && p.port === proxy.port)) {
        this.workingProxies.push(proxy);
      }
    } else {
      // 실패 시 신뢰성 감소
      proxy.reliability = Math.max(0, (proxy.reliability || 0) - 5);
      proxy.failCount = (proxy.failCount || 0) + 1;
      
      // 너무 많이 실패한 프록시는 일시적으로 차단
      if (proxy.failCount >= this.MAX_RETRIES) {
        this.failedProxies.add(proxyKey);
        logger.warn(`🚫 Proxy ${proxyKey} temporarily blocked due to failures`);
      }
    }
  }

  // 🔄 다중 프록시 시도
  async requestWithMultipleProxies(url: string, options: any = {}): Promise<ProxyChainResult> {
    const maxAttempts = Math.min(3, this.proxyPool.length);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.info(`🔄 Proxy attempt ${attempt}/${maxAttempts}`);
      
      const result = await this.requestThroughProxyChain(url, options);
      
      if (result.success) {
        return result;
      }
      
      // 다음 시도 전 잠시 대기
      if (attempt < maxAttempts) {
        await this.sleep(1000 * attempt);
      }
    }

    return { success: false, error: 'All proxy attempts failed' };
  }

  // 🌍 지역별 프록시 선택
  async requestWithRegionalProxy(url: string, preferredCountry: string, options: any = {}): Promise<ProxyChainResult> {
    // 선호 국가의 프록시 우선 선택
    const regionalProxies = this.proxyPool.filter(proxy => 
      proxy.country === preferredCountry && !this.failedProxies.has(`${proxy.host}:${proxy.port}`)
    );

    if (regionalProxies.length > 0) {
      logger.info(`🌍 Using ${preferredCountry} proxy for request`);
      
      // 임시로 프록시 풀을 지역 프록시로 교체
      const originalPool = [...this.proxyPool];
      this.proxyPool = regionalProxies;
      
      const result = await this.requestThroughProxyChain(url, options);
      
      // 원래 풀로 복원
      this.proxyPool = originalPool;
      
      return result;
    }

    // 지역 프록시가 없으면 일반 요청
    logger.warn(`⚠️ No ${preferredCountry} proxies available, using default`);
    return this.requestThroughProxyChain(url, options);
  }

  // 🔍 프록시 상태 확인
  async checkProxyHealth(): Promise<void> {
    logger.info('🔍 Checking proxy health...');
    
    const testUrl = 'https://httpbin.org/ip';
    const healthPromises = this.proxyPool.map(async (proxy) => {
      try {
        const result = await this.testProxy(proxy, testUrl);
        if (result.success) {
          logger.info(`✅ Proxy ${proxy.host}:${proxy.port} is healthy`);
        } else {
          logger.warn(`⚠️ Proxy ${proxy.host}:${proxy.port} failed health check`);
        }
      } catch (error) {
        logger.error(`❌ Proxy ${proxy.host}:${proxy.port} health check error: ${error}`);
      }
    });

    await Promise.allSettled(healthPromises);
    
    const workingCount = this.workingProxies.length;
    const totalCount = this.proxyPool.length;
    logger.info(`📊 Proxy health check complete: ${workingCount}/${totalCount} proxies working`);
  }

  // 🧪 개별 프록시 테스트
  private async testProxy(proxy: ProxyConfig, testUrl: string): Promise<ProxyChainResult> {
    const config = this.buildAxiosConfig(proxy, {});
    config.timeout = 5000; // 짧은 타임아웃

    try {
      const response = await axios.get(testUrl, config);
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // 💤 대기 함수
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 📊 프록시 통계
  getProxyStats(): any {
    const total = this.proxyPool.length;
    const working = this.workingProxies.length;
    const failed = this.failedProxies.size;
    const countries = [...new Set(this.proxyPool.map(p => p.country))];

    return {
      total,
      working,
      failed,
      available: total - failed,
      countries,
      averageReliability: this.proxyPool.reduce((sum, p) => sum + (p.reliability || 0), 0) / total,
      averageSpeed: this.proxyPool.reduce((sum, p) => sum + (p.speed || 0), 0) / total
    };
  }

  // 🧹 실패한 프록시 정리
  clearFailedProxies(): void {
    this.failedProxies.clear();
    this.proxyPool.forEach(proxy => {
      proxy.failCount = 0;
    });
    logger.info('🧹 Cleared failed proxy list');
  }
}

// 글로벌 고급 프록시 서비스
export const advancedProxyService = new AdvancedProxyService();

// 정기적인 프록시 상태 확인 (30분마다)
setInterval(() => {
  advancedProxyService.checkProxyHealth();
}, 30 * 60 * 1000);
