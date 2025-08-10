import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { logger } from '../utils/logger';
import type { StorageUploadResult, StorageFileData } from '../types/storage';

// Cloudflare R2 클라이언트 설정
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// 파일을 R2에 업로드
export async function uploadToStorage(
  filePath: string, 
  taskId: string, 
  format: string
): Promise<StorageUploadResult> {
  try {
    const fileStats = await fs.stat(filePath);
    const fileStream = createReadStream(filePath);
    const fileName = path.basename(filePath);
    const sanitizedName = sanitizeFilename(fileName);
    const timestamp = Date.now();
    
    // R2 키 생성 (날짜별 폴더 구조)
    const date = new Date().toISOString().split('T')[0];
    const objectKey = `downloads/${date}/${taskId}/${sanitizedName}`;
    
    // 콘텐츠 타입 결정
    const contentType = getContentType(format);
    
    logger.info(`Uploading file to R2: ${objectKey}`);

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: fileStream,
      ContentType: contentType,
      ContentLength: fileStats.size,
      Metadata: {
        taskId,
        uploadTime: timestamp.toString(),
        originalName: fileName
      },
      // 24시간 후 자동 삭제 (R2 Lifecycle 규칙 설정 필요)
      Expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    await s3Client.send(uploadCommand);

    // 다운로드 URL 생성 (24시간 유효)
    const downloadUrl = await generateDownloadUrl(objectKey, sanitizedName);

    const result: StorageUploadResult = {
      url: downloadUrl,
      key: objectKey,
      filename: sanitizedName,
      size: fileStats.size,
      contentType,
      uploadTime: new Date(timestamp)
    };

    logger.info(`File uploaded successfully: ${objectKey} (${fileStats.size} bytes)`);
    return result;

  } catch (error: any) {
    logger.error('Failed to upload file to storage:', error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

// R2에서 파일 다운로드
export async function getFileFromStorage(taskId: string): Promise<StorageFileData | null> {
  try {
    // taskId로 파일 찾기 (실제로는 메타데이터나 데이터베이스에서 조회)
    const objectKey = await findFileByTaskId(taskId);
    
    if (!objectKey) {
      logger.warn(`File not found for task: ${taskId}`);
      return null;
    }

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey
    });

    const response = await s3Client.send(getCommand);
    
    if (!response.Body) {
      return null;
    }

    const filename = path.basename(objectKey);
    
    return {
      stream: response.Body as NodeJS.ReadableStream,
      filename,
      contentType: response.ContentType || 'application/octet-stream',
      size: response.ContentLength || 0
    };

  } catch (error: any) {
    logger.error('Failed to get file from storage:', error);
    return null;
  }
}

// 파일 삭제
export async function deleteFileFromStorage(objectKey: string): Promise<boolean> {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey
    });

    await s3Client.send(deleteCommand);
    logger.info(`File deleted from storage: ${objectKey}`);
    return true;

  } catch (error: any) {
    logger.error('Failed to delete file from storage:', error);
    return false;
  }
}

// 다운로드 URL 생성 (24시간 유효)
async function generateDownloadUrl(objectKey: string, filename: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${filename}"`
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 24 * 60 * 60 // 24시간
    });

    return signedUrl;

  } catch (error: any) {
    logger.error('Failed to generate download URL:', error);
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }
}

// TaskId로 파일 키 찾기
async function findFileByTaskId(taskId: string): Promise<string | null> {
  // 실제 구현에서는 데이터베이스나 Redis에서 조회
  // 현재는 간단한 패턴 매칭으로 구현
  try {
    const date = new Date().toISOString().split('T')[0];
    const prefix = `downloads/${date}/${taskId}/`;
    
    // 실제로는 ListObjectsV2Command를 사용하여 파일 검색
    // 여기서는 예시로 직접 경로 구성
    return `${prefix}output.mp4`; // 실제 파일명으로 대체 필요
    
  } catch (error) {
    logger.error('Failed to find file by taskId:', error);
    return null;
  }
}

// 파일명 정리
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9가-힣.\-_\s]/g, '') // 특수문자 제거
    .replace(/\s+/g, '_') // 공백을 언더스코어로
    .substring(0, 200) // 길이 제한
    .trim();
}

// 콘텐츠 타입 결정
function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    // 비디오 포맷
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'flv': 'video/x-flv',
    
    // 오디오 포맷
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'wma': 'audio/x-ms-wma'
  };

  return contentTypes[format.toLowerCase()] || 'application/octet-stream';
}

// 저장소 상태 확인
export async function checkStorageHealth(): Promise<boolean> {
  try {
    // 간단한 헬스체크 - 버킷 접근 테스트
    const testKey = `health-check/${Date.now()}.txt`;
    const testContent = 'health check';
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    });

    await s3Client.send(putCommand);
    
    // 테스트 파일 삭제
    await deleteFileFromStorage(testKey);
    
    return true;
  } catch (error) {
    logger.error('Storage health check failed:', error);
    return false;
  }
}

// 스토리지 사용량 모니터링 (필요시 구현)
export async function getStorageUsage(): Promise<{ totalSize: number; fileCount: number }> {
  // R2는 무제한이지만 모니터링을 위한 함수
  return {
    totalSize: 0,
    fileCount: 0
  };
}