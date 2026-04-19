import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { SettingsService } from '../../settings/settings.service';
import { KiotVietAuthService } from './kiotviet-auth.service';

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

/**
 * KiotViet HTTP client:
 * - Injects `Retailer` + `Authorization: Bearer <token>` headers
 * - Refreshes token + retries once on 401
 * - Exponential backoff on 429 / 5xx (up to MAX_RETRIES)
 */
@Injectable()
export class KiotVietHttpService {
  private readonly logger = new Logger(KiotVietHttpService.name);
  private readonly axios: AxiosInstance;

  constructor(
    private readonly settings: SettingsService,
    private readonly auth: KiotVietAuthService,
  ) {
    // baseURL + Retailer header resolved per-request từ settings (có thể đổi runtime).
    this.axios = axios.create({
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async get<T>(
    path: string,
    params?: Record<string, unknown>,
    opts?: { signal?: AbortSignal },
  ): Promise<T> {
    return this.request<T>({ method: 'GET', url: path, params, signal: opts?.signal });
  }

  async post<T>(path: string, body?: unknown, opts?: { signal?: AbortSignal }): Promise<T> {
    return this.request<T>({ method: 'POST', url: path, data: body, signal: opts?.signal });
  }

  async put<T>(path: string, body?: unknown, opts?: { signal?: AbortSignal }): Promise<T> {
    return this.request<T>({ method: 'PUT', url: path, data: body, signal: opts?.signal });
  }

  async delete<T>(path: string, opts?: { signal?: AbortSignal }): Promise<T> {
    return this.request<T>({ method: 'DELETE', url: path, signal: opts?.signal });
  }

  private async request<T>(config: AxiosRequestConfig, attempt = 1): Promise<T> {
    const token = await this.auth.getAccessToken();
    const kv = this.settings.getKiotVietConfig();
    try {
      const response = await this.axios.request<T>({
        baseURL: kv.baseUrl,
        ...config,
        headers: {
          ...config.headers,
          Retailer: kv.retailer,
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (err) {
      const axErr = err as AxiosError<unknown>;
      const status = axErr.response?.status;

      // 401 → invalidate + retry once with fresh token
      if (status === 401 && attempt === 1) {
        this.logger.warn(`KiotViet 401 on ${config.method} ${config.url} — refreshing token`);
        await this.auth.invalidate();
        return this.request<T>(config, attempt + 1);
      }

      // 429 or 5xx → exponential backoff retry
      if ((status === 429 || (status && status >= 500)) && attempt <= MAX_RETRIES) {
        const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `KiotViet ${status} on ${config.method} ${config.url} attempt=${attempt} — retry in ${delay}ms`,
        );
        await sleep(delay);
        return this.request<T>(config, attempt + 1);
      }

      this.logger.error(
        `KiotViet ${config.method} ${config.url} failed: status=${status} body=${JSON.stringify(axErr.response?.data) ?? axErr.message}`,
      );
      throw err;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
