import { logger } from '../utils/logger';
import { MediaInfo } from '../types/media';
import axios from 'axios';

// YouTube Data API v3 키들 (로테이션용)
const YOUTUBE_API_KEYS = [
  'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
  'AIzaSyC-dsYtDCSW-whIH_KiP0123HFaFdmuUBo',
  'AIzaSyD-8uuoiDx3GLUYhnpjgjL0321GcDvqUAo',
  'AIzaSyE-9vvpkEx4HMVYjnqkjM0432JdEwrVBp',
  'AIzaSyF-0wwqlFy5IMWZknrlkN0543KeFxsWCq'
];

let currentApiKeyIndex = 0;

interface YouTubeApiResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        high: { url: string };
        medium: { url: string };
        default: { url: string };
      };
      channelTitle: string;
      publishedAt: string;
    };
    contentDetails: {
      duration: string;
    };
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount: string;
    };
  }>;
}

// YouTube Data API v3를 사용한 메타데이터 수집
export async function getYouTubeMetadata(videoId: string): Promise<Partial<MediaInfo> | null> {
  try {
    logger.info(`Fetching YouTube metadata for video: ${videoId}`);
    
    const apiKey = getCurrentApiKey();
    const url = `https://www.googleapis.com/youtube/v3/videos`;
    
    const params = {
      part: 'snippet,contentDetails,statistics',
      id: videoId,
      key: apiKey
    };
    
    const response = await axios.get<YouTubeApiResponse>(url, { 
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const item = response.data.items[0];
      
      return {
        id: videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        uploader: item.snippet.channelTitle,
        upload_date: item.snippet.publishedAt.replace(/[-:]/g, '').split('T')[0],
        view_count: parseInt(item.statistics.viewCount) || 0,
        duration: parseDuration(item.contentDetails.duration),
        webpage_url: `https://www.youtube.com/watch?v=${videoId}`,
        extractor: 'youtube_api'
      };
    }
    
    return null;
  } catch (error: any) {
    logger.error(`YouTube API metadata fetch failed: ${error.message}`);
    
    // API 키 할당량 초과 시 다음 키로 로테이션
    if (error.response?.status === 403 || error.response?.status === 429) {
      rotateApiKey();
      logger.info('Rotated to next YouTube API key');
    }
    
    return null;
  }
}

// 하이브리드 YouTube 분석 (API + 고급 스크래핑)
export async function hybridYouTubeAnalysis(url: string, options: any): Promise<MediaInfo> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  logger.info(`Starting hybrid YouTube analysis for: ${videoId}`);
  
  try {
    // 1단계: YouTube Data API로 메타데이터 수집
    const metadata = await getYouTubeMetadata(videoId);
    
    // 2단계: 고급 스크래핑으로 스트림 URL 수집
    const streamData = await getStreamUrls(url, options, metadata);
    
    // 3단계: 메타데이터와 스트림 데이터 결합
    return combineMetadataAndStreams(metadata, streamData, url);
    
  } catch (error) {
    logger.error(`Hybrid YouTube analysis failed: ${error}`);
    throw error;
  }
}

// 고급 스트림 URL 추출 시스템
async function getStreamUrls(url: string, options: any, metadata: any): Promise<any> {
  logger.info('Extracting stream URLs with advanced techniques');
  
  // 다중 추출 방법 시도
  const extractionMethods = [
    () => extractWithBrowserEmulation(url, options),
    () => extractWithApiScraping(url, options),
    () => extractWithInnerTubeApi(url, options),
    () => extractWithEmbedScraping(url, options),
    () => extractWithMobileApi(url, options)
  ];
  
  for (const method of extractionMethods) {
    try {
      const result = await method();
      if (result && (result as any).formats && (result as any).formats.length > 0) {
        logger.info(`Successfully extracted streams using method: ${method.name}`);
        return result;
      }
    } catch (error) {
      logger.warn(`Extraction method failed: ${method.name}, error: ${error}`);
    }
  }
  
  throw new Error('All stream extraction methods failed');
}

// 브라우저 에뮬레이션을 통한 추출
async function extractWithBrowserEmulation(url: string, options: any) {
  logger.info('Attempting extraction with browser emulation');
  
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-download',
      '--cookies-from-browser', 'chrome',
      '--user-agent', `"${options.userAgent}"`,
      '--add-header', `X-Forwarded-For:${options.userIP}`,
      '--extractor-args', 'youtube:player_client=web,android',
      '--format', 'best[height<=1080]/best',
      url
    ];
    
    const process = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => stdout += data.toString());
    process.stderr.on('data', (data) => stderr += data.toString());
    
    process.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('{'));
          if (jsonLine) {
            resolve(JSON.parse(jsonLine));
          } else {
            reject(new Error('No valid JSON output'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`Browser emulation failed: ${stderr}`));
      }
    });
  });
}

// YouTube InnerTube API 직접 호출
async function extractWithInnerTubeApi(url: string, options: any) {
  logger.info('Attempting extraction with InnerTube API');
  
  const videoId = extractVideoId(url);
  const innerTubeUrl = 'https://www.youtube.com/youtubei/v1/player';
  
  const payload = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20231208.00.00',
        hl: 'en',
        gl: 'US'
      }
    },
    videoId: videoId,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: 'HTML5_PREF_WANTS'
      }
    }
  };
  
  try {
    const response = await axios.post(innerTubeUrl, payload, {
      params: { key: getCurrentApiKey() },
      headers: {
        'User-Agent': options.userAgent,
        'X-Forwarded-For': options.userIP,
        'Content-Type': 'application/json',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`
      },
      timeout: 15000
    });
    
    if (response.data.streamingData) {
      return {
        formats: [
          ...(response.data.streamingData.formats || []),
          ...(response.data.streamingData.adaptiveFormats || [])
        ]
      };
    }
    
    throw new Error('No streaming data in InnerTube response');
  } catch (error) {
    throw new Error(`InnerTube API failed: ${error}`);
  }
}

// 모바일 API 추출
async function extractWithMobileApi(url: string, options: any) {
  logger.info('Attempting extraction with mobile API');
  
  const videoId = extractVideoId(url);
  const mobileUrl = 'https://www.youtube.com/youtubei/v1/player';
  
  const payload = {
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '17.31.35',
        androidSdkVersion: 30,
        hl: 'en',
        gl: 'US'
      }
    },
    videoId: videoId
  };
  
  try {
    const response = await axios.post(mobileUrl, payload, {
      params: { key: getCurrentApiKey() },
      headers: {
        'User-Agent': 'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
        'X-Forwarded-For': options.userIP,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data.streamingData) {
      return {
        formats: [
          ...(response.data.streamingData.formats || []),
          ...(response.data.streamingData.adaptiveFormats || [])
        ]
      };
    }
    
    throw new Error('No streaming data in mobile API response');
  } catch (error) {
    throw new Error(`Mobile API failed: ${error}`);
  }
}

// API 스크래핑 (웹페이지 직접 분석)
async function extractWithApiScraping(url: string, options: any) {
  logger.info('Attempting extraction with API scraping');
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': options.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive'
      },
      timeout: 15000
    });
    
    const html = response.data;
    
    // ytInitialPlayerResponse 추출
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);
    if (playerResponseMatch) {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      
      if (playerResponse.streamingData) {
        return {
          formats: [
            ...(playerResponse.streamingData.formats || []),
            ...(playerResponse.streamingData.adaptiveFormats || [])
          ]
        };
      }
    }
    
    throw new Error('No player response found in HTML');
  } catch (error) {
    throw new Error(`API scraping failed: ${error}`);
  }
}

// 임베드 스크래핑
async function extractWithEmbedScraping(url: string, options: any) {
  logger.info('Attempting extraction with embed scraping');
  
  const videoId = extractVideoId(url);
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  
  try {
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': options.userAgent,
        'Referer': 'https://www.google.com/',
        'X-Forwarded-For': options.userIP
      },
      timeout: 15000
    });
    
    const html = response.data;
    const playerResponseMatch = html.match(/"player_response":"([^"]+)"/);
    
    if (playerResponseMatch) {
      const playerResponse = JSON.parse(decodeURIComponent(playerResponseMatch[1]));
      
      if (playerResponse.streamingData) {
        return {
          formats: [
            ...(playerResponse.streamingData.formats || []),
            ...(playerResponse.streamingData.adaptiveFormats || [])
          ]
        };
      }
    }
    
    throw new Error('No player response found in embed');
  } catch (error) {
    throw new Error(`Embed scraping failed: ${error}`);
  }
}

// 메타데이터와 스트림 데이터 결합
function combineMetadataAndStreams(metadata: any, streamData: any, url: string): MediaInfo {
  const videoId = extractVideoId(url);
  
  // 스트림 데이터 처리
  const formats = streamData.formats || [];
  
  const videoFormats = formats
    .filter((format: any) => format.vcodec && format.vcodec !== 'none')
    .map((format: any) => ({
      format_id: format.format_id || format.itag?.toString() || '',
      ext: format.ext || getExtensionFromMimeType(format.mimeType) || 'mp4',
      width: format.width || 0,
      height: format.height || 0,
      fps: format.fps || 0,
      vcodec: format.vcodec || '',
      acodec: format.acodec || '',
      filesize: format.filesize || format.contentLength || 0,
      quality: format.height || 0
    }));

  const audioFormats = formats
    .filter((format: any) => format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none'))
    .map((format: any) => ({
      format_id: format.format_id || format.itag?.toString() || '',
      ext: format.ext || getExtensionFromMimeType(format.mimeType) || 'm4a',
      acodec: format.acodec || '',
      abr: format.abr || format.bitrate || 0,
      asr: format.asr || format.sampleRate || 0,
      filesize: format.filesize || format.contentLength || 0,
      quality: format.abr || format.bitrate || 0
    }));

  return {
    id: videoId || 'unknown',
    title: metadata?.title || 'Unknown Title',
    duration: metadata?.duration || 0,
    thumbnail: metadata?.thumbnail || '',
    description: metadata?.description || '',
    uploader: metadata?.uploader || 'Unknown',
    upload_date: metadata?.upload_date || '',
    view_count: metadata?.view_count || 0,
    webpage_url: url,
    extractor: 'youtube_hybrid',
    video_formats: videoFormats,
    audio_formats: audioFormats,
    available_qualities: [...new Set(videoFormats.map(f => f.height).filter(h => h > 0))] as number[],
    available_audio_bitrates: [...new Set(audioFormats.map(f => f.abr).filter(b => b > 0))] as number[]
  };
}

// 유틸리티 함수들
function getCurrentApiKey(): string {
  return YOUTUBE_API_KEYS[currentApiKeyIndex];
}

function rotateApiKey(): void {
  currentApiKeyIndex = (currentApiKeyIndex + 1) % YOUTUBE_API_KEYS.length;
}

function extractVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

function getExtensionFromMimeType(mimeType: string): string {
  if (!mimeType) return 'mp4';
  
  const mimeMap: { [key: string]: string } = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3'
  };
  
  for (const [mime, ext] of Object.entries(mimeMap)) {
    if (mimeType.includes(mime)) {
      return ext;
    }
  }
  
  return 'mp4';
}
