import jwt from 'jsonwebtoken';
import { prismaMock } from '../helpers/prismaMock';
import authService from '../../src/services/auth.service';
import { JWT_REFRESH_SECRET, REFRESH_GRACE_MS } from '../../src/configs';

const nowSec = () => Math.floor(Date.now() / 1000);

function makeRefresh(tag: number, iatOffsetSec = 0): string {
  const iat = nowSec() + iatOffsetSec;
  return jwt.sign({ id: 'acc-1', username: 'u', tag, iat, exp: nowSec() + 2 * 24 * 3600 }, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
  });
}

const baseAccount = { id: 'acc-1', username: 'u', role: 'USER', quan_nhan_id: null };

describe('Làm mới access token bằng refresh token (xoay vòng token kèm thời gian ân hạn)', () => {
  it('Đổi refresh token hiện tại sang token mới và giữ token cũ làm token trước đó', async () => {
    const current = makeRefresh(1);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      ...baseAccount,
      refreshToken: current,
      prevRefreshToken: null,
    });
    prismaMock.taiKhoan.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await authService.refreshAccessToken(current);

    expect(result.refreshToken).not.toBe(current);
    expect(result.accessToken).toEqual(expect.any(String));
    expect(prismaMock.taiKhoan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'acc-1', refreshToken: current }),
        data: expect.objectContaining({ prevRefreshToken: current }),
      })
    );
  });

  it('Khi hai yêu cầu làm mới chạy đồng thời và thua cuộc tranh chấp, trả về token của bên thắng (không bị đăng xuất)', async () => {
    const current = makeRefresh(1);
    const winner = makeRefresh(2);
    prismaMock.taiKhoan.findUnique
      .mockResolvedValueOnce({ ...baseAccount, refreshToken: current, prevRefreshToken: null })
      .mockResolvedValueOnce({ ...baseAccount, refreshToken: winner, prevRefreshToken: current });
    prismaMock.taiKhoan.updateMany.mockResolvedValueOnce({ count: 0 }); // someone rotated first

    const result = await authService.refreshAccessToken(current);

    expect(result.refreshToken).toBe(winner);
  });

  it('Trong thời gian ân hạn, gửi lại token trước đó vẫn trả về token hiện tại (không bị đăng xuất)', async () => {
    const prev = makeRefresh(1);
    const current = makeRefresh(2); // issued just now → within grace
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      ...baseAccount,
      refreshToken: current,
      prevRefreshToken: prev,
    });

    const result = await authService.refreshAccessToken(prev);

    expect(result.refreshToken).toBe(current);
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Quá thời gian ân hạn, gửi lại token trước đó bị từ chối (trả 401)', async () => {
    const prev = makeRefresh(1);
    const graceSec = Math.ceil(REFRESH_GRACE_MS / 1000);
    const current = makeRefresh(2, -(graceSec + 5)); // current was issued long ago
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      ...baseAccount,
      refreshToken: current,
      prevRefreshToken: prev,
    });

    await expect(authService.refreshAccessToken(prev)).rejects.toMatchObject({ statusCode: 401 });
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Từ chối token lạ tuy chữ ký hợp lệ nhưng không khớp phiên, không hủy phiên đang dùng (trả 401)', async () => {
    const stray = makeRefresh(9);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      ...baseAccount,
      refreshToken: makeRefresh(1),
      prevRefreshToken: null,
    });

    await expect(authService.refreshAccessToken(stray)).rejects.toMatchObject({ statusCode: 401 });
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Từ chối khi tài khoản đã đăng xuất (refresh token đã bị xóa) (trả 401)', async () => {
    const token = makeRefresh(1);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      ...baseAccount,
      refreshToken: null,
      prevRefreshToken: null,
    });

    await expect(authService.refreshAccessToken(token)).rejects.toMatchObject({ statusCode: 401 });
  });
});
