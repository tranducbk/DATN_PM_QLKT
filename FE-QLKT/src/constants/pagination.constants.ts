import type { TablePaginationConfig } from 'antd';

// Keep DEFAULT_PAGE_SIZE in sync with BE DEFAULT_LIMIT (paginationHelper.ts).
export const DEFAULT_PAGE_SIZE = 20;

export const PAGE_SIZE_OPTIONS: string[] = ['20', '50', '100'];

export const DEFAULT_ANTD_TABLE_PAGINATION = {
  pageSize: DEFAULT_PAGE_SIZE,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showLessItems: true,
};

/** Compact pagination for selection tables inside modals — small, centered, hidden on single page. */
export const MODAL_TABLE_PAGINATION: TablePaginationConfig = {
  pageSize: DEFAULT_PAGE_SIZE,
  size: 'small',
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  hideOnSinglePage: true,
  showLessItems: true,
  position: ['bottomCenter'],
};

export const MODAL_TABLE_PREVIEW_PAGE_SIZE = 5;

export const FETCH_ALL_LIMIT = 1000;

/** Max proposals fetched per list view (client-side filters/paginates the result). */
export const PROPOSAL_LIST_LIMIT = 100;
