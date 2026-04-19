import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Browser-side API client. Attaches bearer token if available.
 * For server components, create a per-request instance with the user's token.
 */
export function createApiClient(token?: string): AxiosInstance {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 15_000,
  });
  if (token) {
    instance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
  return instance;
}

export const apiClient = createApiClient();
