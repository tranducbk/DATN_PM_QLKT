import { prismaMock } from '../helpers/prismaMock';
import { collectPersonnelDuplicateErrors } from '../../src/services/eligibility/personnelDuplicateCheck';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { DANH_HIEU_CA_NHAN_KHAC } from '../../src/constants/danhHieu.constants';

describe('collectPersonnelDuplicateErrors', () => {
  it('returns empty array when no items provided', async () => {
    const result = await collectPersonnelDuplicateErrors([], 2025, PROPOSAL_TYPES.HC_QKQT);
    expect(result).toEqual([]);
  });

  it('skips items missing personnel_id or danh_hieu', async () => {
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    const result = await collectPersonnelDuplicateErrors(
      [
        { personnel_id: '', danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT },
        { personnel_id: 'p1', danh_hieu: '' },
      ],
      2025,
      PROPOSAL_TYPES.HC_QKQT
    );
    expect(result).toEqual([]);
  });

  it('returns ho_ten-prefixed message for HC_QKQT duplicate stored on the personnel', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce({
      id: 'a1',
      quan_nhan_id: 'p1',
      nam: 2024,
    } as any);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const result = await collectPersonnelDuplicateErrors(
      [{ personnel_id: 'p1', danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT }],
      2025,
      PROPOSAL_TYPES.HC_QKQT,
      { hoTenMap: new Map([['p1', 'Nguyễn Văn A']]) }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/Nguyễn Văn A:/);
  });

  it('falls back to id when ho_ten map missing entry', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce({
      id: 'a1',
      quan_nhan_id: 'p1',
      nam: 2024,
    } as any);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    const result = await collectPersonnelDuplicateErrors(
      [{ personnel_id: 'p1', danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT }],
      2025,
      PROPOSAL_TYPES.HC_QKQT
    );

    expect(result[0].startsWith('p1:')).toBe(true);
  });

  it('returns empty array when no duplicates detected', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const result = await collectPersonnelDuplicateErrors(
      [{ personnel_id: 'p1', danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT }],
      2025,
      PROPOSAL_TYPES.HC_QKQT,
      { hoTenMap: new Map([['p1', 'A']]) }
    );

    expect(result).toEqual([]);
  });
});
