import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AppConfig } from '../config/app.config';
import { JwtPayload } from './strategies/jwt.strategy';
import { TokenPair } from './dto/login.dto';

/** Redis key for an active refresh-token session. Rotated on each refresh. */
const refreshKey = (userId: number, jti: string) => `auth:refresh:${userId}:${jti}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly cfg: AppConfig,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload & { jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.cfg.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.redis.client.get(refreshKey(payload.sub, payload.jti));
    if (!stored) throw new UnauthorizedException('Refresh token revoked');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('User disabled');

    // rotate: revoke the old refresh token
    await this.redis.del(refreshKey(payload.sub, payload.jti));
    return this.issueTokens(user);
  }

  async logout(userId: number, jti?: string): Promise<void> {
    if (jti) {
      await this.redis.del(refreshKey(userId, jti));
      return;
    }
    // Revoke all refresh tokens for the user
    const keys = await this.redis.client.keys(`auth:refresh:${userId}:*`);
    if (keys.length) await this.redis.client.del(...keys);
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const jti = crypto.randomUUID();
    const accessPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.cfg.jwt.accessSecret,
      expiresIn: this.cfg.jwt.accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(
      { ...accessPayload, jti },
      { secret: this.cfg.jwt.refreshSecret, expiresIn: this.cfg.jwt.refreshTtl },
    );

    // Store refresh jti → marker. TTL set to refresh lifetime (as seconds).
    await this.redis.client.set(
      refreshKey(user.id, jti),
      '1',
      'EX',
      parseDuration(this.cfg.jwt.refreshTtl),
    );
    return { accessToken, refreshToken };
  }
}

/** Parse "15m", "7d", "3600s" → seconds. */
export function parseDuration(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) return Number(input) || 0;
  const n = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * multiplier;
}
