import { logger } from '../utils/logger';
import { realBrowserService } from './realBrowserService';

interface SyncedCookieData {
  cookies: Record<string, string>;
  userAgent: string;
  timestamp: number;
  videoId: string;
  sessionData: any;
}

export class CookieSyncService {
  private cookieCache = new Map<string, SyncedCookieData>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10분 캐시

  // 🍪 사용자의 실제 YouTube 쿠키 동기화
  async syncUserCookies(videoUrl: string, userProvidedCookies?: Record<string, string>): Promise<SyncedCookieData> {
    const videoId = this.extractVideoId(videoUrl);
    const cacheKey = `${videoId}_cookies`;

    // 캐시 확인
    const cached = this.cookieCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      logger.info('🎯 Using cached cookie data');
      return cached;
    }

    try {
      let syncedData: SyncedCookieData;

      if (userProvidedCookies && Object.keys(userProvidedCookies).length > 0) {
        // 사용자가 직접 제공한 쿠키 사용
        logger.info('🍪 Using user-provided cookies');
        syncedData = {
          cookies: userProvidedCookies,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          timestamp: Date.now(),
          videoId,
          sessionData: {}
        };
      } else {
        // 실제 브라우저로 쿠키 자동 수집
        logger.info('🌐 Extracting cookies from real browser session');
        const browserData = await realBrowserService.extractYouTubeCookies(videoUrl);
        
        syncedData = {
          cookies: browserData.cookies as Record<string, string>,
          userAgent: browserData.userAgent,
          timestamp: Date.now(),
          videoId,
          sessionData: browserData.clientData
        };
      }

      // 캐시 저장
      this.cookieCache.set(cacheKey, syncedData);
      
      logger.info(`✅ Successfully synced ${Object.keys(syncedData.cookies).length} cookies for video ${videoId}`);
      return syncedData;

    } catch (error) {
      logger.error(`❌ Cookie sync failed: ${error}`);
      throw error;
    }
  }

  // 🔄 쿠키를 yt-dlp 형식으로 변환
  formatCookiesForYtDlp(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .filter(([name, value]) => name && value)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  // 🔄 쿠키를 Netscape 형식으로 변환 (yt-dlp --cookies 옵션용)
  formatCookiesAsNetscape(cookies: Record<string, string>, domain: string = '.youtube.com'): string {
    const netscapeLines = [
      '# Netscape HTTP Cookie File',
      '# This is a generated file! Do not edit.',
      ''
    ];

    Object.entries(cookies).forEach(([name, value]) => {
      // domain    flag    path    secure    expiration    name    value
      const line = `${domain}\tTRUE\t/\tTRUE\t${Math.floor(Date.now() / 1000) + 86400}\t${name}\t${value}`;
      netscapeLines.push(line);
    });

    return netscapeLines.join('\n');
  }

  // 🧠 스마트 쿠키 분석 및 최적화
  optimizeCookiesForYouTube(cookies: Record<string, string>): Record<string, string> {
    const criticalCookies = [
      'session_token',
      'visitor_info1_live', 
      'ysc',
      'consent',
      'sid',
      'hsid',
      'ssid',
      'apisid',
      'sapisid',
      '__Secure-1PAPISID',
      '__Secure-1PSID',
      '__Secure-3PAPISID',
      '__Secure-3PSID',
      'LOGIN_INFO',
      'PREF',
      'VISITOR_INFO1_LIVE'
    ];

    const optimized: Record<string, string> = {};

    // 중요한 쿠키 우선 추가
    criticalCookies.forEach(cookieName => {
      if (cookies[cookieName]) {
        optimized[cookieName] = cookies[cookieName];
      }
    });

    // 나머지 YouTube 관련 쿠키 추가
    Object.entries(cookies).forEach(([name, value]) => {
      if (!optimized[name] && (
        name.toLowerCase().includes('youtube') ||
        name.toLowerCase().includes('google') ||
        name.toLowerCase().includes('yt')
      )) {
        optimized[name] = value;
      }
    });

    logger.info(`🎯 Optimized cookies: ${Object.keys(optimized).length} critical cookies selected`);
    return optimized;
  }

  // 🔍 쿠키 유효성 검증
  validateCookies(cookies: Record<string, string>): boolean {
    const requiredCookies = ['visitor_info1_live', 'ysc'];
    const hasRequired = requiredCookies.some(required => cookies[required]);
    
    if (!hasRequired) {
      logger.warn('⚠️ Missing critical YouTube cookies');
      return false;
    }

    // 쿠키 값 형식 검증
    for (const [name, value] of Object.entries(cookies)) {
      if (!value || value.length === 0) {
        logger.warn(`⚠️ Empty cookie value for ${name}`);
        continue;
      }
      
      // 특정 쿠키의 형식 검증
      if (name === 'visitor_info1_live' && value.length < 10) {
        logger.warn('⚠️ visitor_info1_live cookie seems invalid');
        return false;
      }
    }

    logger.info('✅ Cookie validation passed');
    return true;
  }

  // 🧹 캐시 정리
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, data] of this.cookieCache.entries()) {
      if (now - data.timestamp > this.CACHE_DURATION) {
        this.cookieCache.delete(key);
      }
    }
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
    return match ? match[1] : 'unknown';
  }

  // 📊 쿠키 통계
  getCookieStats(): { totalCached: number, validCookies: number } {
    this.clearExpiredCache();
    const totalCached = this.cookieCache.size;
    let validCookies = 0;

    for (const data of this.cookieCache.values()) {
      if (this.validateCookies(data.cookies)) {
        validCookies++;
      }
    }

    return { totalCached, validCookies };
  }
}

// 글로벌 쿠키 동기화 서비스
export const cookieSyncService = new CookieSyncService();

// 정기적으로 만료된 캐시 정리
setInterval(() => {
  cookieSyncService.clearExpiredCache();
}, 5 * 60 * 1000); // 5분마다 정리
