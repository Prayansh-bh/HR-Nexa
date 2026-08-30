import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { ConfigService } from '@nestjs/config';

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  companyId?: string;
}

export interface MigrationSummary {
  totalFound: number;
  migratedCount: number;
  failedCount: number;
  skippedCount: number;
  totalBytesMigrated: number;
  dryRun: boolean;
}

@Injectable()
export class DocumentMigrationService {
  private readonly logger = new Logger(DocumentMigrationService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly s3Provider: S3StorageProvider,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Migrate existing local disk documents to S3.
   * Safe, tenant-isolated, resumable, with dry-run support and audit logging.
   */
  async migrateDocuments(options: MigrationOptions = {}): Promise<MigrationSummary> {
    const isDryRun = options.dryRun ?? false;
    const batchSize = options.batchSize ?? 50;

    this.logger.log(`====================================================`);
    this.logger.log(`  STARTING DOCUMENT MIGRATION (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'})`);
    this.logger.log(`====================================================`);

    const whereClause: any = {
      OR: [
        { storageProvider: 'LOCAL' },
        { filePath: { startsWith: 'uploads/' } },
        { filePath: { startsWith: './uploads/' } },
      ],
    };

    if (options.companyId) {
      whereClause.companyId = options.companyId;
    }

    const localDocuments = await this.prisma.document.findMany({
      where: whereClause,
      take: batchSize,
    });

    const summary: MigrationSummary = {
      totalFound: localDocuments.length,
      migratedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      totalBytesMigrated: 0,
      dryRun: isDryRun,
    };

    if (localDocuments.length === 0) {
      this.logger.log(`No LOCAL documents found requiring migration.`);
      return summary;
    }

    this.logger.log(`Found ${localDocuments.length} local document(s) to process.`);

    for (const doc of localDocuments) {
      if (!doc.filePath) {
        this.logger.warn(`Skipping doc ID ${doc.id}: No filePath defined`);
        summary.skippedCount++;
        continue;
      }

      const absoluteLocalPath = path.isAbsolute(doc.filePath)
        ? doc.filePath
        : path.join(process.cwd(), doc.filePath);

      if (!fs.existsSync(absoluteLocalPath)) {
        this.logger.warn(`Skipping doc ID ${doc.id}: Local file missing on disk at ${absoluteLocalPath}`);
        summary.skippedCount++;
        continue;
      }

      const fileStats = fs.statSync(absoluteLocalPath);
      const companyId = doc.companyId || 'SYSTEM';
      const employeePrefix = doc.employeeId ? `${doc.employeeId}/` : '';
      const s3Key = `tenants/${companyId}/documents/${employeePrefix}${doc.id}-${doc.fileName}`;

      if (isDryRun) {
        this.logger.log(
          `[DRY-RUN] Would migrate Doc ID: ${doc.id} | From: ${doc.filePath} -> S3: ${s3Key} (${(fileStats.size / 1024).toFixed(1)} KB)`,
        );
        summary.migratedCount++;
        summary.totalBytesMigrated += fileStats.size;
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(absoluteLocalPath);

        // 1. Upload to S3 Bucket
        const s3Result = await this.s3Provider.upload(
          {
            buffer: fileBuffer,
            originalname: doc.fileName,
            mimetype: 'application/octet-stream',
            size: fileStats.size,
          },
          {
            category: doc.category as any,
            companyId,
            employeeId: doc.employeeId || undefined,
          },
        );

        // 2. Atomic Database Update & Audit Log Creation
        await this.prisma.$transaction(async (tx) => {
          await tx.document.update({
            where: { id: doc.id },
            data: {
              filePath: s3Result.key,
              storageProvider: 'S3',
              migratedAt: new Date(),
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: doc.uploadedById || 'SYSTEM_MIGRATION',
              actorRole: 'SYSTEM',
              companyId,
              action: 'DOCUMENT_MIGRATED' as any,
              entityType: 'DOCUMENT' as any,
              entityId: doc.id,
              metadata: {
                oldPath: doc.filePath,
                newPath: s3Result.key,
                provider: 'S3',
                sizeBytes: fileStats.size,
              },
            },
          });
        });

        summary.migratedCount++;
        summary.totalBytesMigrated += fileStats.size;
        this.logger.log(`✅ Successfully migrated Doc ID ${doc.id} -> ${s3Result.key}`);

      } catch (err: any) {
        summary.failedCount++;
        this.logger.error(
          `❌ Migration failed for Doc ID ${doc.id} (${doc.filePath}): ${err.message}. Record remains LOCAL for safe retry.`,
        );
      }
    }

    this.logger.log(`====================================================`);
    this.logger.log(`  MIGRATION COMPLETE`);
    this.logger.log(`  Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'}`);
    this.logger.log(`  Processed: ${summary.totalFound} | Migrated: ${summary.migratedCount} | Failed: ${summary.failedCount} | Skipped: ${summary.skippedCount}`);
    this.logger.log(`  Total Data: ${(summary.totalBytesMigrated / 1024 / 1024).toFixed(2)} MB`);
    this.logger.log(`====================================================`);

    return summary;
  }
}
