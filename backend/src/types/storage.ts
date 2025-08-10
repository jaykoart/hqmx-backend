// 저장소 관련 타입 정의

export interface StorageUploadResult {
  url: string;
  key: string;
  filename: string;
  size: number;
  contentType: string;
  uploadTime: Date;
}

export interface StorageFileData {
  stream: NodeJS.ReadableStream;
  filename: string;
  contentType: string;
  size: number;
}

export interface StorageConfig {
  provider: 'r2' | 's3' | 'local';
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl?: string;
}

export interface FileMetadata {
  taskId: string;
  originalName: string;
  size: number;
  contentType: string;
  uploadTime: Date;
  downloadCount?: number;
  expiresAt?: Date;
}

export interface StorageQuota {
  used: number;
  total: number;
  available: number;
  files: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}