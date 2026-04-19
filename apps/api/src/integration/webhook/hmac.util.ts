import * as crypto from 'crypto';

/**
 * Compute HMAC-SHA256(secret, body) and return base64.
 * KiotViet `X-Hub-Signature` header ships as base64.
 *
 * Per KiotViet docs the stored secret is base64-encoded; we decode it first
 * so the raw key bytes are used with the HMAC.
 */
export function computeHubSignature(rawBody: Buffer | string, base64Secret: string): string {
  const key = Buffer.from(base64Secret, 'base64');
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  return crypto.createHmac('sha256', key).update(body).digest('base64');
}

/** Constant-time compare to defeat timing attacks. */
export function safeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function verifyHubSignature(
  rawBody: Buffer | string,
  base64Secret: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || !base64Secret) return false;
  const expected = computeHubSignature(rawBody, base64Secret);
  return safeEquals(expected, signatureHeader);
}
