export function maskLogCredentials(
  message: string,
  emailPass?: string,
): string {
  if (!message) return '';
  let masked = message;

  // 1. Mask specific EMAIL_PASS if configured
  if (emailPass && emailPass.length > 4) {
    const escapedPass = emailPass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const passReg = new RegExp(escapedPass, 'gi');
    masked = masked.replace(passReg, '******');
  }

  // 2. Mask general password matching formats
  masked = masked.replace(
    /(pass(?:word)?\s*[:=]\s*["']?)[^"'\r\n]+/gi,
    '$1******',
  );
  masked = masked.replace(/(smtp:\/\/.*?):([^/]+?)@/gi, '$1:******@');
  masked = masked.replace(/(xkeysib-[a-zA-Z0-9_-]+)/gi, 'xkeysib-******');

  return masked;
}
