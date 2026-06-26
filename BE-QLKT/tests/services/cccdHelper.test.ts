import { parseCCCD } from '../../src/helpers/cccdHelper';

describe('Chuẩn hóa số CCCD (parseCCCD)', () => {
  it.each([
    ['123', '000000000123'],
    ['1', '000000000001'],
    ['99999999999', '099999999999'],
  ])('Chuỗi số ít hơn 12 chữ số → thêm số 0 vào đầu cho đủ 12 chữ số: %s → %s', (input, expected) => {
    expect(parseCCCD(input)).toBe(expected);
  });

  it('Chuỗi đã đủ 12 chữ số → giữ nguyên', () => {
    expect(parseCCCD('123456789012')).toBe('123456789012');
  });

  it('Chuỗi dài hơn 12 chữ số → giữ nguyên, không cắt bớt', () => {
    expect(parseCCCD('1234567890123')).toBe('1234567890123');
  });

  it('Chuỗi có khoảng trắng đầu/cuối → cắt khoảng trắng rồi mới chuẩn hóa', () => {
    expect(parseCCCD('  123  ')).toBe('000000000123');
  });

  it('Chuỗi chứa ký tự không phải số → giữ nguyên, không thêm số 0', () => {
    expect(parseCCCD('12a')).toBe('12a');
    expect(parseCCCD('12 34')).toBe('12 34');
  });
});
