/** Chunk array + xử lý async từng batch. Trả tổng count. */
export async function chunkedBatch<T>(
  items: T[],
  chunkSize: number,
  fn: (batch: T[]) => Promise<{ count: number }>,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const res = await fn(items.slice(i, i + chunkSize));
    total += res.count;
  }
  return total;
}

/**
 * PostgreSQL max bind variables per prepared statement = 32767.
 * Dùng 10_000 làm safe margin — cho phép `where` phụ ngoài danh sách IN.
 */
export const SOFT_DELETE_CHUNK = 10_000;
