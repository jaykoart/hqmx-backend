import { logger } from '../utils/logger';

export interface UserProfile {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
  };
  timezone: string;
  timezoneOffset: number;
  timestamp: number;
  cookies: string;
  fingerprint: {
    canvas?: string;
    webgl?: {
      vendor: string;
      renderer: string;
    };
  };
  behaviorPattern: {
    clickPattern: Array<{
      selector: string;
      delay: number;
      wait: number;
    }>;
    scrollPattern: Array<{
      x: number;
      y: number;
      wait: number;
    }>;
  };
}

export class UserProfileService {
  
  /**
   * 🔥 SaveFrom 스타일 사용자 프로필 생성
   * Terms of Service에 따라 사용자 정보를 수집하고 활용
   */
  static generateSaveFromProfile(userProfile: Partial<UserProfile>): UserProfile {
    logger.info('🎭 Generating SaveFrom-style user profile');
    
    const now = Date.now();
    
    // 기본 SaveFrom 사용자 패턴
    const defaultProfile: UserProfile = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      language: 'en-US',
      languages: ['en-US', 'en', 'ko-KR', 'ko'],
      platform: 'Win32',
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24
      },
      timezone: 'America/New_York',
      timezoneOffset: -300,
      timestamp: now,
      cookies: this.generateSaveFromCookies(),
      fingerprint: {
        canvas: this.generateCanvasFingerprint(),
        webgl: {
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
        }
      },
      behaviorPattern: {
        clickPattern: [
          { selector: 'body', delay: 100, wait: 500 },
          { selector: '#movie_player', delay: 200, wait: 1000 },
          { selector: '.ytp-play-button', delay: 150, wait: 300 }
        ],
        scrollPattern: [
          { x: 0, y: 100, wait: 500 },
          { x: 0, y: 300, wait: 800 },
          { x: 0, y: 0, wait: 400 }
        ]
      }
    };

    // 사용자 제공 정보로 오버라이드
    const profile = { ...defaultProfile, ...userProfile };
    
    logger.info('✅ User profile generated successfully');
    return profile;
  }

  /**
   * 🍪 SaveFrom 스타일 쿠키 생성
   */
  private static generateSaveFromCookies(): string {
    const cookies = [
      'CONSENT=YES+cb.20210720-07-p0.en+FX+410',
      `YSC=${this.generateRandomString(20)}`,
      `VISITOR_INFO1_LIVE=${this.generateRandomString(22)}`,
      'GPS=1',
      `PREF=f4=4000000&tz=America.New_York&f6=40000000&f5=30000`,
      `__Secure-3PSID=${this.generateRandomString(64)}`,
      `__Secure-3PAPISID=${this.generateRandomString(32)}`,
      `LOGIN_INFO=${this.generateRandomString(128)}`
    ];
    
    return cookies.join('; ');
  }

  /**
   * 🎨 Canvas 핑거프린트 생성
   */
  private static generateCanvasFingerprint(): string {
    // SaveFrom에서 사용하는 일반적인 Canvas 패턴
    const canvasData = [
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAABkW7XS',
      'AAAFjklEQVR4nO3d', this.generateRandomString(200), '=='
    ].join('');
    
    return canvasData;
  }

  /**
   * 🔤 랜덤 문자열 생성
   */
  private static generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 🌐 사용자 환경 기반 최적화된 프로필 생성
   */
  static createOptimizedProfile(userAgent?: string, clientIP?: string): UserProfile {
    logger.info('🎯 Creating optimized user profile for YouTube bypass');
    
    // 클라이언트 정보 기반 프로필 조정
    let platform = 'Win32';
    let language = 'en-US';
    
    if (userAgent) {
      if (userAgent.includes('Mac')) {
        platform = 'MacIntel';
      } else if (userAgent.includes('Linux')) {
        platform = 'Linux x86_64';
      }
      
      if (userAgent.includes('ko-KR')) {
        language = 'ko-KR';
      }
    }

    return this.generateSaveFromProfile({
      userAgent: userAgent || undefined,
      platform,
      language,
      timestamp: Date.now()
    });
  }

  /**
   * 🕐 시간대별 최적화 프로필
   */
  static getTimezoneOptimizedProfile(timezone?: string): Partial<UserProfile> {
    const timezoneMap: { [key: string]: { timezone: string; offset: number; language: string } } = {
      'Asia/Seoul': { timezone: 'Asia/Seoul', offset: -540, language: 'ko-KR' },
      'America/New_York': { timezone: 'America/New_York', offset: -300, language: 'en-US' },
      'Europe/London': { timezone: 'Europe/London', offset: 0, language: 'en-GB' },
      'Asia/Tokyo': { timezone: 'Asia/Tokyo', offset: -540, language: 'ja-JP' }
    };

    const tz = timezone || 'America/New_York';
    const config = timezoneMap[tz] || timezoneMap['America/New_York'];

    return {
      timezone: config.timezone,
      timezoneOffset: config.offset,
      language: config.language
    };
  }
}

