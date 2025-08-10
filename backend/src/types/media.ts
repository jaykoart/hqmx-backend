// 미디어 관련 타입 정의

export interface VideoFormat {
  format_id: string;
  ext: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;  // total bitrate
  vbr?: number;  // video bitrate
  abr?: number;  // audio bitrate
  filesize?: number;
  filesize_approx?: number;
  quality?: number;
}

export interface AudioFormat {
  format_id: string;
  ext: string;
  acodec?: string;
  abr?: number;  // audio bitrate
  asr?: number;  // audio sample rate
  filesize?: number;
  filesize_approx?: number;
  quality?: number;
}

export interface MediaInfo {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  view_count?: number;
  uploader?: string;
  upload_date?: string;
  webpage_url: string;
  extractor: string;
  video_formats: VideoFormat[];
  audio_formats: AudioFormat[];
  available_qualities: number[];
  available_audio_bitrates: number[];
}

export interface MediaAnalysisRequest {
  url: string;
  language?: string;
}

export interface QualityRecommendation {
  video: {
    quality: string;
    format: string;
  };
  audio: {
    quality: string;
    format: string;
  };
}

export interface SupportedPlatform {
  name: string;
  domains: string[];
  features: {
    video: boolean;
    audio: boolean;
    playlist: boolean;
    liveStream: boolean;
  };
}