import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { logger } from '../utils/logger';
import type { StorageUploadResult, StorageFileData } from '../types/storage';
import https from 'https';

// SSL 인증서 검증 비활성화 (Cloudflare R2 호환성)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Cloudflare R2 클라이언트 설정
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
  forcePathStyle: true,
  requestHandler: {
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      secureProtocol: 'TLS_method',
      keepAlive: true,
      maxSockets: 50,
      timeout: 60000
    })
  }
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET!;

// 파일을 R2에 업로드
export async function uploadToStorage(
  filePath: string, 
  taskId: string, 
  format: string
): Promise<StorageUploadResult> {
  try {
    const fileName = path.basename(filePath);
    const fileContent = await fs.readFile(filePath);
    const timestamp = new Date();
    
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `downloads/${taskId}/${fileName}`,
      Body: fileContent,
      ContentType: getContentType(format),
      Metadata: {
        taskId,
        uploadTime: timestamp.toString(),
        originalName: encodeURIComponent(fileName)
      },
    });

    await s3Client.send(uploadCommand);
    
    logger.info('File uploaded to R2 successfully', {
      taskId,
      fileName: fileName,
      bucket: BUCKET_NAME,
      key: `downloads/${taskId}/${fileName}`
    });

    return {
      success: true,
      key: `downloads/${taskId}/${fileName}`,
      fileName: fileName,
      uploadTime: timestamp
    };
  } catch (error) {
    logger.error('R2 upload failed', { 
      taskId, 
      filePath, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 다운로드 URL 생성
export async function generateDownloadUrl(key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 // 1시간
    });
    
    return signedUrl;
  } catch (error) {
    logger.error('Failed to generate download URL', { 
      key, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 파일 삭제
export async function deleteFromStorage(key: string): Promise<void> {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(deleteCommand);
    
    logger.info('File deleted from R2', { key });
  } catch (error) {
    logger.error('Failed to delete file from R2', { 
      key, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Content-Type 결정
function getContentType(format: string): string {
  const contentTypes: { [key: string]: string } = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'm4a': 'audio/mp4',
    'flac': 'audio/flac'
  };

  return contentTypes[format.toLowerCase()] || 'application/octet-stream';
}

// 스토리지 파일 정보 조회
export async function getStorageFileInfo(key: string): Promise<StorageFileData | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Metadata) {
      return null;
    }

    return {
      key,
      taskId: response.Metadata.taskId || '',
      fileName: response.Metadata.originalName ? decodeURIComponent(response.Metadata.originalName) : path.basename(key),
      uploadTime: response.Metadata.uploadTime ? new Date(response.Metadata.uploadTime) : new Date(),
      contentType: response.ContentType || 'application/octet-stream',
      size: response.ContentLength || 0
    };
  } catch (error) {
    logger.error('Failed to get storage file info', { 
      key, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}