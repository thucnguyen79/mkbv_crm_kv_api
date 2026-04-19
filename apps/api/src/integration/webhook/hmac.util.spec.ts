import * as crypto from 'crypto';
import { computeHubSignature, safeEquals, verifyHubSignature } from './hmac.util';

describe('hmac.util', () => {
  // 32 random bytes as the "secret", stored base64-encoded like KiotViet expects
  const secretBytes = crypto.randomBytes(32);
  const base64Secret = secretBytes.toString('base64');

  it('computeHubSignature matches an independent HMAC calculation', () => {
    const body = Buffer.from(JSON.stringify({ hello: 'world' }));
    const expected = crypto.createHmac('sha256', secretBytes).update(body).digest('base64');
    expect(computeHubSignature(body, base64Secret)).toBe(expected);
  });

  it('verifyHubSignature returns true for a correct signature', () => {
    const body = Buffer.from('{"a":1}');
    const sig = computeHubSignature(body, base64Secret);
    expect(verifyHubSignature(body, base64Secret, sig)).toBe(true);
  });

  it('verifyHubSignature returns false for a tampered body', () => {
    const body = Buffer.from('{"a":1}');
    const sig = computeHubSignature(body, base64Secret);
    expect(verifyHubSignature(Buffer.from('{"a":2}'), base64Secret, sig)).toBe(false);
  });

  it('verifyHubSignature returns false when signature missing', () => {
    expect(verifyHubSignature(Buffer.from('x'), base64Secret, undefined)).toBe(false);
  });

  it('safeEquals is length-safe', () => {
    expect(safeEquals('abc', 'abcd')).toBe(false);
    expect(safeEquals('xyz', 'xyz')).toBe(true);
  });
});
