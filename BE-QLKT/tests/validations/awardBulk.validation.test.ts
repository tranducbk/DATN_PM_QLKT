import { bulkCreateAwards } from '../../src/validations/awardBulk.validation';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

describe('Kiểm tra dữ liệu tạo khen thưởng hàng loạt (chuyển chuỗi từ form multipart sang số)', () => {
  it('Đề xuất đơn vị hằng năm: năm và tháng gửi dạng chuỗi → chuyển thành số, hợp lệ', () => {
    const result = bulkCreateAwards.safeParse({
      type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: '2014',
      thang: '5',
      selected_units: JSON.stringify(['cqdv01_demo']),
      title_data: JSON.stringify([{ don_vi_id: 'cqdv01_demo', danh_hieu: 'BKBQP' }]),
      ghi_chu: '12333123',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nam).toBe(2014);
      expect(result.data.thang).toBe(5);
    }
  });

  it('Năm gửi dạng chuỗi hợp lệ → hợp lệ, không báo lỗi thiếu năm', () => {
    const result = bulkCreateAwards.safeParse({
      type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: '2024',
      selected_units: JSON.stringify(['u1']),
      title_data: JSON.stringify([{ don_vi_id: 'u1', danh_hieu: 'BKBQP' }]),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages).not.toContain('nam là bắt buộc');
    }
  });

  it('Loại bắt buộc nhập tháng (niên hạn): tháng gửi chuỗi "6" → chuyển thành số 6, hợp lệ', () => {
    const result = bulkCreateAwards.safeParse({
      type: PROPOSAL_TYPES.NIEN_HAN,
      nam: '2024',
      thang: '6',
      selected_personnel: JSON.stringify(['p1']),
      title_data: JSON.stringify([{ personnel_id: 'p1', danh_hieu: 'HC_CSVV_HANG_BA' }]),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thang).toBe(6);
    }
  });

  it('Loại bắt buộc nhập tháng (niên hạn) thiếu tháng → không hợp lệ, báo "thang là bắt buộc cho loại đề xuất này"', () => {
    const result = bulkCreateAwards.safeParse({
      type: PROPOSAL_TYPES.NIEN_HAN,
      nam: '2024',
      selected_personnel: JSON.stringify(['p1']),
      title_data: JSON.stringify([{ personnel_id: 'p1', danh_hieu: 'HC_CSVV_HANG_BA' }]),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages).toContain('thang là bắt buộc cho loại đề xuất này');
    }
  });

  it('Loại không cần tháng (đơn vị hằng năm) thiếu tháng → vẫn hợp lệ', () => {
    const result = bulkCreateAwards.safeParse({
      type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: '2024',
      selected_units: JSON.stringify(['u1']),
      title_data: JSON.stringify([{ don_vi_id: 'u1', danh_hieu: 'BKBQP' }]),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thang).toBeUndefined();
    }
  });

  it('Tháng gửi chuỗi "undefined"/"null" → coi như để trống, hợp lệ với loại không cần tháng', () => {
    const result = bulkCreateAwards.safeParse({
      type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: '2024',
      thang: 'undefined',
      selected_units: JSON.stringify(['u1']),
      title_data: JSON.stringify([{ don_vi_id: 'u1', danh_hieu: 'BKBQP' }]),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thang).toBeUndefined();
    }
  });
});
