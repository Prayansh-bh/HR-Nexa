import { UploadCategory } from '../storage.constants';

export interface StoredFile {
  key: string;          // S3 object key or relative local path (e.g. "tenants/c-1/documents/e-1/123.pdf")
  size: number;         // File size in bytes
  mimeType: string;     // Validated MIME type
  originalName: string; // Original uploaded file name
  etag?: string;        // S3 ETag MD5 checksum
  lastModified?: Date;  // File modification date timestamp
}

export interface UploadOptions {
  category: UploadCategory | string;
  companyId?: string;
  employeeId?: string;
  contentType?: string;
}

export interface StorageProvider {
  /** Upload a file buffer or file from temporary path to target storage system */
  upload(
    file: { path?: string; buffer?: Buffer; originalname: string; mimetype: string; size: number },
    options: UploadOptions,
  ): Promise<StoredFile>;

  /** Stream or retrieve buffer from target storage system */
  download(key: string): Promise<Buffer | NodeJS.ReadableStream>;

  /** Delete object by key */
  delete(key: string): Promise<boolean>;

  /** Check if object exists at key */
  exists(key: string): Promise<boolean>;

  /** Execute startup health and permission check */
  healthCheck(): Promise<boolean>;
}
