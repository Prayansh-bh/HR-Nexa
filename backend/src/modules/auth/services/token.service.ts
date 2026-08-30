import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: Record<string, any>, options?: JwtSignOptions): string {
    const jti = payload.jti || randomUUID();
    const tokenPayload: Record<string, any> = {
      ...payload,
      sub: payload.sub,
      companyId: payload.role === 'SuperAdmin' ? 'PLATFORM' : (payload.companyId ?? null),
      subscriptionId: payload.role === 'SuperAdmin' ? null : (payload.subscriptionId ?? null),
      role: payload.role,
      pv: payload.pv ?? 1,
      sv: payload.sv ?? 1,
      jti,
    };
    const secret =
      process.env.JWT_SECRET || 'hrms_super_secret_jwt_key_2026_go_deepmind';
    return this.jwtService.sign(tokenPayload, { secret, ...options });
  }

  verify(token: string): any {
    const secret =
      process.env.JWT_SECRET || 'hrms_super_secret_jwt_key_2026_go_deepmind';
    return this.jwtService.verify(token, { secret });
  }
}
