import { formatDate } from '../../src/helpers/datetimeHelper';

describe('formatDate (DD-MM-YYYY)', () => {
  it('format Date object', () => {
    expect(formatDate(new Date(2024, 2, 5))).toBe('05-03-2024');
  });

  it('format chuỗi ngày, pad ngày/tháng nhỏ hơn 10', () => {
    // Noon-local avoids any timezone day-shift.
    expect(formatDate('2024-01-09T12:00:00')).toBe('09-01-2024');
  });

  it.each([null, undefined, '', 'không-phải-ngày'])(
    'giá trị rỗng/không hợp lệ → "" (%s)',
    value => {
      expect(formatDate(value)).toBe('');
    }
  );
});
