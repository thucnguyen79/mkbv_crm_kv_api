import { ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { KiotVietAuthService } from './kiotviet-auth.service';
import { SettingsService } from '../../settings/settings.service';
import { RedisService } from '../../common/redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KiotVietAuthService', () => {
  const kvCfg = {
    retailer: 'test-retailer',
    clientId: 'cid',
    clientSecret: 'secret',
    scope: 'PublicApi.Access',
    tokenUrl: 'https://id.kiotviet.vn/connect/token',
    baseUrl: 'https://public.kiotapi.com',
    webhookSecret: '',
  };

  const settings = { getKiotVietConfig: () => kvCfg } as unknown as SettingsService;
  const emptySettings = {
    getKiotVietConfig: () => ({ ...kvCfg, retailer: '', clientId: '', clientSecret: '' }),
  } as unknown as SettingsService;

  function buildRedisMock(): RedisService {
    const store = new Map<string, string>();
    return {
      getJson: jest.fn(async (k: string) => {
        const v = store.get(k);
        return v ? JSON.parse(v) : null;
      }),
      setJson: jest.fn(async (k: string, v: unknown) => {
        store.set(k, JSON.stringify(v));
      }),
      del: jest.fn(async (k: string) => {
        store.delete(k);
      }),
    } as unknown as RedisService;
  }

  beforeEach(() => jest.clearAllMocks());

  it('fetches + caches a fresh token when cache empty', async () => {
    const redis = buildRedisMock();
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'tok-1', expires_in: 86400, token_type: 'Bearer' },
    });
    const svc = new KiotVietAuthService(settings, redis);

    const token = await svc.getAccessToken();

    expect(token).toBe('tok-1');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(redis.setJson).toHaveBeenCalledWith(
      'kiotviet:token:test-retailer',
      expect.objectContaining({ accessToken: 'tok-1' }),
      expect.any(Number),
    );
  });

  it('returns cached token when still valid', async () => {
    const redis = buildRedisMock();
    await redis.setJson('kiotviet:token:test-retailer', {
      accessToken: 'cached-tok',
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    const svc = new KiotVietAuthService(settings, redis);

    const token = await svc.getAccessToken();

    expect(token).toBe('cached-tok');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('de-duplicates concurrent refreshes via in-flight promise', async () => {
    const redis = buildRedisMock();
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'tok-x', expires_in: 86400, token_type: 'Bearer' },
    });
    const svc = new KiotVietAuthService(settings, redis);

    const [a, b, c] = await Promise.all([
      svc.getAccessToken(),
      svc.getAccessToken(),
      svc.getAccessToken(),
    ]);

    expect(a).toBe('tok-x');
    expect(b).toBe('tok-x');
    expect(c).toBe('tok-x');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('throws ServiceUnavailable if credentials missing', async () => {
    const svc = new KiotVietAuthService(emptySettings, buildRedisMock());
    await expect(svc.getAccessToken()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('invalidate() clears cache', async () => {
    const redis = buildRedisMock();
    const svc = new KiotVietAuthService(settings, redis);
    await svc.invalidate();
    expect(redis.del).toHaveBeenCalledWith('kiotviet:token:test-retailer');
  });
});
