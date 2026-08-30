import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider, StoredFile, UploadOptions } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.join(process.cwd(), 'uploads');
    this.ensureDirectoryExists(this.baseUploadDir);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async upload(
    file: { path?: string; buffer?: Buffer; originalname: string; mimetype: string; size: number },
    options: UploadOptions,
  ): Promise<StoredFile> {
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase().replace(/[^a-z0-9.]/gi, '');
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
    const companyPrefix = options.companyId ? `tenants/${options.companyId}/` : '';
    const employeePrefix = options.employeeId ? `/${options.employeeId}` : '';
    const key = `uploads/${companyPrefix}${options.category}${employeePrefix}/${uniqueFilename}`;

    const cleanKey = key.replace(/^uploads\//, '');
    const fullPath = path.join(this.baseUploadDir, cleanKey);
    this.ensureDirectoryExists(path.dirname(fullPath));

    if (file.buffer) {
      fs.writeFileSync(fullPath, file.buffer);
    } else if (file.path && fs.existsSync(file.path)) {
      fs.copyFileSync(file.path, fullPath);
    } else {
      throw new Error('No file buffer or temp path provided for local upload');
    }

    this.logger.log(
      `[STORAGE] provider=local operation=upload category=${options.category} key=${key} size=${file.size}`,
    );

    return {
      key,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
      lastModified: new Date(),
    };
  }

  /** Read legacy local file stream for backward compatibility */
  async download(key: string): Promise<Buffer | NodeJS.ReadableStream> {
    const startTime = Date.now();
    const cleanKey = key.replace(/^\.\//, '').replace(/^uploads\//, '');
    const fullPath = path.join(this.baseUploadDir, cleanKey);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Legacy local file not found on disk at key: ${key}`);
    }

    const stream = fs.createReadStream(fullPath);
    this.logger.log(`[STORAGE] provider=local operation=download key=${key} durationMs=${Date.now() - startTime}`);
    return stream;
  }

  /** Delete legacy local file during document removal or cleanup */
  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      const cleanKey = key.replace(/^\.\//, '').replace(/^uploads\//, '');
      const fullPath = path.join(this.baseUploadDir, cleanKey);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.log(`[STORAGE] provider=local operation=delete key=${key} durationMs=${Date.now() - startTime}`);
      }
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to delete local file at key ${key}: ${err.message}`);
      return false;
    }
  }

  /** Check if legacy local file exists on disk */
  async exists(key: string): Promise<boolean> {
    const cleanKey = key.replace(/^\.\//, '').replace(/^uploads\//, '');
    const fullPath = path.join(this.baseUploadDir, cleanKey);
    return fs.existsSync(fullPath);
  }

  /** Health check verifying local directory accessibility */
  async healthCheck(): Promise<boolean> {
    try {
      this.ensureDirectoryExists(this.baseUploadDir);
      const testFile = path.join(this.baseUploadDir, `.health-check-${Date.now()}`);
      fs.writeFileSync(testFile, 'OK');
      fs.unlinkSync(testFile);
      return true;
    } catch (err: any) {
      this.logger.error(`LocalStorageProvider healthCheck FAILED: ${err.message}`);
      return false;
    }
  }
}
