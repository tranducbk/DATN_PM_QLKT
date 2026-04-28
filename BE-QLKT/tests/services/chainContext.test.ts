import {
  computeChainContext,
  lastFlagYearInChain,
} from '../../src/services/profile/annual';
import type { DanhHieuHangNam } from '../../src/generated/prisma';

function row(
  nam: number,
  flags: Partial<Pick<DanhHieuHangNam, 'nhan_bkbqp' | 'nhan_cstdtq' | 'nhan_bkttcp'>> = {}
): DanhHieuHangNam {
  return {
    nam,
    nhan_bkbqp: flags.nhan_bkbqp ?? false,
    nhan_cstdtq: flags.nhan_cstdtq ?? false,
    nhan_bkttcp: flags.nhan_bkttcp ?? false,
  } as unknown as DanhHieuHangNam;
}

describe('lastFlagYearInChain', () => {
  it('trả null khi không flag nào trong chuỗi', () => {
    const list = [row(2020), row(2021), row(2022)];
    expect(lastFlagYearInChain(list, 'nhan_bkbqp', 2020, 2023)).toBeNull();
  });

  it('trả năm gần nhất có flag trong [chainStart, year-1]', () => {
    const list = [row(2020, { nhan_bkbqp: true }), row(2022, { nhan_bkbqp: true }), row(2023)];
    expect(lastFlagYearInChain(list, 'nhan_bkbqp', 2020, 2024)).toBe(2022);
  });

  it('bỏ qua flag năm ngoài chuỗi (trước chainStart)', () => {
    const list = [row(2015, { nhan_bkbqp: true }), row(2022, { nhan_bkbqp: true })];
    expect(lastFlagYearInChain(list, 'nhan_bkbqp', 2020, 2024)).toBe(2022);
  });

  it('bỏ qua flag năm >= year', () => {
    const list = [row(2022, { nhan_bkbqp: true }), row(2024, { nhan_bkbqp: true })];
    expect(lastFlagYearInChain(list, 'nhan_bkbqp', 2020, 2024)).toBe(2022);
  });
});

describe('computeChainContext - chain start year', () => {
  it('streak=5 tại year=2025 → chainStartYear=2020', () => {
    const list = [2020, 2021, 2022, 2023, 2024].map(y => row(y));
    const ctx = computeChainContext(list, 5, 2025);
    expect(ctx.chainStartYear).toBe(2020);
  });

  it('streak=0 → chainStartYear=year', () => {
    const ctx = computeChainContext([], 0, 2025);
    expect(ctx.chainStartYear).toBe(2025);
  });
});

describe('computeChainContext - BKBQP cycle khi chưa từng nhận', () => {
  it('streak=2 chưa nhận → streakSinceLastBkbqp=2, missed=0', () => {
    const list = [row(2023), row(2024)];
    const ctx = computeChainContext(list, 2, 2025);
    expect(ctx.lastBkbqpYear).toBeNull();
    expect(ctx.streakSinceLastBkbqp).toBe(2);
    expect(ctx.missedBkbqp).toBe(0);
  });

  it('streak=3 chưa nhận → đã lỡ 1 đợt', () => {
    const list = [row(2022), row(2023), row(2024)];
    const ctx = computeChainContext(list, 3, 2025);
    expect(ctx.streakSinceLastBkbqp).toBe(3);
    expect(ctx.missedBkbqp).toBe(1);
  });

  it('streak=4 chưa nhận → đỉnh chu kỳ thứ 2, đã lỡ 1 đợt', () => {
    const list = [row(2021), row(2022), row(2023), row(2024)];
    const ctx = computeChainContext(list, 4, 2025);
    expect(ctx.streakSinceLastBkbqp).toBe(4);
    expect(ctx.missedBkbqp).toBe(1);
  });

  it('streak=6 chưa nhận → đỉnh chu kỳ thứ 3, đã lỡ 2 đợt', () => {
    const list = [2019, 2020, 2021, 2022, 2023, 2024].map(y => row(y));
    const ctx = computeChainContext(list, 6, 2025);
    expect(ctx.streakSinceLastBkbqp).toBe(6);
    expect(ctx.missedBkbqp).toBe(2);
  });
});

describe('computeChainContext - BKBQP cycle sau khi đã nhận', () => {
  it('BKBQP tại năm cuối chu kỳ 1 (2021) → streakSinceLast tính từ năm 2022', () => {
    const list = [row(2020), row(2021, { nhan_bkbqp: true }), row(2022), row(2023)];
    const ctx = computeChainContext(list, 4, 2024);
    expect(ctx.lastBkbqpYear).toBe(2021);
    expect(ctx.streakSinceLastBkbqp).toBe(2);
    expect(ctx.missedBkbqp).toBe(0);
  });

  it('BKBQP tại 2021, đã đi qua 1 đợt năm 2024 không nhận → missed=1 tại year=2025', () => {
    const list = [row(2020), row(2021, { nhan_bkbqp: true }), row(2022), row(2023), row(2024)];
    const ctx = computeChainContext(list, 5, 2025);
    expect(ctx.streakSinceLastBkbqp).toBe(3);
    expect(ctx.missedBkbqp).toBe(1);
  });

  it('BKBQP cũ ngoài chuỗi (2015) → coi như chưa nhận trong chuỗi 2020-2024', () => {
    const list = [
      row(2015, { nhan_bkbqp: true }),
      row(2020),
      row(2021),
      row(2022),
      row(2023),
      row(2024),
    ];
    const ctx = computeChainContext(list, 5, 2025);
    expect(ctx.lastBkbqpYear).toBeNull();
    expect(ctx.streakSinceLastBkbqp).toBe(5);
  });
});

describe('computeChainContext - CSTDTQ cycle counting', () => {
  it('streak=3 chưa nhận CSTDTQ → streakSinceLast=3, missed=0', () => {
    const list = [row(2022), row(2023), row(2024)];
    const ctx = computeChainContext(list, 3, 2025);
    expect(ctx.streakSinceLastCstdtq).toBe(3);
    expect(ctx.missedCstdtq).toBe(0);
  });

  it('streak=4 chưa nhận CSTDTQ → đã lỡ 1 đợt', () => {
    const list = [row(2021), row(2022), row(2023), row(2024)];
    const ctx = computeChainContext(list, 4, 2025);
    expect(ctx.missedCstdtq).toBe(1);
  });

  it('streak=6 chưa nhận → đỉnh chu kỳ 2, missed=1', () => {
    const list = [2019, 2020, 2021, 2022, 2023, 2024].map(y => row(y));
    const ctx = computeChainContext(list, 6, 2025);
    expect(ctx.streakSinceLastCstdtq).toBe(6);
    expect(ctx.missedCstdtq).toBe(1);
  });

  it('CSTDTQ tại 2022 (chu kỳ 1 = năm 2020-2022), đến năm 2025 → streakSinceLast=2 (chu kỳ 2 mới đi 2 năm)', () => {
    const list = [
      row(2020),
      row(2021),
      row(2022, { nhan_cstdtq: true }),
      row(2023),
      row(2024),
    ];
    const ctx = computeChainContext(list, 5, 2025);
    expect(ctx.lastCstdtqYear).toBe(2022);
    expect(ctx.streakSinceLastCstdtq).toBe(2);
    expect(ctx.missedCstdtq).toBe(0);
  });
});

describe('computeChainContext - BKTTCP cycle', () => {
  it('streak=7 chưa nhận → streakSinceLastBkttcp=7', () => {
    const list = [2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => row(y));
    const ctx = computeChainContext(list, 7, 2025);
    expect(ctx.lastBkttcpYear).toBeNull();
    expect(ctx.streakSinceLastBkttcp).toBe(7);
  });

  it('BKTTCP cũ ngoài chuỗi (2010) → coi như chưa nhận trong chuỗi 2018-2024', () => {
    const list = [row(2010, { nhan_bkttcp: true }), ...[2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => row(y))];
    const ctx = computeChainContext(list, 7, 2025);
    expect(ctx.lastBkttcpYear).toBeNull();
    expect(ctx.streakSinceLastBkttcp).toBe(7);
  });
});
