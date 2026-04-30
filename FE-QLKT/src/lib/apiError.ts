/**
 * Extract user-facing message from axios/fetch/Error and log raw error to console for debugging.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi'): string {
  console.error('[API Error]', error);
  if (error && typeof error === 'object') {
    const e = error as {
      message?: string;
      response?: { data?: { message?: string; error?: string } };
    };
    const data = e.response?.data;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    if (typeof data?.error === 'string' && data.error.trim()) return data.error;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

/**
 * Ghi lỗi API để dễ tra cứu theo ngữ cảnh.
 * @param error - Giá trị từ `catch`
 * @param context - Ngữ cảnh log (vd. `MainLayout.loadNotifications`)
 * @returns void
 */
export function logApiError(error: unknown, context: string): void {
  const message = getApiErrorMessage(error, 'Lỗi không xác định');
  console.error(`Lỗi API khi ${context}: ${message}`, { context, error });
}
