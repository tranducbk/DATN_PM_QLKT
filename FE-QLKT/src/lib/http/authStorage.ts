/*
 * ════════════════════════════════════════════════════════════════════════════
 *  AUTH STORAGE — quản lý localStorage cho auth (ATTT)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WHITE-LIST PATTERN:
 *  Định nghĩa CỤ THỂ key nào thuộc về auth, KHÔNG dùng localStorage.clear().
 *  Lý do:
 *    - localStorage.clear() xoá CẢ user preferences (theme, layout, ...).
 *    - User logout không nên mất theme dark mode đã chọn.
 *    - Library 3rd party (vd: Ant Design) cũng có thể lưu vào localStorage
 *      → clear() đụng phải gây bug.
 *
 *  KEY ĐƯỢC LƯU:
 *  - accessToken    ← JWT 30 phút, mang trong header Authorization
 *  - refreshToken   ← JWT 7 ngày, dùng để xin access mới
 *  - role           ← cache role để route guard không cần decode token
 *  - userId, username, quan_nhan_id, ho_ten, don_vi_id ← cache profile
 *
 *  ATTT — RỦI RO LƯU TRONG LOCALSTORAGE:
 *  ⚠️  localStorage CÓ THỂ BỊ ĐỌC qua XSS attack (vd: 3rd party script
 *      malicious được inject). Cookie httpOnly an toàn hơn.
 *
 *      Tại sao vẫn dùng localStorage:
 *      - Hệ thống nội bộ quân đội → không có user-generated content (XSS
 *        khó xảy ra).
 *      - Cookie httpOnly cần BE set Cookie header + FE không đọc được →
 *        khó hiển thị tên user trên header.
 *      - Trade-off chấp nhận trong scope đồ án.
 *
 *      Nếu deploy production thật cần:
 *      ① Move accessToken vào memory only (state, không persist).
 *      ② Move refreshToken vào httpOnly cookie.
 *      ③ Profile cache (role, username, ...) có thể giữ localStorage.
 *
 *  TYPEOF WINDOW CHECK:
 *  Next.js SSR chạy code này trên Node → không có window.localStorage.
 *  Phải guard `typeof window === 'undefined'` để tránh crash khi SSR.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * localStorage keys owned by the auth flow. Anything outside this list (notably `theme`)
 * is treated as a user preference that should survive logout / forced re-login.
 */
const AUTH_STORAGE_KEYS = [
  'accessToken',
  'refreshToken',
  'role',
  'username',
  'userId',
  'quan_nhan_id',
  'ho_ten',
  'don_vi_id',
] as const;

/**
 * Remove all auth-related keys without touching user preferences (theme, etc).
 * Use this instead of `localStorage.clear()` on logout/session-expiry paths.
 */
export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
