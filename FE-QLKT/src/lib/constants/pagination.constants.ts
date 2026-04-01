/**
 * Phân trang bảng Ant Design.
 * Đồng bộ DEFAULT_PAGE_SIZE với BE DEFAULT_LIMIT (paginationHelper.ts).
 */
export const DEFAULT_PAGE_SIZE = 20;

/** Giá trị showSizeChanger (Ant Design: string[]) */
export const PAGE_SIZE_OPTIONS: string[] = ['20', '50', '100'];

/**
 * Cấu hình phân trang mặc định cho Ant Design Table (spread thêm `showTotal`, v.v.).
 */
export const DEFAULT_ANTD_TABLE_PAGINATION = {
  pageSize: DEFAULT_PAGE_SIZE,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
};

/** Bảng chọn trong modal (export, v.v.) — ít dòng để dễ quét. */
export const MODAL_TABLE_PREVIEW_PAGE_SIZE = 5;
