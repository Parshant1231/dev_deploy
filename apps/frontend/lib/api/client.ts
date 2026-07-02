import axios, { AxiosError, AxiosInstance } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ─────────────────────────────────────────────
// AXIOS INSTANCE
// Centralizes base URL, headers, and interceptors.
// Every API call in the app goes through this instance.
// ─────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─────────────────────────────────────────────
// REQUEST INTERCEPTOR
// Attaches the JWT token to every outgoing request.
// This means individual API call functions never
// need to think about authentication headers.
// ─────────────────────────────────────────────

apiClient.interceptors.request.use((requestConfig) => {
  const token = Cookies.get('devdeploy_token');
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

// ─────────────────────────────────────────────
// RESPONSE INTERCEPTOR
// If the API returns 401 (token expired or invalid),
// clear the token so SWR re-evaluates and the
// middleware redirects on the next navigation.
// We intentionally do NOT hard-redirect here —
// window.location.href causes a reload loop when
// the user is already on /login or a public page.
// ─────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401) {
      Cookies.remove('devdeploy_token');
      // Only redirect to login if we're currently on a protected page.
      // Avoids a redirect loop on /login, /register, and the homepage.
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const isProtected = path.startsWith('/dashboard') || path.startsWith('/settings');
        if (isProtected) {
          window.location.href = '/login';
        }
      }
    }

    // Normalize the error message for consistent handling
    const message =
      error.response?.data?.error ?? error.message ?? 'An unexpected error occurred';

    return Promise.reject(new Error(message));
  }
);

export function setAuthToken(token: string): void {
  Cookies.set('devdeploy_token', token, {
    expires: 7,
    sameSite: 'strict',
  });
}

export function clearAuthToken(): void {
  Cookies.remove('devdeploy_token');
}

export function getAuthToken(): string | undefined {
  return Cookies.get('devdeploy_token');
}