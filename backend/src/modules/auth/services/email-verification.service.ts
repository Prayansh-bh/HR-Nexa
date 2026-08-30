import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface VerificationData {
  email: string;
  expiresAt: Date;
}

@Injectable()
export class EmailVerificationService {
  private verificationTokens = new Map<string, VerificationData>();

  generateVerificationToken(email: string): string {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.verificationTokens.set(token, { email, expiresAt });
    return token;
  }

  verifyEmail(token: string): { message: string; email: string } {
    const data = this.verificationTokens.get(token);
    if (!data || data.expiresAt < new Date()) {
      if (data) this.verificationTokens.delete(token);
      throw new BadRequestException(
        'Invalid or expired email verification token',
      );
    }

    this.verificationTokens.delete(token);
    return {
      message: 'Email verified successfully',
      email: data.email,
    };
  }
}
