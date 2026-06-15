import { Request, Response } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import catchAsync from '../helpers/catchAsync';
import ResponseHelper from '../helpers/responseHelper';
import { setFileSendHeaders } from '../helpers/file/fileResponseHeaders';
import {
  buildSignedFileUrl,
  verifySignedFileUrl,
  isAllowedFilePath,
  resolveFileAbsolutePath,
} from '../helpers/file/signedFileUrl';

interface ViewFileQuery {
  p?: string;
  exp?: string;
  sig?: string;
  n?: string;
}

interface SignFileQuery {
  path?: string;
  name?: string;
}

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  FILE CONTROLLER — 2 endpoint xem file qua signed URL
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  GET /api/files/sign  (verifyToken bắt buộc):
 *  - Nhận đường dẫn file tương đối → kiểm whitelist + file tồn tại → trả về
 *    signed URL (HMAC + hạn 5 phút). Đây là bước "xin vé".
 *
 *  GET /api/files/view  (KHÔNG cần token — chữ ký chính là vé):
 *  - Browser mở thẳng URL này (window.open) nên không gắn được Bearer →
 *    credential phải nằm trong URL. An toàn vì vé ngắn hạn + ký HMAC.
 *  - Verify chữ ký + whitelist → stream file inline (res.sendFile).
 *
 *  WHY tách 2 bước: chỉ user đã đăng nhập mới "xin" được vé (/sign); còn
 *  /view để browser fetch trực tiếp render PDF/ảnh — không thể kèm token.
 * ════════════════════════════════════════════════════════════════════════════
 */
class FileController {
  signFile = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as SignFileQuery;
    const target = query.path || '';
    if (!isAllowedFilePath(target)) {
      return ResponseHelper.badRequest(res, 'Đường dẫn file không hợp lệ');
    }
    try {
      await fs.access(resolveFileAbsolutePath(target));
    } catch {
      return ResponseHelper.notFound(res, 'Không tìm thấy file');
    }
    return ResponseHelper.success(res, {
      data: { url: buildSignedFileUrl(target, query.name || '') },
      message: 'Tạo liên kết xem file thành công',
    });
  });

  viewSignedFile = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as ViewFileQuery;
    const relativePath = query.p || '';
    const downloadName = query.n || '';
    if (!verifySignedFileUrl(relativePath, Number(query.exp), query.sig || '', downloadName)) {
      return ResponseHelper.forbidden(res, 'Liên kết không hợp lệ hoặc đã hết hạn');
    }
    if (!isAllowedFilePath(relativePath)) {
      return ResponseHelper.forbidden(res, 'Đường dẫn file không hợp lệ');
    }
    setFileSendHeaders(res, downloadName || path.basename(relativePath), 'inline');
    return res.sendFile(resolveFileAbsolutePath(relativePath));
  });
}

export default new FileController();
