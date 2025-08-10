import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';
import { realBrowserService } from './realBrowserService';
import { cookieSyncService } from './cookieSyncService';
import { jsExecutionService } from './jsExecutionService';
import { advancedProxyService } from './advancedProxyService';

interface UltimateAnalysisOptions {
  userIP: string;
  userAgent: string;
  userCookies?: Record<string, string>;
  preferredCountry?: string;
  useProxy?: boolean;
  maxRetries?: number;
}

export class UltimateYouTubeService {
  
  // 🔥 SaveFrom 방식의 최종 YouTube 분석 시스템
  async analyzeWithSaveFromMethod(url: string, options: UltimateAnalysisOptions): Promise<MediaInfo> {
    logger.info(`🚀 Starting ULTIMATE SaveFrom-style analysis for: ${url}`);
    
    const methods = [
      () => this.methodRealBrowserCookies(url, options),
      () => this.methodJavaScriptExecution(url, options),
      () => this.methodProxyChain(url, options),
      () => this.methodHybridApproach(url, options)
    ];

    let lastError = '';

    for (const [index, method] of methods.entries()) {
      try {
        logger.info(`🎯 Attempting method ${index + 1}/4: ${method.name}`);
        
        const result = await method();
        
        if (result && result.title) {
          logger.info(`✅ SUCCESS with method ${index + 1}!`);
          return result;
        }
        
      } catch (error: any) {
        lastError = error.message;
        logger.warn(`❌ Method ${index + 1} failed: ${error.message}`);
        
        // 다음 방법 시도 전 잠시 대기
        if (index < methods.length - 1) {
          await this.sleep(2000);
        }
      }
    }

    throw new Error(`All methods failed. Last error: ${lastError}`);
  }

  // 🍪 방법 1: 실제 브라우저 쿠키 사용
  private async methodRealBrowserCookies(url: string, options: UltimateAnalysisOptions): Promise<MediaInfo> {
    logger.info('🍪 Method 1: Real Browser Cookies');
    
    // 쿠키 동기화
    const syncedCookies = await cookieSyncService.syncUserCookies(url, options.userCookies);
    
    // 실제 브라우저로 분석
    const result = await realBrowserService.analyzeWithRealCookies(url);
    
    return result;
  }

  // 🚀 방법 2: JavaScript 실행 환경
  private async methodJavaScriptExecution(url: string, options: UltimateAnalysisOptions): Promise<MediaInfo> {
    logger.info('🚀 Method 2: JavaScript Execution');
    
    const jsResult = await jsExecutionService.intelligentExtraction(url);
    
    if (jsResult.error) {
      throw new Error(jsResult.error);
    }

    return this.convertJSResultToMediaInfo(jsResult, url);
  }

  // 🌐 방법 3: 고급 프록시 체인
  private async methodProxyChain(url: string, options: UltimateAnalysisOptions): Promise<MediaInfo> {
    logger.info('🌐 Method 3: Advanced Proxy Chain');
    
    const proxyOptions = {
      headers: {
        'User-Agent': options.userAgent,
        'Referer': 'https://www.youtube.com/',
      },
      cookies: options.userCookies ? cookieSyncService.formatCookiesForYtDlp(options.userCookies) : undefined
    };

    let proxyResult;
    
    if (options.preferredCountry) {
      proxyResult = await advancedProxyService.requestWithRegionalProxy(url, options.preferredCountry, proxyOptions);
    } else {
      proxyResult = await advancedProxyService.requestWithMultipleProxies(url, proxyOptions);
    }

    if (!proxyResult.success) {
      throw new Error(proxyResult.error || 'Proxy request failed');
    }

    // 프록시를 통해 받은 HTML에서 YouTube 데이터 추출
    return this.extractFromHTML(proxyResult.data, url);
  }

  // 🔄 방법 4: 하이브리드 접근법
  private async methodHybridApproach(url: string, options: UltimateAnalysisOptions): Promise<MediaInfo> {
    logger.info('🔄 Method 4: Hybrid Approach');
    
    // 1단계: 브라우저로 쿠키 수집
    const sessionData = await realBrowserService.extractYouTubeCookies(url);
    
    // 2단계: 프록시를 통해 요청 (브라우저 쿠키 사용)
    const proxyResult = await advancedProxyService.requestThroughProxyChain(url, {
      headers: {
        'User-Agent': sessionData.userAgent,
        'Cookie': cookieSyncService.formatCookiesForYtDlp(sessionData.cookies as Record<string, string>),
        'Referer': 'https://www.youtube.com/'
      }
    });

    if (!proxyResult.success) {
      throw new Error('Hybrid proxy request failed');
    }

    // 3단계: JavaScript 실행으로 데이터 추출
    const jsResult = await jsExecutionService.executeYouTubeExtraction(url);
    
    if (jsResult.error) {
      // JavaScript 실행 실패 시 HTML 파싱 시도
      return this.extractFromHTML(proxyResult.data, url);
    }

    return this.convertJSResultToMediaInfo(jsResult, url);
  }

  // 🔧 JavaScript 결과를 MediaInfo로 변환
  private convertJSResultToMediaInfo(jsResult: any, url: string): MediaInfo {
    const videoDetails = jsResult.videoDetails || {};
    const formats = jsResult.formats || [];

    // 비디오 포맷 분리
    const videoFormats = formats.filter((f: any) => 
      f.vcodec && f.vcodec !== 'none' && (f.acodec === 'none' || !f.acodec)
    );

    // 오디오 포맷 분리
    const audioFormats = formats.filter((f: any) => 
      f.acodec && f.acodec !== 'none' && (f.vcodec === 'none' || !f.vcodec)
    );

    // 품질 정보 추출
    const availableQualities = [...new Set(
      videoFormats
        .map((f: any) => f.height || f.quality)
        .filter((q: any) => q && typeof q === 'number')
    )].sort((a: number, b: number) => b - a) as number[];

    const availableAudioBitrates = [...new Set(
      audioFormats
        .map((f: any) => f.abr || f.bitrate)
        .filter((b: any) => b && typeof b === 'number')
    )].sort((a: number, b: number) => b - a) as number[];

    return {
      id: videoDetails.videoId || this.extractVideoId(url),
      title: videoDetails.title || 'Unknown Title',
      description: videoDetails.shortDescription || videoDetails.description || '',
      thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || '',
      duration: parseInt(videoDetails.lengthSeconds) || 0,
      view_count: parseInt(videoDetails.viewCount) || 0,
      uploader: videoDetails.author || videoDetails.channelId || 'Unknown',
      upload_date: videoDetails.publishDate || '',
      webpage_url: url,
      extractor: 'ultimate_savefrom_method',
      video_formats: videoFormats,
      audio_formats: audioFormats,
      available_qualities: availableQualities,
      available_audio_bitrates: availableAudioBitrates
    };
  }

  // 🔍 HTML에서 YouTube 데이터 추출
  private extractFromHTML(html: string, url: string): MediaInfo {
    try {
      // ytInitialData 추출 시도
      const ytInitialDataMatch = html.match(/var ytInitialData = ({.+?});/);
      const ytInitialPlayerResponseMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);

      let videoData: any = {};
      
      if (ytInitialPlayerResponseMatch) {
        try {
          const playerResponse = JSON.parse(ytInitialPlayerResponseMatch[1]);
          videoData = playerResponse.videoDetails || {};
        } catch (e) {
          logger.warn('Failed to parse ytInitialPlayerResponse');
        }
      }

      if (ytInitialDataMatch) {
        try {
          const initialData = JSON.parse(ytInitialDataMatch[1]);
          // 추가 데이터 추출 로직
        } catch (e) {
          logger.warn('Failed to parse ytInitialData');
        }
      }

      // 기본 메타데이터 추출
      const titleMatch = html.match(/<title>(.+?)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Title';

      return {
        id: this.extractVideoId(url),
        title: videoData.title || title,
        description: videoData.shortDescription || '',
        thumbnail: videoData.thumbnail?.thumbnails?.[0]?.url || '',
        duration: parseInt(videoData.lengthSeconds) || 0,
        view_count: parseInt(videoData.viewCount) || 0,
        uploader: videoData.author || 'Unknown',
        upload_date: '',
        webpage_url: url,
        extractor: 'html_extraction',
        video_formats: [],
        audio_formats: [],
        available_qualities: [],
        available_audio_bitrates: []
      };

    } catch (error) {
      logger.error(`HTML extraction failed: ${error}`);
      throw new Error('Failed to extract data from HTML');
    }
  }

  // 🔧 유틸리티 함수들
  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
    return match ? match[1] : 'unknown';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 📊 시스템 상태 확인
  async getSystemStatus(): Promise<any> {
    const proxyStats = advancedProxyService.getProxyStats();
    const cookieStats = cookieSyncService.getCookieStats();

    return {
      timestamp: new Date().toISOString(),
      proxies: proxyStats,
      cookies: cookieStats,
      browser: {
        initialized: realBrowserService['browser'] !== null,
        pageReady: realBrowserService['page'] !== null
      },
      status: 'operational'
    };
  }

  // 🧹 시스템 정리
  async cleanup(): Promise<void> {
    await realBrowserService.cleanup();
    advancedProxyService.clearFailedProxies();
    logger.info('🧹 Ultimate YouTube Service cleaned up');
  }
}

// 글로벌 최종 YouTube 서비스
export const ultimateYouTubeService = new UltimateYouTubeService();

// 프로세스 종료 시 정리
process.on('SIGTERM', () => ultimateYouTubeService.cleanup());
process.on('SIGINT', () => ultimateYouTubeService.cleanup());
