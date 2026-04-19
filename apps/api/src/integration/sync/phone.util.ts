/**
 * Normalize a Vietnamese phone number to the canonical `0XXXXXXXXX` form (10 digits).
 *
 * Rules:
 *  - Strip everything that is not a digit or leading `+`
 *  - `+84…` or `84…` → `0…`
 *  - Accept 10 digits starting with `0` (new format, current)
 *  - Accept 11 digits old format `01xxxxxxxxx` as-is (VN migrated most prefixes in 2018
 *    but a few historical numbers may still appear)
 *
 * Returns `null` for obviously invalid input so callers can decide how to handle
 * bad data (skip / log / route to dedupe-exempt bucket).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[^\d+]/g, '');

  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('84')) s = '0' + s.slice(2);

  if (!/^0\d+$/.test(s)) return null;
  if (s.length < 9 || s.length > 11) return null;
  return s;
}

/** Truthy helper — returns the normalized phone or throws if invalid. */
export function requirePhone(raw: string | null | undefined): string {
  const n = normalizePhone(raw);
  if (!n) throw new Error(`Invalid phone: ${raw}`);
  return n;
}
