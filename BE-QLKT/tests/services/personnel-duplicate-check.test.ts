import { prismaMock } from '../helpers/prismaMock';
import { collectPersonnelDuplicateErrors } from '../../src/services/eligibility/personnelDuplicateCheck';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { DANH_HIEU_DAC_BIET } from '../../src/constants/danhHieu.constants';

describe('Quân nhân trùng: kiểm tra trùng khen thưởng theo từng quân nhân', () => {
  it('Quân nhân trùng: không có dòng nào để kiểm tra → không báo lỗi nào', async () => {
    const result = await collectPersonnelDuplicateErrors([], 2025, PROPOSAL_TYPES.HC_QKQT);
    expect(result).toEqual([]);
  });

  it('Quân nhân trùng: bỏ qua các dòng thiếu quân nhân hoặc thiếu danh hiệu', async () => {
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    const result = await collectPersonnelDuplicateErrors(
      [
        { personnel_id: '', danh_hieu: DANH_HIEU_DAC_BIET.HC_QKQT },
        { personnel_id: 'p1', danh_hieu: '' },
      ],
      2025,
      PROPOSAL_TYPES.HC_QKQT
    );
    expect(result).toEqual([]);
  });

  it('Quân nhân trùng: quân nhân đã có HC QKQT → báo lỗi mở đầu bằng họ tên quân nhân', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce({
      id: 'a1',
      quan_nhan_id: 'p1',
      nam: 2024,
    } as any);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const result = await collectPersonnelDuplicateErrors(
      [{ personnel_id: 'p1', danh_hieu: DANH_HIEU_DAC_BIET.HC_QKQT }],
      2025,
      PROPOSAL_TYPES.HC_QKQT,
      { hoTenMap: new Map([['p1', 'Nguyễn Văn A']]) }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/Nguyễn Văn A:/);
  });

  it('Quân nhân trùng: thiếu họ tên quân nhân → dùng tên chung "một quân nhân", không lộ mã định danh nội bộ', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce({
      id: 'a1',
      quan_nhan_id: 'p1',
      nam: 2024,
    } as any);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    const result = await collectPersonnelDuplicateErrors(
      [{ personnel_id: 'p1', danh_hieu: DANH_HIEU_DAC_BIET.HC_QKQT }],
      2025,
      PROPOSAL_TYPES.HC_QKQT
    );

    expect(result[0].startsWith('một quân nhân:')).toBe(true);
    expect(result[0]).not.toContain('p1');
  });

  it('Quân nhân trùng: không phát hiện trùng nào → không báo lỗi', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const result = await collectPersonnelDuplicateErrors(
      [{ personnel_id: 'p1', danh_hieu: DANH_HIEU_DAC_BIET.HC_QKQT }],
      2025,
      PROPOSAL_TYPES.HC_QKQT,
      { hoTenMap: new Map([['p1', 'A']]) }
    );

    expect(result).toEqual([]);
  });
});
