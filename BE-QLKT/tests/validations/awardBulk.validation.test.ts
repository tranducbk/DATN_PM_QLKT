import { bulkCreateAwards } from '../../src/validations/awardBulk.validation';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

describe('awardBulk.validation - bulkCreateAwards (multipart string coercion)', () => {
  it('DON_VI_HANG_NAM: nam/thang gửi dạng string (multipart) → coerce sang number, parse thành công', () => {
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

  it('nam dạng string hợp lệ → KHÔNG còn lỗi "nam là bắt buộc"', () => {
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

  it('Loại cần tháng (NIEN_HAN) gửi thang string "6" → coerce 6, parse thành công', () => {
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

  it('Loại cần tháng (NIEN_HAN) thiếu thang → fail "thang là bắt buộc cho loại đề xuất này"', () => {
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

  it('Loại không cần tháng (DON_VI_HANG_NAM) thiếu thang → vẫn parse thành công', () => {
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

  it('thang gửi "undefined"/"null" (FE String(undefined)) → coi như rỗng, không lỗi với loại không cần tháng', () => {
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
