import {
  aggregatePositionMonthsByGroup,
  classifyHeSoGroup,
  sumMonthsByGroup,
} from '../../src/services/eligibility/congHienMonthsAggregator';
import { CONG_HIEN_HE_SO_GROUPS } from '../../src/constants/danhHieu.constants';

describe('classifyHeSoGroup', () => {
  it('returns LEVEL_07 for [0.7, 0.8)', () => {
    expect(classifyHeSoGroup(0.7)).toBe(CONG_HIEN_HE_SO_GROUPS.LEVEL_07);
    expect(classifyHeSoGroup(0.79)).toBe(CONG_HIEN_HE_SO_GROUPS.LEVEL_07);
  });

  it('returns LEVEL_08 for [0.8, 0.9)', () => {
    expect(classifyHeSoGroup(0.8)).toBe(CONG_HIEN_HE_SO_GROUPS.LEVEL_08);
    expect(classifyHeSoGroup(0.89)).toBe(CONG_HIEN_HE_SO_GROUPS.LEVEL_08);
  });

  it('returns LEVEL_09_10 for [0.9, 1.0]', () => {
    expect(classifyHeSoGroup(0.9)).toBe(CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10);
    expect(classifyHeSoGroup(1.0)).toBe(CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10);
  });

  it('returns null for values outside known ranges', () => {
    expect(classifyHeSoGroup(0.5)).toBeNull();
    expect(classifyHeSoGroup(1.5)).toBeNull();
  });
});

describe('sumMonthsByGroup', () => {
  it('aggregates months by group ignoring nulls', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: 0.7, so_thang: 12 },
      { he_so_chuc_vu: 0.8, so_thang: 24 },
      { he_so_chuc_vu: 0.9, so_thang: 6 },
      { he_so_chuc_vu: 0.95, so_thang: 18 },
      { he_so_chuc_vu: 0.5, so_thang: 100 },
      { he_so_chuc_vu: 0.7, so_thang: null },
    ]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(12);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(24);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(24);
  });

  it('returns zeros for empty input', () => {
    const totals = sumMonthsByGroup([]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(0);
  });
});

describe('aggregatePositionMonthsByGroup', () => {
  it('recomputes so_thang from ngay_bat_dau / ngay_ket_thuc up to cutoff', () => {
    const cutoff = new Date(2025, 11, 31);
    const totals = aggregatePositionMonthsByGroup(
      [
        {
          he_so_chuc_vu: 0.9,
          so_thang: 999,
          ngay_bat_dau: new Date(2024, 0, 1),
          ngay_ket_thuc: new Date(2024, 11, 31),
        },
      ],
      cutoff
    );
    // Recalculated covered months should fall close to 12 — far from the stale 999.
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBeGreaterThan(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBeLessThan(20);
  });
});
