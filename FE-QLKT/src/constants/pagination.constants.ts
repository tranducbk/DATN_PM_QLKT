// Keep DEFAULT_PAGE_SIZE in sync with BE DEFAULT_LIMIT (paginationHelper.ts).
export const DEFAULT_PAGE_SIZE = 20;

export const PAGE_SIZE_OPTIONS: string[] = ['20', '50', '100'];

export const DEFAULT_ANTD_TABLE_PAGINATION = {
  pageSize: DEFAULT_PAGE_SIZE,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showLessItems: true,
};

export const MODAL_TABLE_PREVIEW_PAGE_SIZE = 5;

export const FETCH_ALL_LIMIT = 1000;
