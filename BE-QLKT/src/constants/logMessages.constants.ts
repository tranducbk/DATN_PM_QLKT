/**
 * Reusable system-log description templates. Centralizes recurring phrasings so
 * the wording stays consistent across `writeSystemLog` call sites instead of
 * being re-typed (and drifting) at each site.
 */
export const logMessages = {
  /** "Nhập dữ liệu <label> thành công: <count> bản ghi" */
  importSuccess: (label: string, count: number): string =>
    `Nhập dữ liệu ${label} thành công: ${count} bản ghi`,

  /** "Dữ liệu lặp lại của <label> không hợp lệ: <err>" */
  invalidRepeatMap: (label: string, err: unknown): string =>
    `Dữ liệu lặp lại của ${label} không hợp lệ: ${err}`,

  /** "Lỗi gửi thông báo <action> <subject>: <err>" */
  notifyError: (action: string, subject: string, err: unknown): string =>
    `Lỗi gửi thông báo ${action} ${subject}: ${err}`,

  /** "Lỗi tính lại hồ sơ sau khi <action> <subject>: <err>" */
  recalcError: (action: string, subject: string, err: unknown): string =>
    `Lỗi tính lại hồ sơ sau khi ${action} ${subject}: ${err}`,

  /** "Lỗi tính lại hồ sơ quân nhân <subject>: <err>" */
  recalcPersonnelError: (subject: string, err: unknown): string =>
    `Lỗi tính lại hồ sơ quân nhân ${subject}: ${err}`,
};
