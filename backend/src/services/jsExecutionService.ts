import { logger } from '../utils/logger';
import { realBrowserService } from './realBrowserService';
import { cookieSyncService } from './cookieSyncService';

interface JSExecutionResult {
  playerResponse?: any;
  streamingData?: any;
  videoDetails?: any;
  formats?: any[];
  error?: string;
}

export class JSExecutionService {
  
  // 🚀 클라이언트 사이드 JavaScript 실행으로 YouTube 데이터 추출
  async executeYouTubeExtraction(videoUrl: string): Promise<JSExecutionResult> {
    try {
      logger.info(`🔥 Executing client-side JavaScript for: ${videoUrl}`);

      // 실제 브라우저 세션으로 YouTube 접속
      const sessionData = await realBrowserService.extractYouTubeCookies(videoUrl);
      
      // 브라우저에서 JavaScript 실행으로 데이터 추출
      const result = await this.executeInBrowser(videoUrl);
      
      return result;
    } catch (error) {
      logger.error(`❌ JavaScript execution failed: ${error}`);
      return { error: error.toString() };
    }
  }

  // 🌐 브라우저 내에서 JavaScript 실행
  private async executeInBrowser(videoUrl: string): Promise<JSExecutionResult> {
    if (!realBrowserService['page']) {
      await realBrowserService.initializeBrowser();
    }

    try {
      const page = realBrowserService['page'];
      if (!page) throw new Error('Browser page not available');

      // YouTube 페이지로 이동
      await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // 페이지 완전 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 🔥 JavaScript 실행으로 YouTube 내부 데이터 추출
      const extractionResult = await page.evaluate(() => {
        try {
          // @ts-ignore - DOM context in Puppeteer
          // YouTube의 내부 변수들 접근
          const ytInitialData = (window as any).ytInitialData;
          // @ts-ignore - DOM context in Puppeteer
          const ytInitialPlayerResponse = (window as any).ytInitialPlayerResponse;
          // @ts-ignore - DOM context in Puppeteer
          const ytcfg = (window as any).ytcfg;

          // Player Response 추출
          let playerResponse = ytInitialPlayerResponse;
          
          // 대체 방법으로 player response 찾기
          if (!playerResponse) {
            // @ts-ignore - DOM context in Puppeteer
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

          // 스트리밍 데이터 추출
          const streamingData = playerResponse?.streamingData;
          const videoDetails = playerResponse?.videoDetails;

          // 포맷 정보 추출
          let formats: any[] = [];
          if (streamingData) {
            formats = [
              ...(streamingData.formats || []),
              ...(streamingData.adaptiveFormats || [])
            ];
          }

          // 추가 데이터 수집
          const additionalData = {
            // @ts-ignore - DOM context in Puppeteer
            // 페이지 메타데이터
            title: document.title,
            // @ts-ignore - DOM context in Puppeteer
            url: window.location.href,
            
            // YouTube 특화 데이터
            ytcfg: ytcfg,
            
            // @ts-ignore - DOM context in Puppeteer
            // 네트워크 요청 정보 (가능한 경우)
            performanceEntries: performance.getEntriesByType('resource'),
            
            // @ts-ignore - DOM context in Puppeteer
            // 브라우저 환경 정보
            userAgent: navigator.userAgent,
            // @ts-ignore - DOM context in Puppeteer
            language: navigator.language,
            // @ts-ignore - DOM context in Puppeteer
            cookieEnabled: navigator.cookieEnabled,
            // @ts-ignore - DOM context in Puppeteer
            onLine: navigator.onLine
          };

          return {
            playerResponse,
            streamingData,
            videoDetails,
            formats,
            ytInitialData,
            additionalData,
            success: true
          };

        } catch (error) {
          return {
            error: `JavaScript execution error: ${error.message}`,
            success: false
          };
        }
      });

      if (extractionResult.success) {
        logger.info('✅ Successfully extracted data via JavaScript execution');
        
        // 🔍 스트림 URL 직접 추출 시도
        const streamUrls = await this.extractStreamUrls(extractionResult);
        
        return {
          playerResponse: extractionResult.playerResponse,
          streamingData: extractionResult.streamingData,
          videoDetails: extractionResult.videoDetails,
          formats: streamUrls.length > 0 ? streamUrls : extractionResult.formats
        };
      } else {
        throw new Error(extractionResult.error || 'JavaScript execution failed');
      }

    } catch (error) {
      logger.error(`Browser JavaScript execution failed: ${error}`);
      throw error;
    }
  }

  // 🎯 스트림 URL 직접 추출
  private async extractStreamUrls(data: any): Promise<any[]> {
    try {
      const formats = data.formats || [];
      const streamUrls: any[] = [];

      for (const format of formats) {
        if (format.url || format.signatureCipher || format.cipher) {
          // 직접 URL이 있는 경우
          if (format.url) {
            streamUrls.push({
              ...format,
              directUrl: format.url,
              extracted: true
            });
          }
          
          // 서명이 필요한 경우 (복잡한 디코딩 필요)
          else if (format.signatureCipher || format.cipher) {
            const cipherData = format.signatureCipher || format.cipher;
            
            // 기본적인 파라미터 파싱
            const params = new URLSearchParams(cipherData);
            const url = params.get('url');
            const signature = params.get('s');
            
            if (url) {
              streamUrls.push({
                ...format,
                baseUrl: url,
                signature: signature,
                needsDecoding: true,
                extracted: true
              });
            }
          }
        }
      }

      if (streamUrls.length > 0) {
        logger.info(`🎯 Extracted ${streamUrls.length} stream URLs directly from JavaScript`);
      }

      return streamUrls;
    } catch (error) {
      logger.error(`Stream URL extraction failed: ${error}`);
      return [];
    }
  }

  // 🔐 YouTube 서명 디코딩 시도
  async attemptSignatureDecoding(videoUrl: string): Promise<string | null> {
    try {
      if (!realBrowserService['page']) {
        await realBrowserService.initializeBrowser();
      }

      const page = realBrowserService['page'];
      if (!page) return null;

      // YouTube 플레이어 스크립트에서 서명 함수 추출 시도
      const decoderFunction = await page.evaluate(() => {
        try {
          // @ts-ignore - DOM context in Puppeteer
          // YouTube 플레이어에서 서명 디코딩 함수 찾기
          const scripts = document.querySelectorAll('script');
          
          for (const script of scripts) {
            if (script.src && script.src.includes('/player/')) {
              // 플레이어 스크립트 URL 반환
              return script.src;
            }
          }
          
          return null;
        } catch (error) {
          return null;
        }
      });

      if (decoderFunction) {
        logger.info(`🔐 Found potential signature decoder: ${decoderFunction}`);
        return decoderFunction;
      }

      return null;
    } catch (error) {
      logger.error(`Signature decoding attempt failed: ${error}`);
      return null;
    }
  }

  // 🧠 지능형 데이터 추출 (여러 방법 시도)
  async intelligentExtraction(videoUrl: string): Promise<JSExecutionResult> {
    const methods = [
      () => this.executeYouTubeExtraction(videoUrl),
      () => this.extractViaNetworkRequests(videoUrl),
      () => this.extractViaPlayerAPI(videoUrl)
    ];

    for (const [index, method] of methods.entries()) {
      try {
        logger.info(`🎯 Trying extraction method ${index + 1}/3`);
        const result = await method();
        
        if (result && !result.error && (result.formats?.length || result.streamingData)) {
          logger.info(`✅ Success with method ${index + 1}`);
          return result;
        }
      } catch (error) {
        logger.warn(`Method ${index + 1} failed: ${error}`);
        continue;
      }
    }

    return { error: 'All extraction methods failed' };
  }

  // 🌐 네트워크 요청 모니터링을 통한 추출
  private async extractViaNetworkRequests(videoUrl: string): Promise<JSExecutionResult> {
    if (!realBrowserService['page']) {
      await realBrowserService.initializeBrowser();
    }

    const page = realBrowserService['page'];
    if (!page) throw new Error('Browser page not available');

    const networkData: any[] = [];

    // 네트워크 요청 모니터링 설정
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('youtubei/v1/player') || url.includes('get_video_info')) {
        try {
          const data = await response.json();
          networkData.push({ url, data });
        } catch (e) {
          // JSON 파싱 실패는 무시
        }
      }
    });

    // 페이지 로드
    await page.goto(videoUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 네트워크 데이터에서 스트리밍 정보 추출
    for (const item of networkData) {
      if (item.data?.streamingData) {
        logger.info('🌐 Found streaming data via network monitoring');
        return {
          streamingData: item.data.streamingData,
          videoDetails: item.data.videoDetails,
          formats: [
            ...(item.data.streamingData.formats || []),
            ...(item.data.streamingData.adaptiveFormats || [])
          ]
        };
      }
    }

    throw new Error('No streaming data found in network requests');
  }

  // 🎮 YouTube Player API 활용
  private async extractViaPlayerAPI(videoUrl: string): Promise<JSExecutionResult> {
    // YouTube IFrame Player API를 사용한 추출 시도
    // 이 방법은 제한적이지만 일부 메타데이터는 추출 가능
    
    if (!realBrowserService['page']) {
      await realBrowserService.initializeBrowser();
    }

    const page = realBrowserService['page'];
    if (!page) throw new Error('Browser page not available');

    const videoId = this.extractVideoId(videoUrl);
    
    // YouTube Player API를 사용한 데이터 추출
    const result = await page.evaluate((videoId) => {
      return new Promise((resolve) => {
        // @ts-ignore - DOM context in Puppeteer
        // YouTube IFrame API 로드
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        // @ts-ignore - DOM context in Puppeteer
        document.head.appendChild(script);

        // @ts-ignore - DOM context in Puppeteer
        (window as any).onYouTubeIframeAPIReady = () => {
          // @ts-ignore - DOM context in Puppeteer
          const player = new (window as any).YT.Player('player', {
            height: '360',
            width: '640',
            videoId: videoId,
            events: {
              'onReady': (event: any) => {
                try {
                  const videoData = event.target.getVideoData();
                  const duration = event.target.getDuration();
                  
                  resolve({
                    videoDetails: {
                      videoId: videoData.video_id,
                      title: videoData.title,
                      author: videoData.author,
                      lengthSeconds: duration.toString()
                    }
                  });
                } catch (error) {
                  resolve({ error: error.message });
                }
              },
              'onError': (event: any) => {
                resolve({ error: `Player error: ${event.data}` });
              }
            }
          });
        };

        // 타임아웃 설정
        setTimeout(() => {
          resolve({ error: 'Player API timeout' });
        }, 10000);
      });
    }, videoId);

    return result as JSExecutionResult;
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/);
    return match ? match[1] : 'unknown';
  }
}

// 글로벌 JavaScript 실행 서비스
export const jsExecutionService = new JSExecutionService();
