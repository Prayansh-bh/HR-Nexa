import { EncryptionService } from './encryption.service';
import * as crypto from 'crypto';

describe('EncryptionService', () => {
  const VALID_KEY_HEX = crypto.randomBytes(32).toString('hex'); // 64-char hex
  const VALID_KEY_32_BYTE = '12345678901234567890123456789012'; // 32-byte UTF-8 string
  const SECOND_KEY_HEX = crypto.randomBytes(32).toString('hex'); // 64-char hex (different key)

  let service: EncryptionService;

  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY;
    service = new EncryptionService();
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // Test 1
  it('1. should encrypt then decrypt returning original plaintext', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_HEX;
    const originalText = 'my-super-secret-api-key-12345';

    const ciphertext = service.encrypt(originalText);
    expect(ciphertext).not.toEqual(originalText);
    expect(ciphertext.startsWith('v1:')).toBe(true);

    const decrypted = service.decrypt(ciphertext);
    expect(decrypted).toEqual(originalText);
  });

  // Test 2
  it('2. should produce different ciphertext when encrypting the same plaintext twice', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_HEX;
    const plaintext = 'constant-secret-payload';

    const cipher1 = service.encrypt(plaintext);
    const cipher2 = service.encrypt(plaintext);

    expect(cipher1).not.toEqual(cipher2);
    expect(service.decrypt(cipher1)).toEqual(plaintext);
    expect(service.decrypt(cipher2)).toEqual(plaintext);
  });

  // Test 3
  it('3. should fail decryption if ciphertext body is tampered with', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_HEX;
    const plaintext = 'sensitive-credentials';
    const validCiphertext = service.encrypt(plaintext);

    const parts = validCiphertext.split(':');
    // Tamper the ciphertext hex component while preserving hex length
    const lastChar = parts[3].slice(-1);
    const tamperedLastChar = lastChar === '0' ? '1' : '0';
    const tamperedCipherHex = parts[3].slice(0, -1) + tamperedLastChar;
    const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCipherHex}`;

    expect(() => service.decrypt(tamperedPayload)).toThrow(
      'Decryption failed: ciphertext tampered, invalid auth tag, or incorrect key.',
    );
  });

  // Test 4
  it('4. should fail decryption if authentication tag is tampered with', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_HEX;
    const plaintext = 'sensitive-credentials';
    const validCiphertext = service.encrypt(plaintext);

    const parts = validCiphertext.split(':');
    // Tamper the auth tag hex component while preserving exact 32-character (16-byte) hex length
    const lastChar = parts[2].slice(-1);
    const tamperedLastChar = lastChar === '0' ? '1' : '0';
    const tamperedTagHex = parts[2].slice(0, -1) + tamperedLastChar;
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedTagHex}:${parts[3]}`;

    expect(() => service.decrypt(tamperedPayload)).toThrow(
      'Decryption failed: ciphertext tampered, invalid auth tag, or incorrect key.',
    );
  });

  // Test 5
  it('5. should fail decryption when using a wrong encryption key', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_HEX;
    const plaintext = 'confidential-data';
    const ciphertext = service.encrypt(plaintext);

    // Switch to a different valid key
    process.env.ENCRYPTION_KEY = SECOND_KEY_HEX;
    const service2 = new EncryptionService();

    expect(() => service2.decrypt(ciphertext)).toThrow(
      'Decryption failed: ciphertext tampered, invalid auth tag, or incorrect key.',
    );
  });

  // Test 6
  it('6. should fail fast if ENCRYPTION_KEY is missing during operation', () => {
    delete process.env.ENCRYPTION_KEY;
    const serviceNoKey = new EncryptionService();

    expect(() => serviceNoKey.encrypt('test')).toThrow(
      'ENCRYPTION_KEY configuration error: ENCRYPTION_KEY environment variable is missing or empty.',
    );
    expect(() => serviceNoKey.decrypt('v1:000000000000000000000000:00000000000000000000000000000000:00')).toThrow(
      'ENCRYPTION_KEY configuration error: ENCRYPTION_KEY environment variable is missing or empty.',
    );
  });

  // Test 7
  it('7. should fail fast if ENCRYPTION_KEY length is invalid', () => {
    // Key too short (16 chars hex = 8 bytes)
    process.env.ENCRYPTION_KEY = '1234567890abcdef';
    const serviceInvalidKey = new EncryptionService();

    expect(() => serviceInvalidKey.encrypt('test')).toThrow(
      /ENCRYPTION_KEY configuration error: ENCRYPTION_KEY must resolve to exactly 32 bytes/,
    );
  });

  // Test 8
  it('8. should correctly encrypt and decrypt unicode and special characters', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_HEX;
    const complexSecret = JSON.stringify({
      secret: '🔑✨ Top Secret Password! @#$%^&*()_\n\t\\',
      multiline: 'Line 1\nLine 2',
      arabic: 'مرحبا',
      japanese: 'こんにちは',
    });

    const ciphertext = service.encrypt(complexSecret);
    const decrypted = service.decrypt(ciphertext);

    expect(decrypted).toEqual(complexSecret);
    expect(JSON.parse(decrypted).secret).toContain('🔑✨');
  });

  // Test 9
  it('9. should explicitly support empty plaintext strings correctly', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_32_BYTE;
    const emptyPlaintext = '';

    const ciphertext = service.encrypt(emptyPlaintext);
    expect(ciphertext.startsWith('v1:')).toBe(true);

    const decrypted = service.decrypt(ciphertext);
    expect(decrypted).toEqual('');
  });

  // Test 10
  it('10. should never write secret plaintext or encryption key to logs', () => {
    process.env.ENCRYPTION_KEY = VALID_KEY_HEX;

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const secretValue = 'ULTRA_SECRET_TOKEN_DO_NOT_LOG_99999';
    const ciphertext = service.encrypt(secretValue);

    // Intentionally trigger a failed decryption
    try {
      service.decrypt('v1:000000000000000000000000:00000000000000000000000000000000:0000');
    } catch {
      // Expected exception
    }

    const allLoggedArgs = [
      ...consoleSpy.mock.calls.flatMap((c) => c),
      ...warnSpy.mock.calls.flatMap((c) => c),
      ...errorSpy.mock.calls.flatMap((c) => c),
    ].join(' ');

    expect(allLoggedArgs).not.toContain(secretValue);
    expect(allLoggedArgs).not.toContain(VALID_KEY_HEX);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
