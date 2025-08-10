import { logger } from './logger';

// 요청 간격 랜덤화
export function getRandomDelay(): number {
  // 1-5초 랜덤 지연
  return Math.floor(Math.random() * 4000) + 1000;
}

// 요청 패턴 랜덤화
export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/127.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 요청 제한 관리
class RequestLimiter {
  private requests: Map<string, number[]> = new Map();
  
  canMakeRequest(ip: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.requests.has(ip)) {
      this.requests.set(ip, []);
    }
    
    const requests = this.requests.get(ip)!;
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(ip, recentRequests);
    return true;
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [ip, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => now - time < 60000);
      if (recentRequests.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, recentRequests);
      }
    }
  }
}

export const requestLimiter = new RequestLimiter();

// 정기 정리 작업
setInterval(() => {
  requestLimiter.cleanup();
}, 60000); // 1분마다 정리
