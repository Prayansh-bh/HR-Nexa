import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SystemConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.systemConfig.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    const upserts = Object.entries(entries).map(([key, value]) =>
      this.prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    );
    await this.prisma.$transaction(upserts);
  }

  async setManyWithAudit(
    entries: Record<string, string>,
    auditData?: Prisma.AuditLogCreateInput,
  ): Promise<void> {
    const upserts = Object.entries(entries).map(([key, value]) =>
      this.prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    );

    if (auditData) {
      await this.prisma.$transaction([
        ...upserts,
        this.prisma.auditLog.create({ data: auditData }),
      ]);
    } else {
      await this.prisma.$transaction(upserts);
    }
  }
}

