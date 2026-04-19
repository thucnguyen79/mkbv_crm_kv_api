const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Bind `{{var}}` placeholders trong template body.
 * - Missing variable → throw (tránh gửi "Chào ," ra khách)
 * - Giá trị `null`/`undefined` → coi như missing
 * - Dạng Date → ISO string
 */
export function bindTemplate(body: string, variables: Record<string, unknown>): string {
  const missing: string[] = [];
  const out = body.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const v = variables[key];
    if (v === undefined || v === null || v === '') {
      missing.push(key);
      return '';
    }
    if (v instanceof Date) return v.toISOString();
    return String(v);
  });
  if (missing.length) {
    throw new Error(`Missing template variables: ${[...new Set(missing)].join(', ')}`);
  }
  return out;
}

/** Trích các placeholder trong body (dùng để UI preview / validate). */
export function extractVariables(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(PLACEHOLDER_RE)) out.add(m[1]);
  return [...out];
}
