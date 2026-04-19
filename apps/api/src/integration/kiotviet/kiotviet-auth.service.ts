import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { RedisService } from '../../common/redis/redis.service';
import { SettingsService } from '../../settings/settings.service';

interface KvTokenResponse {
  access_token: string;
  expires_in: number; // seconds
  token_type: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const CACHE_KEY = (retailer: string) => `kiotviet:token:${retailer}`;
/** Refresh 10 minutes before expiry to avoid using a near-expired token */
const REFRESH_SKEW_MS = 10 * 60 * 1000;

@Injectable()
export class KiotVietAuthService {
  private readonly logger = new Logger(KiotVietAuthService.name);
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Return a valid access token. Caches in Redis with TTL = expires_in - skew.
   * De-duplicates concurrent refreshes via an in-process in-flight promise.
   */
  async getAccessToken(force = false): Promise<string> {
    const cfg = this.settings.getKiotVietConfig();
    if (!cfg.retailer || !cfg.clientId || !cfg.clientSecret) {
      throw new ServiceUnavailableException('KiotViet credentials not configured');
    }
    const retailer = cfg.retailer;

    if (!force) {
      const cached = await this.redis.getJson<CachedToken>(CACHE_KEY(retailer));
      if (cached && cached.expiresAt - Date.now() > REFRESH_SKEW_MS) {
        return cached.accessToken;
      }
    }

    if (!this.inflight) {
      this.inflight = this.fetchAndCache().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  /** Forcibly invalidate cached token (e.g. after a 401). */
  async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY(this.settings.getKiotVietConfig().retailer));
  }

  private async fetchAndCache(): Promise<string> {
    const { tokenUrl, clientId, clientSecret, scope, retailer } = this.settings.getKiotVietConfig();
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    });

    try {
      const { data } = await axios.post<KvTokenResponse>(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      });

      const ttl = Math.max(60, data.expires_in - Math.floor(REFRESH_SKEW_MS / 1000));
      const payload: CachedToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      await this.redis.setJson(CACHE_KEY(retailer), payload, ttl);
      this.logger.log(`KiotViet token refreshed (ttl=${ttl}s)`);
      return data.access_token;
    } catch (err) {
      const axErr = err as AxiosError<unknown>;
      this.logger.error(
        `Failed to fetch KiotViet token: ${axErr.response?.status} ${JSON.stringify(axErr.response?.data) ?? axErr.message}`,
      );
      throw new ServiceUnavailableException('Could not obtain KiotViet access token');
    }
  }
}
