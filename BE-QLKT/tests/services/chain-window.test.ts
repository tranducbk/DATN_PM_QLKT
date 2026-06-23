import { countFlagInWindow } from '../../src/services/eligibility/chainEligibility';

const FLAG = 'nhan_bkbqp';
const row = (nam: number, flag: unknown = true) => ({ nam, [FLAG]: flag });

describe('Xét điều kiện chuỗi danh hiệu: đếm cờ trong cửa sổ N năm gần nhất (từ năm-N tới năm-1)', () => {
  it('Xét điều kiện chuỗi danh hiệu: đếm số cờ trong cửa sổ 3 năm gần nhất (CSTDTQ), mốc năm 2026 → tính các năm 2023-2025', () => {
    expect(countFlagInWindow([row(2023), row(2024), row(2025)], 2026, 3, FLAG)).toBe(3);
  });

  it('Xét điều kiện chuỗi danh hiệu: biên gần nhất — tính năm liền trước (năm-1), loại năm hiện tại', () => {
    expect(countFlagInWindow([row(2025)], 2026, 3, FLAG)).toBe(1);
    expect(countFlagInWindow([row(2026)], 2026, 3, FLAG)).toBe(0);
  });

  it('Xét điều kiện chuỗi danh hiệu: biên xa nhất — tính đúng năm đầu cửa sổ, loại năm trước đó (không lệch 1 năm)', () => {
    expect(countFlagInWindow([row(2023)], 2026, 3, FLAG)).toBe(1);
    expect(countFlagInWindow([row(2022)], 2026, 3, FLAG)).toBe(0);
  });

  it('Xét điều kiện chuỗi danh hiệu: cờ của các năm tương lai (sau mốc năm) không được tính', () => {
    expect(countFlagInWindow([row(2027), row(2030)], 2026, 3, FLAG)).toBe(0);
  });

  it('Xét điều kiện chuỗi danh hiệu: chỉ đếm cờ bật đúng nghĩa, bỏ qua cờ tắt/thiếu/giá trị không hợp lệ', () => {
    expect(countFlagInWindow([row(2024, false), { nam: 2024 }], 2026, 3, FLAG)).toBe(0);
    expect(countFlagInWindow([row(2024, 1)], 2026, 3, FLAG)).toBe(0);
    expect(countFlagInWindow([row(2024, 'true')], 2026, 3, FLAG)).toBe(0);
  });

  it('Xét điều kiện chuỗi danh hiệu: cửa sổ 7 năm gần nhất (BKTTCP), mốc năm 2026 → tính các năm 2019-2025 (loại 2018)', () => {
    expect(countFlagInWindow([row(2019)], 2026, 7, FLAG)).toBe(1);
    expect(countFlagInWindow([row(2018)], 2026, 7, FLAG)).toBe(0);
    expect(countFlagInWindow([row(2025)], 2026, 7, FLAG)).toBe(1);
  });

  it('Xét điều kiện chuỗi danh hiệu: BKBQP của chu kỳ trước tự rơi khỏi cửa sổ gần nhất, chỉ còn cái trong cửa sổ', () => {
    // [2023,2025] tại 2026: BKBQP năm 2022 (chu kỳ trước) rớt ra, chỉ còn 2024
    expect(countFlagInWindow([row(2022), row(2024)], 2026, 3, FLAG)).toBe(1);
  });
});
