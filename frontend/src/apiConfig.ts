const backendBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:10000';
export const BACKEND_BASE_URL = backendBaseUrl.replace(/\/$/, '');
export const API_BASE_URL = `${BACKEND_BASE_URL}/api`;
