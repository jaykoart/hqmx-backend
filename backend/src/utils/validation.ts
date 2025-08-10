// URL 및 입력 검증 유틸리티

import { logger } from './logger';

// 지원되는 도메인 패턴
const SUPPORTED_DOMAINS = [
  // YouTube
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)/,
  // Social Media
  /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|instagram\.com|tiktok\.com)/,
  // Video Platforms
  /^(https?:\/\/)?(www\.)?(vimeo\.com|dailymotion\.com|twitch\.tv)/,
  // Audio Platforms
  /^(https?:\/\/)?(www\.)?(soundcloud\.com|spotify\.com)/,
  // Other platforms
  /^(https?:\/\/)?(www\.)?(reddit\.com|x\.com|twitter\.com)/,
  // Chinese platforms
  /^(https?:\/\/)?(www\.)?(bilibili\.com|xiaohongshu\.com)/
];

// URL 유효성 검사
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    // 기본 URL 형식 검사
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    
    // 프로토콜 검사
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }

    // 지원되는 도메인 검사
    const isSupported = SUPPORTED_DOMAINS.some(pattern => 
      pattern.test(url.toLowerCase())
    );

    if (!isSupported) {
      logger.warn(`Unsupported domain: ${urlObj.hostname}`);
    }

    return isSupported;

  } catch (error) {
    logger.warn(`Invalid URL format: ${url}`);
    return false;
  }
}

// 미디어 타입 검증
export function validateMediaType(mediaType: string): mediaType is 'video' | 'audio' {
  return ['video', 'audio'].includes(mediaType);
}

// 포맷 검증
export function validateFormat(formatType: string, mediaType: 'video' | 'audio'): boolean {
  const videoFormats = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv'];
  const audioFormats = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus'];

  if (mediaType === 'video') {
    return videoFormats.includes(formatType.toLowerCase());
  } else {
    return audioFormats.includes(formatType.toLowerCase());
  }
}

// 품질 설정 검증
export function validateQuality(quality: string, mediaType: 'video' | 'audio'): boolean {
  if (mediaType === 'video') {
    // 비디오 품질: 'best' 또는 해상도 숫자
    if (quality === 'best') return true;
    const resolution = parseInt(quality);
    return !isNaN(resolution) && resolution >= 144 && resolution <= 8192;
  } else {
    // 오디오 품질: 비트레이트 숫자
    if (quality === 'best') return true;
    const bitrate = parseInt(quality);
    return !isNaN(bitrate) && bitrate >= 32 && bitrate <= 320;
  }
}

// 파일명 검증 및 정리
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Windows 금지 문자
    .replace(/[\x00-\x1f\x80-\x9f]/g, '') // 제어 문자
    .replace(/^\.+/, '') // 시작하는 점 제거
    .replace(/\.+$/, '') // 끝나는 점 제거
    .replace(/\s+/g, '_') // 공백을 언더스코어로
    .substring(0, 200) // 길이 제한
    .trim();
}

// Task ID 검증
export function validateTaskId(taskId: string): boolean {
  if (!taskId || typeof taskId !== 'string') {
    return false;
  }
  
  // UUID v4 형식 검증
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(taskId);
}

// 언어 코드 검증
export function validateLanguage(lang: string): boolean {
  const supportedLanguages = [
    'en', 'ko', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'it', 'pt',
    'ru', 'ar', 'hi', 'th', 'vi', 'id', 'ms', 'fil', 'my', 'bn', 'tr'
  ];
  
  return supportedLanguages.includes(lang);
}

// 파일 크기 검증
export function validateFileSize(size: number): boolean {
  const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '2147483648'); // 2GB
  return size > 0 && size <= MAX_FILE_SIZE;
}

// IP 주소 검증 (레이트 리미팅용)
export function validateIP(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// 요청 본문 검증
export function validateDownloadRequest(body: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!body.url || typeof body.url !== 'string') {
    errors.push('URL is required and must be a string');
  } else if (!validateUrl(body.url)) {
    errors.push('Invalid or unsupported URL');
  }

  if (!body.mediaType || typeof body.mediaType !== 'string') {
    errors.push('Media type is required');
  } else if (!validateMediaType(body.mediaType)) {
    errors.push('Invalid media type (must be video or audio)');
  }

  if (!body.formatType || typeof body.formatType !== 'string') {
    errors.push('Format type is required');
  } else if (body.mediaType && !validateFormat(body.formatType, body.mediaType)) {
    errors.push('Invalid format type for the specified media type');
  }

  if (!body.quality || typeof body.quality !== 'string') {
    errors.push('Quality is required');
  } else if (body.mediaType && !validateQuality(body.quality, body.mediaType)) {
    errors.push('Invalid quality setting for the specified media type');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// 헤더 검증 (언어 등)
export function validateHeaders(headers: any): {
  language: string;
  userAgent: string;
} {
  const language = headers['accept-language'] || 'en';
  const normalizedLang = language.split(',')[0].split('-')[0].toLowerCase();
  
  return {
    language: validateLanguage(normalizedLang) ? normalizedLang : 'en',
    userAgent: headers['user-agent'] || 'Unknown'
  };
}