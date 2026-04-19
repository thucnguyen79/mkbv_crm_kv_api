'use client';

import axios, { AxiosInstance, AxiosError } from 'axios';
import { signOut, getSession } from 'next-auth/react';

// Fallback `/api/v1` (relative) cho phép browser tự resolve theo current host:port —
// hoạt động đúng kể cả khi NEXT_PUBLIC_API_URL không set lúc build (CI build arg empty).
// Dùng `||` thay `??` vì process.env có thể inline thành empty string khi var không set.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

let cachedClient: AxiosInstance | null = null;

/**
 * Browser-side API client. Picks up accessToken from NextAuth session on each
 * request via interceptor. On 401 forces a sign-out so the user re-authenticates.
 */
export function getApiClient(): AxiosInstance {
  if (cachedClient) return cachedClient;
  const instance = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

  instance.interceptors.request.use(async (cfg) => {
    const session = await getSession();
    if (session?.accessToken) {
      cfg.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return cfg;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (err: AxiosError) => {
      if (err.response?.status === 401) {
        // NextAuth jwt callback handles refresh proactively; if we still see 401
        // here, session is truly dead — force sign-out.
        await signOut({ callbackUrl: '/login' });
      }
      return Promise.reject(err);
    },
  );

  cachedClient = instance;
  return instance;
}
