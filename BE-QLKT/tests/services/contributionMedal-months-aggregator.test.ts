import {
  aggregatePositionMonthsByGroup,
  classifyHeSoGroup,
  sumMonthsByGroup,
} from '../../src/services/eligibility/congHienMonthsAggregator';
import { CONG_HIEN_HE_SO_GROUPS } from '../../src/constants/danhHieu.constants';

describe('classifyHeSoGroup', () => {
  const cases: Array<[number, string | null]> = [
    [0, null],
    [0.1, null],
    [0.2, null],
    [0.3, null],
    [0.4, null],
    [0.5, null],
    [0.6, null],
    [0.7, CONG_HIEN_HE_SO_GROUPS.LEVEL_07],
    [0.8, CONG_HIEN_HE_SO_GROUPS.LEVEL_08],
    [0.9, CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10],
    [1.0, CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10],
  ];

  it.each(cases)('classifies hệ số %p → %p', (heSo, expected) => {
    expect(classifyHeSoGroup(heSo)).toBe(expected);
  });

  it('returns null for values outside the 0..1 range', () => {
    expect(classifyHeSoGroup(-1)).toBeNull();
    expect(classifyHeSoGroup(-0.1)).toBeNull();
    expect(classifyHeSoGroup(1.1)).toBeNull();
    expect(classifyHeSoGroup(1.5)).toBeNull();
  });
});

describe('sumMonthsByGroup', () => {
  it('aggregates months by group ignoring nulls', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: 0.7, so_thang: 12 },
      { he_so_chuc_vu: 0.8, so_thang: 24 },
      { he_so_chuc_vu: 0.9, so_thang: 6 },
      { he_so_chuc_vu: 0.5, so_thang: 100 },
      { he_so_chuc_vu: 0.7, so_thang: null },
    ]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(12);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(24);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(6);
  });

  it('sums multiple rows in LEVEL_09_10 from both 0.9 and 1.0', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: 0.9, so_thang: 10 },
      { he_so_chuc_vu: 1.0, so_thang: 5 },
    ]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(15);
  });

  it('coerces string he_so_chuc_vu and so_thang to number', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: '0.9' as unknown as number, so_thang: '12' as unknown as number },
    ]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(12);
  });

  it('skips rows with he_so_chuc_vu below 0.7', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: 0, so_thang: 12 },
      { he_so_chuc_vu: 0.3, so_thang: 24 },
      { he_so_chuc_vu: 0.6, so_thang: 36 },
    ]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(0);
  });

  it('skips rows with null/undefined he_so_chuc_vu', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: null, so_thang: 12 },
      { he_so_chuc_vu: undefined, so_thang: 24 },
    ]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(0);
  });

  it('returns zeros for empty input', () => {
    const totals = sumMonthsByGroup([]);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(0);
  });
});

describe('aggregatePositionMonthsByGroup', () => {
  it('recomputes so_thang from ngay_bat_dau / ngay_ket_thuc and overrides stale value', () => {
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
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(11);
  });

  it('caps open-ended positions at cutoff date', () => {
    const cutoff = new Date(2025, 11, 31);
    const totals = aggregatePositionMonthsByGroup(
      [
        {
          he_so_chuc_vu: 0.8,
          so_thang: null,
          ngay_bat_dau: new Date(2025, 0, 1),
          ngay_ket_thuc: null,
        },
      ],
      cutoff
    );
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(11);
  });

  it('caps closed positions ending after cutoff', () => {
    const cutoff = new Date(2025, 5, 30);
    const totals = aggregatePositionMonthsByGroup(
      [
        {
          he_so_chuc_vu: 0.7,
          so_thang: null,
          ngay_bat_dau: new Date(2025, 0, 1),
          ngay_ket_thuc: new Date(2025, 11, 31),
        },
      ],
      cutoff
    );
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(5);
  });

  it('returns 0 when cutoff is before ngay_bat_dau', () => {
    const cutoff = new Date(2023, 0, 1);
    const totals = aggregatePositionMonthsByGroup(
      [
        {
          he_so_chuc_vu: 0.9,
          so_thang: null,
          ngay_bat_dau: new Date(2025, 0, 1),
          ngay_ket_thuc: null,
        },
      ],
      cutoff
    );
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(0);
  });

  it('aggregates multiple positions across all groups', () => {
    const cutoff = new Date(2025, 11, 31);
    const totals = aggregatePositionMonthsByGroup(
      [
        {
          he_so_chuc_vu: 0.7,
          so_thang: null,
          ngay_bat_dau: new Date(2024, 0, 1),
          ngay_ket_thuc: new Date(2024, 5, 30),
        },
        {
          he_so_chuc_vu: 0.8,
          so_thang: null,
          ngay_bat_dau: new Date(2024, 6, 1),
          ngay_ket_thuc: new Date(2024, 11, 31),
        },
        {
          he_so_chuc_vu: 1.0,
          so_thang: null,
          ngay_bat_dau: new Date(2025, 0, 1),
          ngay_ket_thuc: new Date(2025, 11, 31),
        },
      ],
      cutoff
    );
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(5);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(5);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(11);
  });

  it('returns zeros for empty histories', () => {
    const totals = aggregatePositionMonthsByGroup([], new Date(2025, 11, 31));
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(0);
  });
});
