/**
 * Configuration for connecting to the backend API
 */

// Backend API URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// API endpoints
export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  detectVideo: `${API_BASE_URL}/api/detect-video`,
  processVideo: `${API_BASE_URL}/api/process-video`,
  downloadVideo: `${API_BASE_URL}/api/download-video`,
  progress: (sessionId: string) => `${API_BASE_URL}/api/progress/${sessionId}`,
  reorderMoments: (sessionId: string) => `${API_BASE_URL}/api/sessions/${sessionId}/moments`,
  deleteSession: (sessionId: string) => `${API_BASE_URL}/api/sessions/${sessionId}`,
};

// Default settings
export const DEFAULT_SETTINGS = {
  duration: 30,
  quality: '720p',
  autoDetect: true,
};
