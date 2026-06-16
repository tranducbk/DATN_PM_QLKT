import express from 'express';
import request from 'supertest';
import { promises as fs } from 'fs';
import path from 'path';
import fileRoutes from '../../src/routes/file.route';
import { buildSignedFileUrl } from '../../src/helpers/file/signedFileUrl';

/*
 * Test tầng HTTP cho endpoint signed-URL (route → controller → sendFile), KHÔNG
 * cần DB. /api/files/view là public — chữ ký trong URL chính là credential. Tạo
 * 1 file thật dưới storage/proposals (thư mục whitelist) để kiểm nhánh 200.
 *
 * Mount RIÊNG file router trên app tối giản (thay vì import src/app) để tránh
 * kéo theo side-effect import của các route khác (vd devZone seed-on-import dưới
 * Prisma mock) — giữ test cô lập, sạch output. Full-app wiring do integration
 * test (proposalFlow) lo.
 */
const app = express();
app.use('/api/files', fileRoutes);

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const REL_PATH = 'storage/proposals/__signed_url_endpoint_test__.txt';
const ABS_PATH = path.join(PROJECT_ROOT, REL_PATH);
const FILE_CONTENT = 'noi dung test signed url';

beforeAll(async () => {
  await fs.mkdir(path.dirname(ABS_PATH), { recursive: true });
  await fs.writeFile(ABS_PATH, FILE_CONTENT);
});

afterAll(async () => {
  await fs.rm(ABS_PATH, { force: true });
  jest.useRealTimers();
});

describe('GET /api/files/view — signed URL', () => {
  it('200 + stream đúng file khi link hợp lệ', async () => {
    const url = buildSignedFileUrl(REL_PATH, 'tai-lieu.txt');
    const res = await request(app).get(url).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('inline');
    // sendFile đặt Content-Length = kích thước file → xác nhận stream đúng file.
    expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength(FILE_CONTENT));
  });

  it('403 khi link ĐÃ HẾT HẠN (chữ ký đúng nhưng quá 5 phút)', async () => {
    // Ký ở mốc quá khứ → exp cũng ở quá khứ nhưng chữ ký HỢP LỆ cho exp đó.
    // Khôi phục timer thật → server thấy now >> exp → 403 thuần do hết hạn.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    const expiredUrl = buildSignedFileUrl(REL_PATH, 'tai-lieu.txt');
    jest.useRealTimers();

    const res = await request(app).get(expiredUrl);
    expect(res.status).toBe(403);
  });

  it('403 khi chữ ký bị sửa', async () => {
    const url = buildSignedFileUrl(REL_PATH, 'tai-lieu.txt');
    const tampered = url.replace(/sig=[a-f0-9]+/, 'sig=deadbeef');
    const res = await request(app).get(tampered);
    expect(res.status).toBe(403);
  });

  it('403 khi path ngoài whitelist dù chữ ký hợp lệ', async () => {
    const url = buildSignedFileUrl('src/configs/index.ts', 'leak.ts');
    const res = await request(app).get(url);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/files/sign — yêu cầu đăng nhập', () => {
  it('401 khi không có token', async () => {
    const res = await request(app).get('/api/files/sign').query({ path: REL_PATH });
    expect(res.status).toBe(401);
  });
});
