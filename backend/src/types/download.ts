// 다운로드 관련 타입 정의

import type { TaskStatus, MediaType, ProgressUpdate } from './common';

export interface DownloadTask {
  id: string;
  url: string;
  mediaType: MediaType;
  formatType: string;
  quality: string;
  status: TaskStatus;
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
  updatedTime?: Date;
  language?: string;
  downloadUrl?: string;
  filename?: string;
  fileSize?: number;
  error?: string;
}

export interface DownloadRequest {
  url: string;
  mediaType: MediaType;
  formatType: string;
  quality: string;
  language?: string;
}

export interface DownloadResponse {
  success: boolean;
  task_id: string;
  message: string;
}

export interface TaskStatusResponse {
  success: boolean;
  status: TaskStatus;
  progress: number;
  message: string;
  downloadUrl?: string;
  filename?: string;
  fileSize?: number;
  estimatedTimeRemaining?: number;
}

export interface DownloadOptions {
  taskId: string;
  url: string;
  mediaType: MediaType;
  formatType: string;
  quality: string;
  language?: string;
  outputDir?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface DownloadProgress {
  taskId: string;
  percentage: number;
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
  status: TaskStatus;
  message: string;
}

export { ProgressUpdate, TaskStatus };