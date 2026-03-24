/**
 * Lấy chuỗi lỗi hiển thị từ lỗi axios/fetch/Error (dùng chung thay cho `catch (e: any)`).
 */
export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi'): string {
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
