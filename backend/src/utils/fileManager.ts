// 파일 및 디렉토리 관리 유틸리티

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

// 필요한 디렉토리 생성
export async function initializeDirectories(): Promise<void> {
  const directories = [
    'logs',
    'temp',
    process.env.TEMP_DIR || '/tmp/hqmx'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(path.resolve(dir), { recursive: true });
      logger.debug(`Directory created/verified: ${dir}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error);
    }
  }
}

// 임시 파일 정리
export async function cleanupTempFiles(maxAgeHours: number = 24): Promise<number> {
  let cleanedCount = 0;
  const tempDir = process.env.TEMP_DIR || '/tmp/hqmx';
  const maxAge = maxAgeHours * 60 * 60 * 1000; // 밀리초로 변환

  try {
    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(tempDir, entry.name);
      
      try {
        const stats = await fs.stat(fullPath);
        const age = Date.now() - stats.mtime.getTime();
        
        if (age > maxAge) {
          if (entry.isDirectory()) {
            await fs.rmdir(fullPath, { recursive: true });
          } else {
            await fs.unlink(fullPath);
          }
          cleanedCount++;
          logger.debug(`Cleaned up old file/directory: ${fullPath}`);
        }
      } catch (error) {
        logger.warn(`Failed to clean up ${fullPath}:`, error);
      }
    }
    
    logger.info(`Cleaned up ${cleanedCount} old files/directories`);
    return cleanedCount;
    
  } catch (error) {
    logger.error('Failed to cleanup temp files:', error);
    return 0;
  }
}

// 파일 크기 확인
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    logger.error(`Failed to get file size for ${filePath}:`, error);
    return 0;
  }
}

// 파일 존재 여부 확인
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 디렉토리 생성 (필요시)
export async function ensureDirectory(dirPath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    logger.error(`Failed to create directory ${dirPath}:`, error);
    return false;
  }
}

// 파일 복사
export async function copyFile(source: string, destination: string): Promise<boolean> {
  try {
    await fs.copyFile(source, destination);
    return true;
  } catch (error) {
    logger.error(`Failed to copy file from ${source} to ${destination}:`, error);
    return false;
  }
}

// 파일 이동
export async function moveFile(source: string, destination: string): Promise<boolean> {
  try {
    await fs.rename(source, destination);
    return true;
  } catch (error) {
    logger.error(`Failed to move file from ${source} to ${destination}:`, error);
    return false;
  }
}

// 파일 삭제 (안전)
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const exists = await fileExists(filePath);
    if (!exists) {
      return true; // 이미 없으면 성공으로 간주
    }
    
    await fs.unlink(filePath);
    logger.debug(`File deleted: ${filePath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete file ${filePath}:`, error);
    return false;
  }
}

// 디렉토리 삭제 (재귀적)
export async function deleteDirectory(dirPath: string): Promise<boolean> {
  try {
    const exists = await fileExists(dirPath);
    if (!exists) {
      return true;
    }
    
    await fs.rmdir(dirPath, { recursive: true });
    logger.debug(`Directory deleted: ${dirPath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete directory ${dirPath}:`, error);
    return false;
  }
}

// 디스크 사용량 확인
export async function getDiskUsage(_path: string): Promise<{
  total: number;
  used: number;
  available: number;
} | null> {
  try {
    // Node.js에서는 직접적인 디스크 사용량 API가 없으므로
    // 시스템 명령어를 사용하거나 대안 방법 필요
    // 여기서는 기본 구조만 제공
    return {
      total: 0,
      used: 0,
      available: 0
    };
  } catch (error) {
    logger.error('Failed to get disk usage:', error);
    return null;
  }
}

// 파일 목록 조회 (필터링 옵션 포함)
export async function listFiles(
  dirPath: string, 
  options: {
    extensions?: string[];
    maxAge?: number;
    minSize?: number;
    maxSize?: number;
  } = {}
): Promise<Array<{
  name: string;
  path: string;
  size: number;
  mtime: Date;
  isDirectory: boolean;
}>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(fullPath);
      
      // 확장자 필터
      if (options.extensions && !entry.isDirectory()) {
        const ext = path.extname(entry.name).toLowerCase().slice(1);
        if (!options.extensions.includes(ext)) {
          continue;
        }
      }
      
      // 나이 필터
      if (options.maxAge) {
        const age = Date.now() - stats.mtime.getTime();
        if (age > options.maxAge * 60 * 60 * 1000) {
          continue;
        }
      }
      
      // 크기 필터
      if (options.minSize && stats.size < options.minSize) {
        continue;
      }
      if (options.maxSize && stats.size > options.maxSize) {
        continue;
      }
      
      results.push({
        name: entry.name,
        path: fullPath,
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: entry.isDirectory()
      });
    }
    
    return results;
  } catch (error) {
    logger.error(`Failed to list files in ${dirPath}:`, error);
    return [];
  }
}

// 임시 파일명 생성
export function generateTempFilename(extension: string = ''): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const ext = extension.startsWith('.') ? extension : (extension ? `.${extension}` : '');
  return `temp_${timestamp}_${random}${ext}`;
}

// 파일 크기를 읽기 쉬운 형태로 변환
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${size.toFixed(2)} ${sizes[i]}`;
}