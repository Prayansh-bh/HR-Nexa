import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenHashService } from './token-hash.service';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private blacklistedTokens = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private tokenHashService: TokenHashService,
  ) {}

  async blacklistToken(tokenOrJti: string, expiresAt?: Date): Promise<void> {
    if (!tokenOrJti) return;
    const tokenHash = this.tokenHashService.hash(tokenOrJti);
    this.blacklistedTokens.add(tokenHash);

    const ttlDate = expiresAt || new Date(Date.now() + 15 * 60 * 1000); // 15 min default TTL
    try {
      await this.prisma.blacklistedToken.upsert({
        where: { tokenHash },
        create: { tokenHash, expiresAt: ttlDate },
        update: { expiresAt: ttlDate },
      });
    } catch (err: any) {
      this.logger.debug(`Blacklist DB write note: ${err.message}`);
    }
  }

  async isBlacklisted(tokenOrJti: string): Promise<boolean> {
    if (!tokenOrJti) return false;
    const tokenHash = this.tokenHashService.hash(tokenOrJti);
    if (this.blacklistedTokens.has(tokenHash)) {
      return true;
    }
    try {
      const found = await this.prisma.blacklistedToken.findUnique({
        where: { tokenHash },
      });
      if (found && found.expiresAt > new Date()) {
        this.blacklistedTokens.add(tokenHash);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }
}
