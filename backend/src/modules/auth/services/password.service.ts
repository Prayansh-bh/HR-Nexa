import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePasswordPolicy(password: string, strict: boolean): void {
    if (!password) {
      throw new BadRequestException('Password is required');
    }

    if (!strict) {
      if (password.length < 6) {
        throw new BadRequestException('Password must be at least 6 characters long');
      }
      return;
    }

    if (password.length < 8) {
      throw new BadRequestException('Strict password policy requires at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Strict password policy requires at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('Strict password policy requires at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Strict password policy requires at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new BadRequestException('Strict password policy requires at least one special character');
    }
  }
}
