import {
  buildSignedFileUrl,
  verifySignedFileUrl,
  isAllowedFilePath,
} from '../../src/helpers/file/signedFileUrl';

/*
 * Chứng minh signed URL THỰC SỰ hết hạn + không giả mạo được. exp được nhúng
 * vào chính chữ ký HMAC nên: (1) quá 5 phút → từ chối theo thời gian; (2) sửa
 * exp để kéo dài hạn → chữ ký tính lại không khớp → từ chối. JWT_SECRET do
 * tests/env.setup.ts cấp ('test-jwt-secret') trước khi module được import.
 */

const REL_PATH = 'storage/proposals/bao-cao.pdf';
const NAME = 'bao cao.pdf';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function parseSignedUrl(url: string) {
  const params = new URLSearchParams(url.split('?')[1] ?? '');
  return {
    p: decodeURIComponent(params.get('p') ?? ''),
    exp: Number(params.get('exp')),
    sig: params.get('sig') ?? '',
    n: decodeURIComponent(params.get('n') ?? ''),
  };
}

describe('signedFileUrl — hết hạn theo thời gian', () => {
  afterEach(() => jest.useRealTimers());

  it('chấp nhận link còn trong cửa sổ 5 phút', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { p, exp, sig, n } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));

    jest.setSystemTime(new Date('2026-01-01T00:04:00Z')); // 4' sau, vẫn còn hạn
    expect(verifySignedFileUrl(p, exp, sig, n)).toBe(true);
  });

  it('TỪ CHỐI link đã quá hạn dù chữ ký vẫn đúng', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { p, exp, sig, n } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));

    jest.setSystemTime(new Date('2026-01-01T00:06:00Z')); // 6' sau, quá 5'
    expect(verifySignedFileUrl(p, exp, sig, n)).toBe(false);
  });

  it('exp được đặt đúng now + 5 phút khi tạo', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { exp } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));
    expect(exp).toBe(Date.now() + FIVE_MINUTES_MS);
  });
});

describe('signedFileUrl — chống giả mạo (tamper-proof)', () => {
  it('không thể GIA HẠN bằng cách sửa exp (exp nằm trong chữ ký)', () => {
    const { p, exp, sig, n } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));
    const forgedExp = exp + 60 * 60 * 1000; // cố kéo dài thêm 1 giờ
    expect(verifySignedFileUrl(p, forgedExp, sig, n)).toBe(false);
  });

  it('từ chối khi đổi đường dẫn file', () => {
    const { exp, sig, n } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));
    expect(verifySignedFileUrl('storage/proposals/khac.pdf', exp, sig, n)).toBe(false);
  });

  it('từ chối khi sửa chữ ký', () => {
    const { p, exp, n } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));
    expect(verifySignedFileUrl(p, exp, 'deadbeef', n)).toBe(false);
  });

  it('từ chối khi đổi downloadName (name cũng trong chữ ký)', () => {
    const { p, exp, sig } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));
    expect(verifySignedFileUrl(p, exp, sig, 'khac.pdf')).toBe(false);
  });

  it('link hợp lệ nguyên vẹn → true', () => {
    const { p, exp, sig, n } = parseSignedUrl(buildSignedFileUrl(REL_PATH, NAME));
    expect(verifySignedFileUrl(p, exp, sig, n)).toBe(true);
  });
});

describe('isAllowedFilePath — whitelist & path traversal', () => {
  it('cho phép đúng 3 thư mục nội bộ', () => {
    expect(isAllowedFilePath('storage/proposals/a.pdf')).toBe(true);
    expect(isAllowedFilePath('uploads/decisions/a.pdf')).toBe(true);
    expect(isAllowedFilePath('uploads/adhoc-awards/a.pdf')).toBe(true);
  });

  it('chặn path traversal ".."', () => {
    expect(isAllowedFilePath('storage/proposals/../../.env')).toBe(false);
  });

  it('chặn thư mục ngoài whitelist', () => {
    expect(isAllowedFilePath('etc/passwd')).toBe(false);
    expect(isAllowedFilePath('src/configs/index.ts')).toBe(false);
  });

  it('chuẩn hoá "\\" và "/" thừa đầu chuỗi trước khi so whitelist', () => {
    expect(isAllowedFilePath('/storage/proposals/a.pdf')).toBe(true);
    expect(isAllowedFilePath('storage\\proposals\\a.pdf')).toBe(true);
  });
});
