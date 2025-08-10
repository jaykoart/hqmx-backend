import { logger } from '../utils/logger';
import { getInstagramSession, analyzeInstagramMedia } from './instagramService';
import { getRandomProxy } from '../utils/proxy';
import fs from 'fs/promises';

// URL 타입 감지
function detectUrlType(url: string): 'youtube' | 'instagram' | 'tiktok' | 'unknown' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  } else if (url.includes('instagram.com')) {
    return 'instagram';
  } else if (url.includes('tiktok.com')) {
    return 'tiktok';
  }
  return 'unknown';
}

// 미디어 분석 메인 함수
export async function analyzeMedia(url: string): Promise<any> {
  const urlType = detectUrlType(url);
  
  switch (urlType) {
    case 'instagram':
      return await analyzeInstagram(url);
    case 'youtube':
      return await analyzeYouTube(url);
    case 'tiktok':
      return await analyzeTikTok(url);
    default:
      throw new Error(`Unsupported URL type: ${urlType}`);
  }
}

// 인스타그램 분석
async function analyzeInstagram(url: string): Promise<any> {
  try {
    logger.info(`Starting Instagram analysis for: ${url}`);
    
    // 프록시 선택
    const proxy = getRandomProxy();
    
    // 인스타그램 자격증명 (환경변수에서)
    const instaUser = process.env.INSTA_USER;
    const instaPass = process.env.INSTA_PASS;
    
    // 인스타그램 세션 획득
    const session = await getInstagramSession(instaUser, instaPass, proxy);
    
    // 미디어 분석 수행
    const mediaInfo = await analyzeInstagramMedia(url, session);
    
    // 쿠키 파일 정리
    try {
      await fs.unlink(session.cookiePath);
      logger.info('Instagram cookie file cleaned up');
    } catch (e) {
      logger.debug('Failed to cleanup Instagram cookie file:', e);
    }
    
    return {
      ...mediaInfo,
      platform: 'instagram',
      analysisMethod: 'puppeteer'
    };
    
  } catch (error) {
    logger.error('Instagram analysis failed:', error);
    throw new Error(`Instagram analysis failed: ${error.message}`);
  }
}

// YouTube 분석 (기존 로직)
async function analyzeYouTube(url: string): Promise<any> {
  // 기존 YouTube 분석 로직 유지
  // YouTube Data API 또는 yt-dlp 사용
  return {
    platform: 'youtube',
    analysisMethod: 'api'
  };
}

// TikTok 분석 (기존 로직)
async function analyzeTikTok(url: string): Promise<any> {
  // 기존 TikTok 분석 로직 유지
  return {
    platform: 'tiktok',
    analysisMethod: 'puppeteer'
  };
}
