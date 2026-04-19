import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AuthService, parseDuration } from './auth.service';
import { AppConfig } from '../config/app.config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

describe('parseDuration', () => {
  it.each([
    ['15m', 900],
    ['7d', 604800],
    ['3h', 10800],
    ['45s', 45],
    ['600', 600],
  ])('parses %s → %d seconds', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});

describe('AuthService', () => {
  const cfg = {
    jwt: {
      accessSecret: 'a'.repeat(32),
      refreshSecret: 'r'.repeat(32),
      accessTtl: '15m',
      refreshTtl: '7d',
    },
  } as unknown as AppConfig;

  function build() {
    const prisma = {
      user: { findUnique: jest.fn() },
    } as unknown as PrismaService;

    const redisStore = new Map<string, string>();
    const redis = {
      client: {
        get: jest.fn(async (k: string) => redisStore.get(k) ?? null),
        set: jest.fn(async (k: string, v: string) => {
          redisStore.set(k, v);
        }),
        del: jest.fn(async (...keys: string[]) => keys.forEach((k) => redisStore.delete(k))),
        keys: jest.fn(async (pattern: string) => {
          const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return Array.from(redisStore.keys()).filter((k) => re.test(k));
        }),
      },
      del: jest.fn(async (k: string) => {
        redisStore.delete(k);
      }),
    } as unknown as RedisService;

    const jwt = new JwtService({});
    const svc = new AuthService(prisma, jwt, redis, cfg);
    return { svc, prisma, jwt, redis };
  }

  it('login() rejects invalid credentials', async () => {
    const { svc, prisma } = build();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(svc.login('nope@x.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login() returns token pair for valid user', async () => {
    const { svc, prisma } = build();
    const passwordHash = await bcrypt.hash('secret', 4);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'admin@x',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      branchId: null,
    });

    const tokens = await svc.login('admin@x', 'secret');
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
  });

  it('refresh() rotates the token and rejects reused refresh', async () => {
    const { svc, prisma } = build();
    const passwordHash = await bcrypt.hash('secret', 4);
    const user = {
      id: 1,
      email: 'admin@x',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      branchId: null,
    };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

    const tokens = await svc.login('admin@x', 'secret');
    const next = await svc.refresh(tokens.refreshToken);
    expect(next.accessToken).toBeTruthy();
    // original refresh should now be revoked
    await expect(svc.refresh(tokens.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
