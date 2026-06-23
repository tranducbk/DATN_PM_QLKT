import { validateHCCSVVRankOrder } from '../../src/helpers/awardValidation/tenureMedalRankOrder';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_HCCSVV,
} from '../../src/constants/danhHieu.constants';

describe('HCCSVV (niên hạn): kiểm tra thứ tự hạng khi nhận', () => {
  it('HCCSVV (niên hạn): nhận hạng Ba luôn hợp lệ — không có hạng thấp hơn cần kiểm tra trước', () => {
    expect(validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_BA, 2024, [])).toBeNull();
    expect(
      validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_BA, 2024, [
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2020 },
      ])
    ).toBeNull();
  });

  it('HCCSVV (niên hạn): nhận hạng Nhì khi chưa có hạng Ba → từ chối "Phải nhận ... hạng Ba trước"', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHI, 2024, []);
    expect(error).toBe(
      'Phải nhận Huy chương Chiến sĩ vẻ vang hạng Ba trước khi nhận Huy chương Chiến sĩ vẻ vang hạng Nhì'
    );
  });

  it('HCCSVV (niên hạn): nhận hạng Nhì cùng năm với hạng Ba → từ chối "phải sau năm nhận hạng Ba"', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHI, 2018, [
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2018 },
    ]);
    expect(error).toBe(
      'Năm nhận Huy chương Chiến sĩ vẻ vang hạng Nhì (2018) phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Ba (2018)'
    );
  });

  it('HCCSVV (niên hạn): nhận hạng Nhì ở năm sau năm nhận hạng Ba → hợp lệ', () => {
    expect(
      validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHI, 2018, [
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
      ])
    ).toBeNull();
  });

  it('HCCSVV (niên hạn): nhận hạng Nhất khi mới có hạng Ba, thiếu hạng Nhì → từ chối "Phải nhận ... hạng Nhì trước"', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHAT, 2025, [
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
    ]);
    expect(error).toBe(
      'Phải nhận Huy chương Chiến sĩ vẻ vang hạng Nhì trước khi nhận Huy chương Chiến sĩ vẻ vang hạng Nhất'
    );
  });

  it('HCCSVV (niên hạn): nhận hạng Nhất cùng năm với hạng Nhì → từ chối "phải sau năm nhận hạng Nhì"', () => {
    const error = validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHAT, 2020, [
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
      { danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2020 },
    ]);
    expect(error).toBe(
      'Năm nhận Huy chương Chiến sĩ vẻ vang hạng Nhất (2020) phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Nhì (2020)'
    );
  });

  it('HCCSVV (niên hạn): nhận hạng Nhất khi đã có đủ hạng Ba rồi hạng Nhì theo đúng thứ tự năm → hợp lệ', () => {
    expect(
      validateHCCSVVRankOrder(DANH_HIEU_HCCSVV.HANG_NHAT, 2025, [
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 },
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2020 },
      ])
    ).toBeNull();
  });

  it('HCCSVV (niên hạn): danh hiệu không thuộc HCCSVV (vd: CSTDCS) → bỏ qua kiểm tra thứ tự hạng', () => {
    expect(validateHCCSVVRankOrder(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, 2024, [])).toBeNull();
  });
});
