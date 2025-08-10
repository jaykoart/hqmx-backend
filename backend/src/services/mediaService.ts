import { exec } from 'child_process';
import { promisify } from 'util';
// import path from 'path';
// import fs from 'fs/promises';
import { logger } from '../utils/logger';
import type { MediaInfo, VideoFormat, AudioFormat } from '../types/media';

const execAsync = promisify(exec);

// yt-dlp 실행 함수
async function executeYtDlp(url: string, args: string[] = []): Promise<string> {
  const command = `yt-dlp ${args.join(' ')} "${url}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30초 타임아웃
      maxBuffer: 1024 * 1024 * 10 // 10MB 버퍼
    });
    
    if (stderr && !stderr.includes('WARNING')) {
      logger.warn('yt-dlp stderr:', stderr);
    }
    
    return stdout;
  } catch (error: any) {
    logger.error('yt-dlp execution failed:', error);
    throw new Error(`Failed to process URL: ${error.message}`);
  }
}

// 미디어 정보 분석 (사용자 IP 사용)
export async function analyzeMedia(url: string, _language: string = 'en', userIP?: string, userInfo?: any): Promise<MediaInfo> {
  try {
    logger.info(`Analyzing media info for URL: ${url} with user IP: ${userIP}`);

    // 사용자 IP와 브라우저 정보를 사용하여 분석
    const ytDlpArgs = [
      '--dump-json',
      '--no-download',
      '--flat-playlist',
      '--ignore-errors',
      '--extractor-args', 'youtube:player_client=web'
    ];

    // 사용자 정보가 있으면 User-Agent 설정, 없으면 기본값 사용
    if (userInfo && userInfo.userAgent) {
      ytDlpArgs.push('--user-agent', `"${userInfo.userAgent}"`);
    } else {
      ytDlpArgs.push('--user-agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"');
    }

    // yt-dlp로 메타데이터 추출 (사용자 IP 사용)
    const jsonOutput = await executeYtDlp(url, ytDlpArgs);

    const lines = jsonOutput.trim().split('\n');
    const mediaData = JSON.parse(lines[0]); // 첫 번째 항목만 사용

    // 비디오 포맷 정보 추출
    const videoFormats: VideoFormat[] = (mediaData.formats || [])
      .filter((f: any) => f.vcodec && f.vcodec !== 'none')
      .map((f: any) => ({
        format_id: f.format_id,
        ext: f.ext,
        width: f.width,
        height: f.height,
        fps: f.fps,
        vcodec: f.vcodec,
        acodec: f.acodec,
        tbr: f.tbr,
        vbr: f.vbr,
        abr: f.abr,
        filesize: f.filesize,
        filesize_approx: f.filesize_approx,
        quality: f.quality
      }))
      .sort((a: VideoFormat, b: VideoFormat) => (b.height || 0) - (a.height || 0));

    // 오디오 포맷 정보 추출
    const audioFormats: AudioFormat[] = (mediaData.formats || [])
      .filter((f: any) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
      .map((f: any) => ({
        format_id: f.format_id,
        ext: f.ext,
        acodec: f.acodec,
        abr: f.abr,
        asr: f.asr,
        filesize: f.filesize,
        filesize_approx: f.filesize_approx,
        quality: f.quality
      }))
      .sort((a: AudioFormat, b: AudioFormat) => (b.abr || 0) - (a.abr || 0));

    const mediaInfo: MediaInfo = {
      id: mediaData.id,
      title: mediaData.title || 'Unknown Title',
      description: mediaData.description,
      thumbnail: mediaData.thumbnail,
      duration: mediaData.duration,
      view_count: mediaData.view_count,
      uploader: mediaData.uploader,
      upload_date: mediaData.upload_date,
      webpage_url: mediaData.webpage_url,
      extractor: mediaData.extractor,
      video_formats: videoFormats,
      audio_formats: audioFormats,
      available_qualities: [...new Set(videoFormats.map(f => f.height).filter(h => h))].sort((a, b) => (b || 0) - (a || 0)),
      available_audio_bitrates: [...new Set(audioFormats.map(f => f.abr).filter(b => b))].sort((a, b) => (b || 0) - (a || 0))
    };

    logger.info(`Successfully analyzed media: ${mediaInfo.title}`);
    return mediaInfo;

  } catch (error: any) {
    logger.error('Media analysis failed:', error);
    throw new Error(`Failed to analyze media: ${error.message}`);
  }
}

// 지원되는 사이트 확인
export async function getSupportedSites(): Promise<string[]> {
  try {
    const output = await executeYtDlp('', ['--list-extractors']);
    return output.split('\n').filter(line => line.trim().length > 0);
  } catch (error) {
    logger.error('Failed to get supported sites:', error);
    return [];
  }
}

// URL 유효성 및 지원 여부 확인
export async function validateMediaUrl(url: string): Promise<boolean> {
  try {
    // 빠른 검증을 위해 시뮬레이션 모드 사용
    await executeYtDlp(url, ['--simulate', '--quiet']);
    return true;
  } catch (error) {
    logger.warn(`URL validation failed for: ${url}`, error);
    return false;
  }
}

// 최적 포맷 추천
export function recommendFormats(mediaInfo: MediaInfo) {
  const recommendations = {
    video: {
      quality: 'best',
      format: 'mp4'
    },
    audio: {
      quality: '192',
      format: 'mp3'
    }
  };

  // 비디오 추천
  if (mediaInfo.video_formats.length > 0) {
    // H.264 코덱이 있는 최고 품질 추천
    const h264Formats = mediaInfo.video_formats.filter(f => 
      f.vcodec?.startsWith('avc1') && f.height
    );
    
    if (h264Formats.length > 0) {
      const bestH264 = h264Formats.reduce((best, current) => 
        (current.height || 0) > (best.height || 0) ? current : best
      );
      recommendations.video.quality = bestH264.height?.toString() || 'best';
    }
  }

  // 오디오 추천
  if (mediaInfo.audio_formats.length > 0) {
    const bestAudio = mediaInfo.audio_formats[0]; // 이미 정렬되어 있음
    recommendations.audio.quality = bestAudio.abr?.toString() || '192';
    
    // MP3 우선, 없으면 M4A
    const hasMP3 = mediaInfo.audio_formats.some(f => f.ext === 'mp3');
    const hasM4A = mediaInfo.audio_formats.some(f => f.ext === 'm4a');
    
    if (hasMP3) {
      recommendations.audio.format = 'mp3';
    } else if (hasM4A) {
      recommendations.audio.format = 'm4a';
    }
  }

  return recommendations;
}