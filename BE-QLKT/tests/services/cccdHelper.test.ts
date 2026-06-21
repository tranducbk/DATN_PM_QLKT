import { parseCCCD } from '../../src/helpers/cccdHelper';

describe('parseCCCD', () => {
  it.each([
    ['123', '000000000123'],
    ['1', '000000000001'],
    ['99999999999', '099999999999'],
  ])('pad trái số 0 cho chuỗi số ngắn hơn 12 chữ số: %s → %s', (input, expected) => {
    expect(parseCCCD(input)).toBe(expected);
  });

  it('giữ nguyên khi đã đủ 12 chữ số', () => {
    expect(parseCCCD('123456789012')).toBe('123456789012');
  });

  it('giữ nguyên khi dài hơn 12 chữ số (không cắt)', () => {
    expect(parseCCCD('1234567890123')).toBe('1234567890123');
  });

  it('trim khoảng trắng trước khi xử lý', () => {
    expect(parseCCCD('  123  ')).toBe('000000000123');
  });

  it('không pad khi chứa ký tự không phải chữ số', () => {
    expect(parseCCCD('12a')).toBe('12a');
    expect(parseCCCD('12 34')).toBe('12 34');
  });
});
