import { countFlagInWindow } from '../../src/services/eligibility/chainEligibility';

const FLAG = 'nhan_bkbqp';
const row = (nam: number, flag: unknown = true) => ({ nam, [FLAG]: flag });

describe('countFlagInWindow — cửa sổ trượt [year-rangeYears, year-1]', () => {
  it('đếm số cờ true trong cửa sổ 3 năm (CSTDTQ): anchor 2026 → [2023, 2025]', () => {
    expect(countFlagInWindow([row(2023), row(2024), row(2025)], 2026, 3, FLAG)).toBe(3);
  });

  it('biên mới nhất: năm year-1 được tính, năm year (hiện tại) bị loại', () => {
    expect(countFlagInWindow([row(2025)], 2026, 3, FLAG)).toBe(1);
    expect(countFlagInWindow([row(2026)], 2026, 3, FLAG)).toBe(0);
  });

  it('biên cũ nhất: năm year-rangeYears được tính, year-rangeYears-1 bị loại (off-by-one)', () => {
    expect(countFlagInWindow([row(2023)], 2026, 3, FLAG)).toBe(1);
    expect(countFlagInWindow([row(2022)], 2026, 3, FLAG)).toBe(0);
  });

  it('cờ năm tương lai (> year) không được tính', () => {
    expect(countFlagInWindow([row(2027), row(2030)], 2026, 3, FLAG)).toBe(0);
  });

  it('chỉ đếm cờ === true — false/thiếu/giá trị truthy khác đều bỏ', () => {
    expect(countFlagInWindow([row(2024, false), { nam: 2024 }], 2026, 3, FLAG)).toBe(0);
    expect(countFlagInWindow([row(2024, 1)], 2026, 3, FLAG)).toBe(0);
    expect(countFlagInWindow([row(2024, 'true')], 2026, 3, FLAG)).toBe(0);
  });

  it('cửa sổ 7 năm (BKTTCP): anchor 2026 → [2019, 2025], year-7 in, year-8 out', () => {
    expect(countFlagInWindow([row(2019)], 2026, 7, FLAG)).toBe(1);
    expect(countFlagInWindow([row(2018)], 2026, 7, FLAG)).toBe(0);
    expect(countFlagInWindow([row(2025)], 2026, 7, FLAG)).toBe(1);
  });

  it('BKBQP của chu kỳ trước tự rơi khỏi cửa sổ trượt', () => {
    // [2023,2025] tại 2026: BKBQP năm 2022 (chu kỳ trước) rớt ra, chỉ còn 2024
    expect(countFlagInWindow([row(2022), row(2024)], 2026, 3, FLAG)).toBe(1);
  });
});
