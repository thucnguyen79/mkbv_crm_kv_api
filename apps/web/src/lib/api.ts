'use client';

import axios, { AxiosInstance, AxiosError } from 'axios';
import { signOut, getSession } from 'next-auth/react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

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
