// API configuration for connecting to the Python backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

interface UploadResponse {
  message: string;
  job_id: string;
  status: "processing";
  frame_stride: number;
}

interface UploadJobStatus {
  job_id: string;
  record_id: string;
  video_name: string;
  status: "processing" | "completed" | "failed";
  progress: number;
  frame_stride?: number;
  processed_frames?: number;
  total_frames?: number;
  total_person_count?: number;
  processed_video?: string;
  error?: string;
  started_at?: string;
  updated_at?: string;
  completed_at?: string;
}

interface AnalyticsData {
  total_videos: number;
  total_persons: number;
  total_processing_time_seconds?: number;
  active_cameras: number;
  todays_detections: number;
  hourly_analytics: { hour: string; detections: number; uploads: number }[];
  person_count_per_video: { video: string; count: number }[];
  recent_uploads: {
    id: string;
    videoName: string;
    uploadDate: string;
    personCount: number;
    status: "completed" | "processing" | "failed";
    processedVideo?: string;
    processingTimeSeconds?: number;
  }[];
}

interface VideoDetails {
  id: string;
  videoName: string;
  uploadDate: string;
  personCount: number;
  status: "completed" | "processing" | "failed";
  processedVideo: string;
  details: {
    fps?: number;
    total_frames?: number;
    duration_seconds?: number;
    peak_count?: number;
    counts_per_second?: { second: number; count: number }[];
  };
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function uploadVideo(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload-video`, {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.detail || `API Error: ${response.status} ${response.statusText}`);
  }

  return result as UploadResponse;
}

export async function getUploadJobStatus(jobId: string): Promise<UploadJobStatus> {
  const response = await apiRequest<UploadJobStatus>(`/api/jobs/${jobId}`);
  const data = response.data;
  if (data?.processed_video && !data.processed_video.startsWith("http")) {
    data.processed_video = `${API_BASE_URL}${data.processed_video}`;
  }
  return data;
}

export { API_BASE_URL };

export async function getAnalytics(): Promise<ApiResponse<AnalyticsData>> {
  return apiRequest<AnalyticsData>("/api/analytics");
}

export async function downloadReport(): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/report`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Failed to download report");
  }

  return response.blob();
}

export async function getVideoDetails(videoId: string): Promise<ApiResponse<VideoDetails>> {
  return apiRequest<VideoDetails>(`/api/videos/${videoId}`);
}

export async function deleteVideo(videoId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/videos/${videoId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete video");
  }
}

export type { ApiResponse, UploadResponse, UploadJobStatus, AnalyticsData, VideoDetails };
