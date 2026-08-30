import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * EncryptionService provides secure AES-256-GCM symmetric encryption for secret data.
 *
 * Requirements:
 * - Key source: process.env.ENCRYPTION_KEY or ConfigService ENCRYPTION_KEY.
 * - Canonical Key Format: 64-character hexadecimal string (32 raw bytes / 256 bits)
 *   or exact 32-byte string/Buffer.
 * - Ciphertext Format: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * - IV: 12-byte cryptographically random bytes (crypto.randomBytes(12)) per operation.
 * - Auth Tag: 16-byte GCM authentication tag.
 * - Fails fast if ENCRYPTION_KEY is missing, malformed, or invalid length.
 * - Never logs key or plaintext secrets.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH_BYTES = 12;
  private readonly AUTH_TAG_LENGTH_BYTES = 16;
  private readonly KEY_LENGTH_BYTES = 32;
  private readonly VERSION_PREFIX = 'v1';

  private keyBuffer: Buffer | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  /**
   * Parse and validate the encryption key Buffer.
   * Throws an explicit configuration error if the key is missing or invalid.
   */
  public getKeyBuffer(overrideKey?: string): Buffer {
    if (overrideKey) {
      return this.parseAndValidateKey(overrideKey);
    }

    if (this.keyBuffer) {
      return this.keyBuffer;
    }

    const envKey =
      this.configService?.get<string>('ENCRYPTION_KEY') ||
      process.env.ENCRYPTION_KEY;

    if (!envKey) {
      throw new Error(
        'ENCRYPTION_KEY configuration error: ENCRYPTION_KEY environment variable is missing or empty.',
      );
    }

    this.keyBuffer = this.parseAndValidateKey(envKey);
    return this.keyBuffer;
  }

  private parseAndValidateKey(rawKey: string): Buffer {
    if (typeof rawKey !== 'string' || !rawKey.trim()) {
      throw new Error(
        'ENCRYPTION_KEY configuration error: ENCRYPTION_KEY must be a non-empty string.',
      );
    }

    const trimmedKey = rawKey.trim();

    // Canonical format: 64 hex characters -> 32 raw bytes
    if (trimmedKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
      const buf = Buffer.from(trimmedKey, 'hex');
      if (buf.length === this.KEY_LENGTH_BYTES) {
        return buf;
      }
    }

    // Alternative format: exact 32-character raw UTF-8 string -> 32 bytes
    const bufUtf8 = Buffer.from(trimmedKey, 'utf8');
    if (bufUtf8.length === this.KEY_LENGTH_BYTES) {
      return bufUtf8;
    }

    // Do NOT silently truncate or pad. Fail fast.
    throw new Error(
      `ENCRYPTION_KEY configuration error: ENCRYPTION_KEY must resolve to exactly 32 bytes (256 bits). Provided key has invalid length (length=${trimmedKey.length}). Expected a 64-character hex string or 32-byte string.`,
    );
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   *
   * @param plaintext - Text string to encrypt (including empty string "")
   * @param keyOverride - Optional key override for explicit testing/key rotation
   * @returns Formatted ciphertext: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
   */
  public encrypt(plaintext: string, keyOverride?: string): string {
    if (typeof plaintext !== 'string') {
      throw new TypeError(
        'Invalid input for encryption: plaintext must be a string.',
      );
    }

    const key = this.getKeyBuffer(keyOverride);
    const iv = crypto.randomBytes(this.IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let ciphertextHex = cipher.update(plaintext, 'utf8', 'hex');
    ciphertextHex += cipher.final('hex');

    const authTagHex = cipher.getAuthTag().toString('hex');

    return `${this.VERSION_PREFIX}:${iv.toString('hex')}:${authTagHex}:${ciphertextHex}`;
  }

  /**
   * Decrypt payload using AES-256-GCM.
   *
   * @param payload - Ciphertext in format v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
   * @param keyOverride - Optional key override for testing
   * @returns Decrypted original plaintext string
   */
  public decrypt(payload: string, keyOverride?: string): string {
    const key = this.getKeyBuffer(keyOverride);

    if (typeof payload !== 'string' || !payload.trim()) {
      throw new Error(
        'Invalid input for decryption: payload must be a non-empty string.',
      );
    }

    const parts = payload.split(':');
    if (parts.length !== 4) {
      throw new Error(
        'Invalid ciphertext payload format: expected format v1:<iv>:<authTag>:<ciphertext>.',
      );
    }

    const [version, ivHex, authTagHex, ciphertextHex] = parts;

    if (version !== this.VERSION_PREFIX) {
      throw new Error(
        `Unsupported ciphertext version: "${version}". Expected "${this.VERSION_PREFIX}".`,
      );
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== this.IV_LENGTH_BYTES) {
      throw new Error('Invalid ciphertext payload: IV length mismatch.');
    }

    if (authTag.length !== this.AUTH_TAG_LENGTH_BYTES) {
      throw new Error('Invalid ciphertext payload: Auth tag length mismatch.');
    }

    try {
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let plaintext = decipher.update(ciphertextHex, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch {
      // Do NOT log ciphertext or secrets. Standardized failure message.
      throw new Error(
        'Decryption failed: ciphertext tampered, invalid auth tag, or incorrect key.',
      );
    }
  }
}
