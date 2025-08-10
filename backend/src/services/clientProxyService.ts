import { logger } from '../utils/logger';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface ClientProxyOptions {
  userIp: string;
  userAgent: string;
  cookies?: string;
  proxyEnabled: boolean;
  clientInfo?: any;
}

// 클라이언트 IP를 통한 분석/다운로드
export async function analyzeWithClientIP(
  url: string, 
  options: ClientProxyOptions
): Promise<any> {
  const { userIp, userAgent, cookies, proxyEnabled } = options;
  
  try {
    logger.info(`Starting analysis with client IP: ${userIp} for URL: ${url}`);
    
    // 클라이언트 브라우저에서 직접 분석 수행
    return await analyzeWithClientBrowser(url, userAgent, cookies);
    
  } catch (error) {
    logger.error('Client IP analysis failed:', error);
    throw error;
  }
}

// 클라이언트 브라우저에서 직접 분석
async function analyzeWithClientBrowser(
  url: string, 
  userAgent: string, 
  cookies?: string
): Promise<any> {
  logger.info(`Analyzing with client browser for URL: ${url}`);
  
  // 클라이언트 브라우저 정보를 포함한 분석 요청
  const analysisData = {
    url,
    userAgent,
    cookies,
    timestamp: Date.now(),
    clientAnalysis: true
  };
  
  // 클라이언트 브라우저 환경에서 분석을 수행하는 프록시 엔드포인트 호출
  return await performClientSideAnalysis(analysisData);
}

// 클라이언트 사이드 분석 수행
async function performClientSideAnalysis(data: any): Promise<any> {
  // 클라이언트 브라우저 환경에서 실행될 분석 로직
  // 실제로는 프론트엔드에서 실행되어야 함
  logger.info('Performing client-side analysis...');
  
  // 임시로 서버 사이드 분석 결과를 반환
  // 실제 구현에서는 클라이언트 브라우저에서 직접 요청을 보냄
  const { analyzeMedia } = await import('./mediaService');
  return await analyzeMedia(data.url, 'en');
}

// 클라이언트 IP로 직접 분석 (기존 방식)
async function analyzeWithDirectIP(
  url: string, 
  userAgent: string, 
  cookies?: string
): Promise<any> {
  // yt-dlp를 사용하여 클라이언트 IP로 직접 분석
  const args = [
    '--no-playlist',
    '--write-info-json',
    '--write-thumbnail',
    '--skip-download', // 다운로드 없이 정보만 추출
    '--user-agent', '"Mozilla/5.0 Windows NT 10.0 Win64 x64 AppleWebKit/537.36"',
    '--no-check-certificate',
    '--ignore-errors',
    '--extractor-args', 'youtube:player_client=web'
  ];

  if (cookies) {
    const cookiePath = await createTempCookieFile(cookies);
    args.push('--cookies', cookiePath);
  }

  return new Promise((resolve, reject) => {
    const ytDlp = spawn('yt-dlp', [...args, url], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    ytDlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      error += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        try {
          // JSON 정보 파일 파싱
          const infoMatch = output.match(/Writing video metadata to: (.+\.json)/);
          if (infoMatch) {
            const infoPath = infoMatch[1];
            resolve(parseMediaInfo(infoPath));
          } else {
            resolve({ status: 'success', message: 'Analysis completed' });
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse analysis result: ${parseError.message}`));
        }
      } else {
        reject(new Error(`Analysis failed with code ${code}: ${error}`));
      }
    });
  });
}

// 서버 프록시를 통한 분석 (fallback)
async function analyzeWithServerProxy(
  url: string, 
  userAgent: string, 
  cookies?: string
): Promise<any> {
  // 기존 서버 기반 분석 로직 사용
  logger.info('Using server proxy for analysis');
  
  // 기존 mediaService의 analyzeMedia 함수 사용
  const { analyzeMedia } = await import('./mediaService');
  return await analyzeMedia(url, 'en');
}

// 임시 쿠키 파일 생성
async function createTempCookieFile(cookies: string): Promise<string> {
  const cookiePath = path.join('/tmp', `client_cookies_${Date.now()}.txt`);
  await fs.writeFile(cookiePath, cookies, 'utf8');
  return cookiePath;
}

// 미디어 정보 파싱
async function parseMediaInfo(infoPath: string): Promise<any> {
  try {
    const infoContent = await fs.readFile(infoPath, 'utf8');
    const mediaInfo = JSON.parse(infoContent);
    
    // 임시 파일 정리
    await fs.unlink(infoPath);
    
    return {
      title: mediaInfo.title,
      duration: mediaInfo.duration,
      formats: mediaInfo.formats,
      thumbnail: mediaInfo.thumbnail,
      uploader: mediaInfo.uploader,
      view_count: mediaInfo.view_count,
      like_count: mediaInfo.like_count,
      method: 'client-direct'
    };
  } catch (error) {
    logger.error('Failed to parse media info:', error);
    throw error;
  }
}

// 클라이언트 IP를 통한 다운로드
export async function downloadWithClientIP(
  url: string,
  options: ClientProxyOptions,
  downloadOptions: {
    mediaType: 'video' | 'audio';
    formatType: string;
    quality: string;
  }
): Promise<string> {
  const { userIp, userAgent, cookies, proxyEnabled } = options;
  
  try {
    logger.info(`Starting download with client IP: ${userIp} for URL: ${url}`);
    
    if (proxyEnabled) {
      return await downloadWithDirectIP(url, userAgent, cookies, downloadOptions);
    } else {
      return await downloadWithServerProxy(url, userAgent, cookies, downloadOptions);
    }
    
  } catch (error) {
    logger.error('Client IP download failed:', error);
    throw error;
  }
}

// 클라이언트 IP로 직접 다운로드
async function downloadWithDirectIP(
  url: string,
  userAgent: string,
  cookies: string | undefined,
  downloadOptions: any
): Promise<string> {
  const tempDir = path.join('/tmp', `client_download_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  const args = [
    '--no-playlist',
    '--write-info-json',
    '--write-thumbnail',
    '--embed-metadata',
    '--add-metadata',
    '--user-agent', userAgent,
    '--no-check-certificate',
    '--ignore-errors',
    `--output`, `${tempDir}/%(title)s.%(ext)s`
  ];

  if (cookies) {
    const cookiePath = await createTempCookieFile(cookies);
    args.push('--cookies', cookiePath);
  }

  // 다운로드 옵션 적용
  if (downloadOptions.mediaType === 'video') {
    if (downloadOptions.quality === 'best') {
      args.push('--format', 'best[ext=mp4]/best');
    } else {
      const height = parseInt(downloadOptions.quality);
      args.push('--format', `best[height<=${height}][ext=${downloadOptions.formatType}]/best[height<=${height}]/best`);
    }
  } else {
    args.push('--extract-audio');
    args.push('--audio-format', downloadOptions.formatType);
    args.push('--audio-quality', downloadOptions.quality);
  }

  return new Promise((resolve, reject) => {
    const ytDlp = spawn('yt-dlp', [...args, url], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let error = '';

    ytDlp.stderr.on('data', (data) => {
      error += data.toString();
    });

    ytDlp.on('close', async (code) => {
      if (code === 0) {
        try {
          // 다운로드된 파일 찾기
          const files = await fs.readdir(tempDir);
          const mediaFile = files.find(file => 
            !file.endsWith('.json') && !file.endsWith('.webp')
          );
          
          if (mediaFile) {
            const filePath = path.join(tempDir, mediaFile);
            resolve(filePath);
          } else {
            reject(new Error('No media file found after download'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`Download failed with code ${code}: ${error}`));
      }
    });
  });
}

// 서버 프록시를 통한 다운로드 (fallback)
async function downloadWithServerProxy(
  url: string,
  userAgent: string,
  cookies: string | undefined,
  downloadOptions: any
): Promise<string> {
  // 기존 서버 기반 다운로드 로직 사용
  logger.info('Using server proxy for download');
  
  // 기존 downloadService의 downloadMedia 함수 사용
  const { downloadMedia } = await import('./downloadService');
  
  const taskId = `server_proxy_${Date.now()}`;
  
  return new Promise((resolve, reject) => {
    downloadMedia({
      taskId,
      url,
      mediaType: downloadOptions.mediaType,
      formatType: downloadOptions.formatType,
      quality: downloadOptions.quality,
      language: 'en'
    }).then(() => {
      // 다운로드 완료 후 파일 경로 반환
      resolve(`/tmp/hqmx/${taskId}`);
    }).catch(reject);
  });
}
