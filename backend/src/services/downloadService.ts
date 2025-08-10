import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { uploadToStorage } from './storageService';
import { getRedisClient } from '../utils/redis';
import { getSessionCookies } from './browserService';
import { getRandomProxy } from '../utils/proxy';
import type { DownloadTask, TaskStatus, ProgressUpdate } from '../types/download';

// 임시 쿠키 파일 생성
async function createTempCookieFile(cookies: string): Promise<string> {
  const cookiePath = path.join('/tmp', `client_cookies_${Date.now()}.txt`);
  await fs.writeFile(cookiePath, cookies, 'utf8');
  return cookiePath;
}

// 활성 다운로드 작업 저장소
const activeTasks = new Map<string, DownloadTask>();
const taskProgressCallbacks = new Map<string, ((progress: ProgressUpdate) => void)[]>();

// 다운로드 작업 시작
export async function downloadMedia(options: {
  taskId: string;
  url: string;
  mediaType: 'video' | 'audio';
  formatType: string;
  quality: string;
  language?: string;
  useClientIP?: boolean;
  clientIP?: string;
  clientUserAgent?: string;
  clientCookies?: string;
}): Promise<void> {
  const { 
    taskId, 
    url, 
    mediaType, 
    formatType, 
    quality, 
    language = 'en',
    useClientIP = false,
    clientIP,
    clientUserAgent,
    clientCookies
  } = options;
  
  const task: DownloadTask = {
    id: taskId,
    url,
    mediaType,
    formatType,
    quality,
    status: 'pending',
    progress: 0,
    message: 'Preparing download...',
    startTime: new Date(),
    language
  };

  activeTasks.set(taskId, task);
  await updateTaskStatus(taskId, task);

  try {
    logger.info(`Starting download task: ${taskId} with ${useClientIP ? 'client IP' : 'server proxy'}`);
    
    // 임시 디렉토리 생성
    const tempDir = path.join(process.env.TEMP_DIR || '/tmp/hqmx', taskId);
    await fs.mkdir(tempDir, { recursive: true });

    // 다운로드 진행상황 업데이트
    const updateProgress = (progress: number, message: string, status: TaskStatus = 'downloading') => {
      task.progress = progress;
      task.message = message;
      task.status = status;
      task.updatedTime = new Date();
      
      updateTaskStatus(taskId, task);
      notifyProgressCallbacks(taskId, { status, progress, message, percentage: progress });
    };

    updateProgress(5, 'Analyzing media...');

    let cookiePath: string | undefined;
    let userAgent: string | undefined;
    let proxy: string | undefined;

    if (useClientIP && clientUserAgent) {
      // 클라이언트 IP 사용
      userAgent = clientUserAgent;
      if (clientCookies) {
        cookiePath = await createTempCookieFile(clientCookies);
      }
      logger.info(`Using client IP: ${clientIP} for download`);
    } else {
      // 서버 프록시 사용 (기존 방식)
      proxy = getRandomProxy();
      try {
        updateProgress(10, 'Getting browser session...');
        // Puppeteer로 쿠키 + UA 확보
        const session = await getSessionCookies(url, proxy);
        cookiePath = session.cookiePath;
        userAgent = session.userAgent;
        logger.info(`Browser session obtained for ${url}`);
      } catch (err) {
        logger.warn('⚠️ Puppeteer 세션 쿠키 확보 실패. 쿠키 없이 진행:', err);
      }
    }

    updateProgress(15, 'Configuring download...');

    // yt-dlp 다운로드 옵션 구성 (쿠키/UA/프록시 포함)
    const ytDlpArgs = buildYtDlpArgs(mediaType, formatType, quality, tempDir, cookiePath, userAgent, proxy);
    
    updateProgress(20, 'Starting download...');

    // yt-dlp 실행
    const filePath = await executeDownload(url, ytDlpArgs, tempDir, updateProgress);
    
    updateProgress(90, 'Uploading to storage...');

    // 클라우드 스토리지에 업로드
    const uploadResult = await uploadToStorage(filePath, taskId, formatType);
    
    // 임시 파일 삭제
    await fs.unlink(filePath);
    await fs.rmdir(tempDir, { recursive: true });

    // 쿠키 파일 정리
    if (cookiePath) {
      try {
        await fs.unlink(cookiePath);
        logger.info(`🧹 쿠키 파일 삭제 완료: ${cookiePath}`);
      } catch (e) {
        logger.debug('쿠키 파일 삭제 오류:', e);
      }
    }

    // 작업 완료
    task.status = 'complete';
    task.progress = 100;
    task.message = 'Download completed successfully';
    task.updatedTime = new Date();
    await updateTaskStatus(taskId, task);
    
    logger.info(`Download task ${taskId} completed successfully`);

  } catch (error: any) {
    logger.error(`Download task ${taskId} failed:`, error);
    
    // 작업 실패
    task.status = 'error';
    task.message = `Download failed: ${error.message}`;
    task.updatedTime = new Date();
    await updateTaskStatus(taskId, task);
    
    throw error;
  }
}

// yt-dlp 인수 구성 (쿠키/UA/프록시 포함)
function buildYtDlpArgs(
  mediaType: string, 
  formatType: string, 
  quality: string, 
  outputDir: string,
  cookiePath?: string,
  userAgent?: string,
  proxy?: string
): string[] {
  const args = [
    '--no-playlist',
    '--no-flat-playlist',
    '--write-info-json',
    '--write-thumbnail',
    '--embed-metadata',
    '--add-metadata',
    `--output`, `${outputDir}/%(title)s.%(ext)s`
  ];

  // 쿠키 적용
  if (cookiePath) {
    args.push('--cookies', cookiePath);
  }

  // User-Agent 적용
  if (userAgent) {
    args.push('--user-agent', userAgent);
  }

  // 프록시 적용
  if (proxy) {
    args.push('--proxy', proxy);
  }

  // 추가 헤더 (봇 차단 방지)
  args.push('--no-check-certificate', '--ignore-errors');

  if (mediaType === 'video') {
    if (quality === 'best') {
      args.push('--format', 'best[ext=mp4]/best');
    } else {
      const height = parseInt(quality);
      args.push('--format', `best[height<=${height}][ext=${formatType}]/best[height<=${height}]/best`);
    }
    
    // 비디오 후처리
    if (formatType !== 'mp4') {
      args.push('--recode-video', formatType);
    }
  } else {
    // 오디오 다운로드
    args.push('--extract-audio');
    args.push('--audio-format', formatType);
    args.push('--audio-quality', quality);
    
    if (quality !== 'best') {
      args.push('--postprocessor-args', `ffmpeg:-b:a ${quality}k`);
    }
  }

  return args;
}

// yt-dlp 실행 및 진행상황 모니터링
async function executeDownload(
  url: string, 
  args: string[], 
  outputDir: string,
  onProgress: (progress: number, message: string) => void
): Promise<string> {
  
  return new Promise((resolve, reject) => {
    const ytDlp = spawn('yt-dlp', [...args, url], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let _outputBuffer = '';
    let errorBuffer = '';

    ytDlp.stdout.on('data', (data) => {
      _outputBuffer += data.toString();
      
      // 진행상황 파싱
      const progressMatch = data.toString().match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch) {
        const progress = Math.min(85, Math.max(10, parseFloat(progressMatch[1])));
        onProgress(progress, 'Downloading...');
      }
    });

    ytDlp.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorBuffer += chunk;
      
      // 경고는 무시하고 에러만 로깅
      if (!chunk.includes('WARNING')) {
        logger.warn('yt-dlp stderr:', chunk);
      }
    });

    ytDlp.on('close', async (code) => {
      if (code === 0) {
        try {
          // 다운로드된 파일 찾기
          const files = await fs.readdir(outputDir);
          const mediaFiles = files.filter(f => 
            !f.endsWith('.info.json') && 
            !f.endsWith('.jpg') && 
            !f.endsWith('.png') &&
            !f.endsWith('.webp')
          );

          if (mediaFiles.length > 0) {
            const filePath = path.join(outputDir, mediaFiles[0]);
            resolve(filePath);
          } else {
            reject(new Error('No media file found after download'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`yt-dlp failed with code ${code}: ${errorBuffer}`));
      }
    });

    ytDlp.on('error', (error) => {
      reject(new Error(`Failed to start yt-dlp: ${error.message}`));
    });
  });
}

// 작업 상태 업데이트
async function updateTaskStatus(taskId: string, task: DownloadTask): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setEx(`download:${taskId}`, 3600, JSON.stringify(task));
  } catch (error) {
    logger.error('Failed to update task status in Redis:', error);
  }
}

// 다운로드 상태 조회
export async function getDownloadStatus(taskId: string): Promise<DownloadTask | null> {
  // 메모리에서 먼저 확인
  const memoryTask = activeTasks.get(taskId);
  if (memoryTask) {
    return memoryTask;
  }

  // Redis에서 확인
  try {
    const redis = getRedisClient();
    const taskData = await redis.get(`download:${taskId}`);
    if (taskData) {
      return JSON.parse(taskData);
    }
  } catch (error) {
    logger.error('Failed to get task status from Redis:', error);
  }

  return null;
}

// 진행상황 콜백 등록
export function registerProgressCallback(taskId: string, callback: (progress: ProgressUpdate) => void): void {
  if (!taskProgressCallbacks.has(taskId)) {
    taskProgressCallbacks.set(taskId, []);
  }
  taskProgressCallbacks.get(taskId)!.push(callback);
}

// 진행상황 콜백 호출
function notifyProgressCallbacks(taskId: string, progress: ProgressUpdate): void {
  const callbacks = taskProgressCallbacks.get(taskId);
  if (callbacks) {
    callbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        logger.error('Progress callback error:', error);
      }
    });
  }
}

// 완료된 작업 정리
export async function cleanupCompletedTasks(): Promise<void> {
  const now = new Date();
  const completedTasks = Array.from(activeTasks.values()).filter(task => 
    task.status === 'complete' || task.status === 'error'
  );

  for (const task of completedTasks) {
    const timeDiff = now.getTime() - task.endTime!.getTime();
    if (timeDiff > 3600000) { // 1시간 후 정리
      activeTasks.delete(task.id);
      taskProgressCallbacks.delete(task.id);
    }
  }
}