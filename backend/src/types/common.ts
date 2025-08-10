// 공통 타입 정의

export type TaskStatus = 'pending' | 'downloading' | 'processing' | 'uploading' | 'complete' | 'error' | 'cancelled';
export type MediaType = 'video' | 'audio';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface ErrorDetails {
  code?: string;
  message: string;
  stack?: string;
  timestamp: Date;
  requestId?: string;
}

export interface ProgressUpdate {
  status: TaskStatus;
  progress: number;
  message: string;
  percentage: number;
  estimatedTimeRemaining?: number;
}