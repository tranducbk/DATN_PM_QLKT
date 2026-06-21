import {
  calculateServiceMonths,
  calculateTenureMonthsWithDayPrecision,
  recalcPositionMonths,
  buildCutoffDate,
  formatServiceDuration,
  durationToMonths,
} from '../../src/helpers/serviceYearsHelper';

describe('calculateServiceMonths', () => {
  it('đếm số tháng tròn theo lịch, bỏ qua ngày trong tháng', () => {
    expect(calculateServiceMonths(new Date(2020, 0, 1), new Date(2021, 0, 1))).toBe(12);
    expect(calculateServiceMonths(new Date(2020, 0, 15), new Date(2020, 3, 10))).toBe(3);
  });

  it('trả 0 khi end trước start (không trả số âm)', () => {
    expect(calculateServiceMonths(new Date(2021, 0, 1), new Date(2020, 0, 1))).toBe(0);
  });
});

describe('calculateTenureMonthsWithDayPrecision', () => {
  it('trừ 1 tháng khi ngày kết thúc nhỏ hơn ngày bắt đầu', () => {
    expect(
      calculateTenureMonthsWithDayPrecision(new Date(2020, 0, 15), new Date(2020, 3, 10))
    ).toBe(2);
  });

  it('giữ nguyên khi ngày kết thúc >= ngày bắt đầu', () => {
    expect(
      calculateTenureMonthsWithDayPrecision(new Date(2020, 0, 10), new Date(2020, 3, 15))
    ).toBe(3);
  });

  it('trả 0 khi end trước start', () => {
    expect(
      calculateTenureMonthsWithDayPrecision(new Date(2020, 3, 1), new Date(2020, 0, 1))
    ).toBe(0);
  });
});

interface PosHist {
  ngay_bat_dau: Date | null;
  ngay_ket_thuc?: Date | null;
  so_thang?: number | null;
  [key: string]: unknown;
}

describe('recalcPositionMonths', () => {
  it('chốt mốc đang mở (ngay_ket_thuc null) tại cutoffDate', () => {
    const histories: PosHist[] = [{ ngay_bat_dau: new Date(2020, 0, 1), ngay_ket_thuc: null }];
    const out = recalcPositionMonths(histories, new Date(2020, 6, 1));
    expect(out[0].so_thang).toBe(6);
  });

  it('cắt mốc đã đóng kết thúc sau cutoff về đúng cutoff', () => {
    const histories: PosHist[] = [
      { ngay_bat_dau: new Date(2020, 0, 1), ngay_ket_thuc: new Date(2021, 0, 1) },
    ];
    const out = recalcPositionMonths(histories, new Date(2020, 6, 1));
    expect(out[0].so_thang).toBe(6);
  });

  it('giữ nguyên (không sửa) item thiếu ngay_bat_dau', () => {
    const item: PosHist = { ngay_bat_dau: null, so_thang: 99 };
    const out = recalcPositionMonths([item], new Date(2020, 6, 1));
    expect(out[0]).toBe(item);
  });
});

describe('buildCutoffDate', () => {
  it('trả ngày cuối tháng từ nam + thang (tháng 2/2024 nhuận → 29)', () => {
    const d = buildCutoffDate(2024, 2);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  it('thang null → dùng thời điểm hiện tại', () => {
    const before = Date.now();
    const d = buildCutoffDate(2024, null);
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('formatServiceDuration', () => {
  it.each([
    [0, '0 tháng'],
    [5, '5 tháng'],
    [12, '1 năm'],
    [13, '1 năm 1 tháng'],
    [24, '2 năm'],
    [27, '2 năm 3 tháng'],
  ])('%i tháng → "%s"', (months, expected) => {
    expect(formatServiceDuration(months)).toBe(expected);
  });
});

describe('durationToMonths', () => {
  it('object aggregate → years*12 + months (thiếu trường coi như 0)', () => {
    expect(durationToMonths({ years: 2, months: 3 })).toBe(27);
    expect(durationToMonths({ years: 1 })).toBe(12);
    expect(durationToMonths({ months: 5 })).toBe(5);
  });

  it('number → giữ nguyên', () => {
    expect(durationToMonths(18)).toBe(18);
  });

  it('JSON string hợp lệ → tổng tháng', () => {
    expect(durationToMonths('{"years":1,"months":6}')).toBe(18);
  });

  it('chuỗi không phải JSON → trả nguyên chuỗi (không ném lỗi)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(durationToMonths('không-phải-json')).toBe('không-phải-json');
    spy.mockRestore();
  });

  it.each([null, undefined, ''])('giá trị rỗng (%s) → ""', value => {
    expect(durationToMonths(value)).toBe('');
  });
});
