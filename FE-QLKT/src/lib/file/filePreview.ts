import { message } from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';
import axiosInstance from '@/lib/axiosInstance';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  FILE PREVIEW — preview file PDF/ảnh có xác thực JWT (auth-aware blob)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  VẤN ĐỀ:
 *  File quyết định PDF nằm sau auth (chỉ MANAGER/ADMIN xem được). KHÔNG
 *  thể đơn giản:
 *      <iframe src="/api/proposals/uploads/123.pdf" />
 *  vì iframe KHÔNG gửi kèm Authorization header → server reject 401.
 *
 *  GIẢI PHÁP — BLOB URL PATTERN:
 *  1. Dùng axiosInstance (có interceptor attach Bearer token) fetch file
 *     với `responseType: 'blob'` → trả về binary Blob trong JS memory.
 *  2. Wrap Blob thành object URL: `URL.createObjectURL(blob)` → tạo
 *     URL dạng `blob:http://localhost:3000/xxx-yyy-zzz` (chỉ tab hiện
 *     tại đọc được, không gửi qua mạng).
 *  3. Mở blob URL trong tab mới: browser render PDF/ảnh natively, không
 *     cần header (URL trỏ vào memory cục bộ).
 *  4. revokeObjectURL sau khi xong → giải phóng memory.
 *
 *  3 NHÁNH RENDER:
 *  - PDF        → openPdfWithViewer (iframe + toolbar custom: download, print)
 *  - Ảnh        → window.open(blobUrl) (browser native viewer)
 *  - Khác (doc) → downloadBlob (force download — browser không preview được)
 *
 *  MEMORY LEAK WARNING:
 *  URL.createObjectURL KHÔNG tự garbage collect — phải gọi
 *  URL.revokeObjectURL khi không cần. Hiện tại revoke ngay sau khi gán
 *  vào link (downloadBlob). Với PDF/ảnh mở tab mới, KHÔNG revoke vì tab
 *  cần URL còn sống — chấp nhận leak (browser tự cleanup khi tab close).
 *
 *  MIME TYPE — quan trọng cho preview:
 *  Backend trả Content-Type qua header, nhưng axios sometimes mất khi
 *  chuyển sang blob. Tự build MIME từ extension để đảm bảo browser hiểu
 *  đúng (PDF cần 'application/pdf', không phải 'application/octet-stream'
 *  → octet-stream sẽ download thay vì preview).
 *
 *  SECURITY NOTE:
 *  - Blob URL chỉ valid trong tab tạo ra nó → không thể share link.
 *  - Bị XSS: attacker có thể inject code đọc blob nhưng vẫn cần auth
 *    token → 2 lớp bảo vệ.
 *  - File preview INLINE (Content-Disposition: inline) NHƯNG chỉ vào URL
 *    blob (origin local) → không thể attack 3rd-party site qua URL leak.
 * ════════════════════════════════════════════════════════════════════════════
 */

// File extensions that can be previewed directly in browser.
const PREVIEWABLE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

/**
 * Checks whether a file extension supports in-browser preview.
 * @param filename - File name
 * @returns `true` when file is previewable
 */
function isPreviewable(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return PREVIEWABLE_EXTENSIONS.includes(ext);
}

/**
 * Checks whether a file is a PDF.
 * @param filename - File name
 * @returns `true` when extension is `pdf`
 */
function isPdf(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf';
}

/**
 * Resolves MIME type from file extension.
 * @param filename - File name
 * @returns MIME type string
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Downloads blob data using the provided file name.
 * @param blob - File content
 * @param filename - Downloaded file name
 * @returns Nothing
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Opens a custom PDF viewer window with file toolbar.
 * @param blobUrl - Object URL of PDF blob
 * @param filename - Display file name
 * @returns Nothing
 */
function openPdfWithViewer(blobUrl: string, filename: string): void {
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${filename}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
          }
          .toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 50px;
            background: #16213e;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
          .filename {
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 60%;
          }
          .btn {
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 6px;
            background: #1890ff;
            transition: background 0.2s;
          }
          .btn:hover { background: #40a9ff; }
          .pdf-container {
            position: fixed;
            top: 50px;
            left: 0;
            right: 0;
            bottom: 0;
          }
          embed, iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <span class="filename">📄 ${filename}</span>
          <button class="btn" onclick="downloadFile()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Tải về
          </button>
        </div>
        <div class="pdf-container">
          <embed src="${blobUrl}" type="application/pdf" />
        </div>
        <script>
          function downloadFile() {
            const link = document.createElement('a');
            link.href = '${blobUrl}';
            link.download = '${filename}';
            link.click();
          }
        </script>
      </body>
      </html>
    `);
    newWindow.document.close();
  } else {
    message.error('Không thể mở cửa sổ mới. Vui lòng cho phép popup.');
  }
}

/**
 * Previews a file in browser or downloads it based on file type.
 * @param filePath - File path or URL
 * @param customFilename - Optional file name override
 * @returns Promise resolved when action finishes
 */
export async function previewFile(filePath: string, customFilename?: string): Promise<void> {
  try {
    const filename = customFilename || filePath.split('/').pop() || 'document';

    const response = await axiosInstance.get(filePath, {
      responseType: 'blob',
    });

    const mimeType = getMimeType(filename);
    const blob = new Blob([response.data], { type: mimeType });
    const blobUrl = window.URL.createObjectURL(blob);

    if (isPdf(filename)) {
      // PDF -> open custom viewer with toolbar.
      openPdfWithViewer(blobUrl, filename);
    } else if (isPreviewable(filename)) {
      // Image -> open directly in a new tab.
      window.open(blobUrl, '_blank');
    } else {
      // Unsupported preview type -> force download.
      downloadBlob(blob, filename);
      message.success(`Đã tải file: ${filename}`);
    }
  } catch (error) {
    message.error('Lỗi khi mở file');
  }
}

/**
 * Previews a decision file by decision number.
 * @param soQuyetDinh - Decision number
 * @returns Promise resolved when preview action finishes
 */
export async function previewDecisionFile(soQuyetDinh: string): Promise<void> {
  try {
    message.loading({ content: 'Đang tải file...', key: 'preview' });

    const response = await axiosInstance.get(
      `/api/decisions/download/${encodeURIComponent(soQuyetDinh)}`,
      {
        responseType: 'blob',
      }
    );

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    const filename = `${soQuyetDinh}.pdf`;

    message.destroy('preview');

    // Open PDF viewer with toolbar.
    openPdfWithViewer(blobUrl, filename);
  } catch (error: unknown) {
    const ax = error as { response?: { data?: unknown } };

    if (ax.response?.data instanceof Blob) {
      try {
        const text = await (ax.response.data as Blob).text();
        const errorData = JSON.parse(text);
        message.error({
          content: errorData.message || 'Lỗi khi mở file quyết định',
          key: 'preview',
        });
      } catch {
        message.error({ content: 'Lỗi khi mở file quyết định', key: 'preview' });
      }
    } else {
      const errorMessage = getApiErrorMessage(error, 'Lỗi khi mở file quyết định');
      message.error({ content: errorMessage, key: 'preview' });
    }
  }
}

/**
 * Previews or downloads file content from a custom API endpoint.
 * @param apiPath - API endpoint path
 * @param filename - Expected file name
 * @returns Promise resolved when action finishes
 */
export async function previewFileWithApi(apiPath: string, filename: string): Promise<void> {
  try {
    const response = await axiosInstance.get(apiPath, {
      responseType: 'blob',
    });

    const mimeType = getMimeType(filename);
    const blob = new Blob([response.data], { type: mimeType });
    const blobUrl = window.URL.createObjectURL(blob);

    if (isPdf(filename)) {
      // PDF -> open custom viewer with toolbar.
      openPdfWithViewer(blobUrl, filename);
    } else if (isPreviewable(filename)) {
      // Image -> open directly in a new tab.
      window.open(blobUrl, '_blank');
    } else {
      // Unsupported preview type -> force download.
      downloadBlob(blob, filename);
      message.success(`Đã tải file: ${filename}`);
    }
  } catch (error) {
    message.error('Lỗi khi mở file');
  }
}
