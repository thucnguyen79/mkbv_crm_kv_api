import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * @Permissions('customer.write') — user cần có CẢ permission này (AND với các decorator khác).
 * Truyền nhiều: @Permissions('customer.read', 'customer.write') → cần cả 2.
 *
 * Để "bất kỳ 1 trong số": dùng guard layer hoặc sau này thêm `@AnyPermission()`.
 */
export const Permissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);
