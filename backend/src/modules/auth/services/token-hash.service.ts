import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class TokenHashService {
  private readonly secret: string;

  constructor() {
    this.secret =
      process.env.TOKEN_HASH_SECRET ||
      process.env.JWT_SECRET ||
      'hrms_super_secret_jwt_key_2026_go_deepmind';
  }

  hash(token: string): string {
    if (!token) return '';
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }
}
