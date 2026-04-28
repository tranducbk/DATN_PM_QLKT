import { validateHCCSVVRankOrder } from '../../src/helpers/awardValidation/tenureMedalRankOrder';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_HCCSVV,
} from '../../src/constants/danhHieu.constants';

describe('validateHCCSVVRankOrder', () => {
  it('HANG_BA luôn hợp lệ — không có rank thấp hơn để check', () => {
    expect(validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_BA, 2024, [])).toBeNull();
    expect(
      validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_BA, 2024, [
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2020 },
      ])
    ).toBeNull();
  });

  it('HANG_NHI khi chưa có HANG_BA → reject "Phải nhận ... trước"', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHI, 2024, []);
    expect(error).toBe(
      'Phải nhận Huy chương Chiến sĩ vẻ vang hạng Ba trước khi nhận Huy chương Chiến sĩ vẻ vang hạng Nhì'
    );
  });

  it('HANG_NHI cùng năm với HANG_BA → reject "phải sau năm"', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHI, 2018, [
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2018 },
    ]);
    expect(error).toBe(
      'Năm nhận Huy chương Chiến sĩ vẻ vang hạng Nhì (2018) phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Ba (2018)'
    );
  });

  it('HANG_NHI sau HANG_BA năm trước → hợp lệ', () => {
    expect(
      validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHI, 2018, [
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
      ])
    ).toBeNull();
  });

  it('HANG_NHAT chỉ có HANG_BA (thiếu HANG_NHI) → reject', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHAT, 2025, [
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
    ]);
    expect(error).toBe(
      'Phải nhận Huy chương Chiến sĩ vẻ vang hạng Nhì trước khi nhận Huy chương Chiến sĩ vẻ vang hạng Nhất'
    );
  });

  it('HANG_NHAT cùng năm với HANG_NHI → reject "phải sau năm"', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHAT, 2020, [
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2020 },
    ]);
    expect(error).toBe(
      'Năm nhận Huy chương Chiến sĩ vẻ vang hạng Nhất (2020) phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Nhì (2020)'
    );
  });

  it('HANG_NHAT đầy đủ tuần tự → hợp lệ', () => {
    expect(
      validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHAT, 2025, [
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2020 },
      ])
    ).toBeNull();
  });

  it('Rank không thuộc HCCSVV → return null (no-op)', () => {
    expect(validateHCCSVVRankOrder(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, 2024, [])).toBeNull();
  });
});
