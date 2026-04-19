import type { AxiosError } from 'axios';

export function apiErrorMessage(err: unknown): string {
  const ax = err as AxiosError<{ message?: string | string[]; code?: string }>;
  const body = ax.response?.data;
  if (body?.message) {
    return Array.isArray(body.message) ? body.message.join(', ') : body.message;
  }
  return (err as Error).message || 'Lỗi không xác định';
}
