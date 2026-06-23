import {
  calculateServiceMonths,
  calculateTenureMonthsWithDayPrecision,
  recalcPositionMonths,
  buildCutoffDate,
  formatServiceDuration,
  durationToMonths,
} from '../../src/helpers/serviceYearsHelper';

describe('Tính thời gian phục vụ: đếm số tháng tròn theo lịch (calculateServiceMonths)', () => {
  it('Tính số tháng tròn theo lịch, bỏ qua ngày trong tháng', () => {
    expect(calculateServiceMonths(new Date(2020, 0, 1), new Date(2021, 0, 1))).toBe(12);
    expect(calculateServiceMonths(new Date(2020, 0, 15), new Date(2020, 3, 10))).toBe(3);
  });

  it('Ngày kết thúc trước ngày bắt đầu → trả 0, không trả số âm', () => {
    expect(calculateServiceMonths(new Date(2021, 0, 1), new Date(2020, 0, 1))).toBe(0);
  });
});

describe('Tính thời gian phục vụ: đếm số tháng có xét chính xác đến ngày (calculateTenureMonthsWithDayPrecision)', () => {
  it('Ngày trong tháng kết thúc nhỏ hơn ngày bắt đầu → trừ bớt 1 tháng', () => {
    expect(
      calculateTenureMonthsWithDayPrecision(new Date(2020, 0, 15), new Date(2020, 3, 10))
    ).toBe(2);
  });

  it('Ngày trong tháng kết thúc lớn hơn hoặc bằng ngày bắt đầu → giữ nguyên số tháng', () => {
    expect(
      calculateTenureMonthsWithDayPrecision(new Date(2020, 0, 10), new Date(2020, 3, 15))
    ).toBe(3);
  });

  it('Ngày kết thúc trước ngày bắt đầu → trả 0', () => {
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

describe('Tính thời gian phục vụ: tính lại số tháng giữ chức vụ đến mốc thời gian (recalcPositionMonths)', () => {
  it('Mốc chức vụ đang mở (chưa có ngày kết thúc) → tính số tháng đến ngày chốt', () => {
    const histories: PosHist[] = [{ ngay_bat_dau: new Date(2020, 0, 1), ngay_ket_thuc: null }];
    const out = recalcPositionMonths(histories, new Date(2020, 6, 1));
    expect(out[0].so_thang).toBe(6);
  });

  it('Mốc đã đóng nhưng kết thúc sau ngày chốt → cắt về đúng ngày chốt', () => {
    const histories: PosHist[] = [
      { ngay_bat_dau: new Date(2020, 0, 1), ngay_ket_thuc: new Date(2021, 0, 1) },
    ];
    const out = recalcPositionMonths(histories, new Date(2020, 6, 1));
    expect(out[0].so_thang).toBe(6);
  });

  it('Mốc thiếu ngày bắt đầu → giữ nguyên, không tính lại', () => {
    const item: PosHist = { ngay_bat_dau: null, so_thang: 99 };
    const out = recalcPositionMonths([item], new Date(2020, 6, 1));
    expect(out[0]).toBe(item);
  });
});

describe('Tính thời gian phục vụ: xác định ngày chốt từ năm + tháng (buildCutoffDate)', () => {
  it('Có năm và tháng → lấy ngày cuối tháng (tháng 2/2024 năm nhuận → ngày 29)', () => {
    const d = buildCutoffDate(2024, 2);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  it('Không truyền tháng → dùng thời điểm hiện tại', () => {
    const before = Date.now();
    const d = buildCutoffDate(2024, null);
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('Tính thời gian phục vụ: hiển thị tổng số tháng thành "năm tháng" (formatServiceDuration)', () => {
  it.each([
    [0, '0 tháng'],
    [5, '5 tháng'],
    [12, '1 năm'],
    [13, '1 năm 1 tháng'],
    [24, '2 năm'],
    [27, '2 năm 3 tháng'],
  ])('%i tháng → hiển thị "%s"', (months, expected) => {
    expect(formatServiceDuration(months)).toBe(expected);
  });
});

describe('Tính thời gian phục vụ: quy đổi thời lượng về tổng số tháng (durationToMonths)', () => {
  it('Đối tượng { years, months } → years*12 + months (thiếu trường coi như 0)', () => {
    expect(durationToMonths({ years: 2, months: 3 })).toBe(27);
    expect(durationToMonths({ years: 1 })).toBe(12);
    expect(durationToMonths({ months: 5 })).toBe(5);
  });

  it('Đầu vào là số → giữ nguyên', () => {
    expect(durationToMonths(18)).toBe(18);
  });

  it('Chuỗi JSON hợp lệ → quy đổi ra tổng số tháng', () => {
    expect(durationToMonths('{"years":1,"months":6}')).toBe(18);
  });

  it('Chuỗi không phải JSON → trả nguyên chuỗi, không ném lỗi', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(durationToMonths('không-phải-json')).toBe('không-phải-json');
    spy.mockRestore();
  });

  it.each([null, undefined, ''])('Giá trị rỗng (%s) → trả chuỗi rỗng', value => {
    expect(durationToMonths(value)).toBe('');
  });
});
