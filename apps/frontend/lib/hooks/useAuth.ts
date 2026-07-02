'use client';

import useSWR from 'swr';
import { authApi } from '@/lib/api/auth';
import { setAuthToken, clearAuthToken, getAuthToken } from '@/lib/api/client';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────
// useAuth Hook
//
// Wraps SWR to fetch and cache the current user.
// Only calls GET /auth/me when a token cookie exists —
// prevents a 401 loop on public pages (/, /login, /register)
// where there is no token yet.
// ─────────────────────────────────────────────

export function useAuth() {
  const router = useRouter();

  const { data: user, error, isLoading, mutate } = useSWR(
    // Key is null when there's no token → SWR skips the fetch entirely
    () => (getAuthToken() ? 'auth/me' : null),
    () => authApi.getMe(),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    }
  );

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    setAuthToken(result.token);
    await mutate(result.user);
    router.push('/dashboard');
  }

  async function register(email: string, password: string) {
    const result = await authApi.register(email, password);
    setAuthToken(result.token);
    await mutate(result.user);
    router.push('/dashboard');
  }

  function logout() {
    clearAuthToken();
    mutate(undefined);
    router.push('/login');
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    login,
    register,
    logout,
    refresh: mutate,
  };
}
