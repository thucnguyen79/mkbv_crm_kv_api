import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@prisma/client';
import { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
  roleId?: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    cfg: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.jwt.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Re-load mỗi request — chấp nhận 1 extra query để lấy roleId mới nhất
    // (sau khi admin đổi role của user, không cần đợi access token expire).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, roleId: true, branchId: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
      branchId: user.branchId,
    };
  }
}
