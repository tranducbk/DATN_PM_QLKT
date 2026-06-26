import { formatDate } from '../../src/helpers/datetimeHelper';

describe('Định dạng ngày theo DD-MM-YYYY (formatDate)', () => {
  it('Đối tượng Date → trả chuỗi ngày dạng DD-MM-YYYY', () => {
    expect(formatDate(new Date(2024, 2, 5))).toBe('05-03-2024');
  });

  it('Chuỗi ngày → định dạng DD-MM-YYYY, thêm số 0 cho ngày/tháng nhỏ hơn 10', () => {
    // Noon-local avoids any timezone day-shift.
    expect(formatDate('2024-01-09T12:00:00')).toBe('09-01-2024');
  });

  it.each([null, undefined, '', 'không-phải-ngày'])(
    'Giá trị rỗng hoặc không phải ngày hợp lệ → trả chuỗi rỗng (%s)',
    value => {
      expect(formatDate(value)).toBe('');
    }
  );
});
