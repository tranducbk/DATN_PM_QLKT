import { diffPersonnelChanges, formatPersonnelChanges } from '../../src/helpers/profileFieldDiff';

describe('So sánh thay đổi hồ sơ: phát hiện đúng trường nào đổi', () => {
  it('Không đổi gì → trả danh sách rỗng', () => {
    const record = { so_dien_thoai: '0912', cho_o_hien_nay: 'Hà Nội' };
    expect(diffPersonnelChanges(record, { ...record })).toEqual([]);
  });

  it('Đổi số điện thoại → trả đúng trường đó kèm giá trị cũ và mới', () => {
    const result = diffPersonnelChanges(
      { so_dien_thoai: '0912', cho_o_hien_nay: 'Hà Nội' },
      { so_dien_thoai: '0987', cho_o_hien_nay: 'Hà Nội' }
    );
    expect(result).toEqual([
      { key: 'so_dien_thoai', label: 'Số điện thoại', from: '0912', to: '0987' },
    ]);
  });

  it('Chỉ so sánh trường có trong dữ liệu gửi lên, bỏ qua trường không gửi', () => {
    const result = diffPersonnelChanges(
      { so_dien_thoai: '0912', cap_bac: 'Thiếu úy' },
      { so_dien_thoai: '0987' }
    );
    expect(result.map(change => change.key)).toEqual(['so_dien_thoai']);
  });

  it('null và chuỗi rỗng coi như giống nhau → không tính là đổi', () => {
    expect(diffPersonnelChanges({ tru_quan: null }, { tru_quan: '' })).toEqual([]);
  });

  it('Ngày sinh dạng Date → hiển thị DD-MM-YYYY; cùng ngày không đổi, khác ngày báo đổi', () => {
    const before = { ngay_sinh: new Date('1975-05-15T00:00:00Z') };
    expect(diffPersonnelChanges(before, { ngay_sinh: new Date('1975-05-15T00:00:00Z') })).toEqual(
      []
    );
    const changed = diffPersonnelChanges(before, { ngay_sinh: new Date('1980-01-01T00:00:00Z') });
    expect(changed[0]).toMatchObject({ key: 'ngay_sinh', from: '15-05-1975', to: '01-01-1980' });
  });
});

describe('So sánh thay đổi hồ sơ: mô tả nhật ký dạng cũ → mới', () => {
  it('Ghi dạng "Nhãn: cũ → mới", nối nhau bằng dấu phẩy', () => {
    const text = formatPersonnelChanges([
      { key: 'so_dien_thoai', label: 'Số điện thoại', from: '0912', to: '0987' },
      { key: 'cho_o_hien_nay', label: 'Chỗ ở hiện nay', from: 'Hà Nội', to: 'TP.HCM' },
    ]);
    expect(text).toBe('Số điện thoại: 0912 → 0987, Chỗ ở hiện nay: Hà Nội → TP.HCM');
  });

  it('Giá trị rỗng hiển thị "(trống)"', () => {
    const text = formatPersonnelChanges([
      { key: 'tru_quan', label: 'Trú quán', from: '', to: 'Hà Nội' },
    ]);
    expect(text).toBe('Trú quán: (trống) → Hà Nội');
  });

  it('CCCD là dữ liệu nhạy cảm → chỉ ghi nhãn, KHÔNG lộ số cũ/mới', () => {
    const text = formatPersonnelChanges([
      { key: 'cccd', label: 'CCCD', from: '001075000002', to: '001075000099' },
    ]);
    expect(text).toBe('CCCD');
    expect(text).not.toContain('001075');
  });
});
