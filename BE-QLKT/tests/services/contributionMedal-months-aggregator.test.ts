import {
  aggregatePositionMonthsByGroup,
  classifyCoefficientGroup,
  sumMonthsByGroup,
} from '../../src/services/eligibility/contributionMonthsAggregator';
import { CONTRIBUTION_COEFFICIENT_GROUPS } from '../../src/constants/danhHieu.constants';

describe('HCBVTQ (cống hiến): phân nhóm hệ số chức vụ', () => {
  const cases: Array<[number, string | null]> = [
    [0, null],
    [0.1, null],
    [0.2, null],
    [0.3, null],
    [0.4, null],
    [0.5, null],
    [0.6, null],
    [0.7, CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07],
    [0.8, CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08],
    [0.9, CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10],
    [1.0, CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10],
  ];

  it.each(cases)('HCBVTQ (cống hiến): hệ số chức vụ %p → nhóm hệ số %p', (heSo, expected) => {
    expect(classifyCoefficientGroup(heSo)).toBe(expected);
  });

  it('HCBVTQ (cống hiến): hệ số chức vụ ngoài khoảng 0..1 → không thuộc nhóm nào', () => {
    expect(classifyCoefficientGroup(-1)).toBeNull();
    expect(classifyCoefficientGroup(-0.1)).toBeNull();
    expect(classifyCoefficientGroup(1.1)).toBeNull();
    expect(classifyCoefficientGroup(1.5)).toBeNull();
  });
});

describe('HCBVTQ (cống hiến): gộp tổng số tháng phục vụ theo nhóm hệ số', () => {
  it('HCBVTQ (cống hiến): cộng số tháng theo từng nhóm hệ số, bỏ qua dòng số tháng rỗng', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: 0.7, so_thang: 12 },
      { he_so_chuc_vu: 0.8, so_thang: 24 },
      { he_so_chuc_vu: 0.9, so_thang: 6 },
      { he_so_chuc_vu: 0.5, so_thang: 100 },
      { he_so_chuc_vu: 0.7, so_thang: null },
    ]);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]).toBe(12);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]).toBe(24);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(6);
  });

  it('HCBVTQ (cống hiến): nhóm 0.9-1.0 gộp cả dòng hệ số 0.9 lẫn 1.0', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: 0.9, so_thang: 10 },
      { he_so_chuc_vu: 1.0, so_thang: 5 },
    ]);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(15);
  });

  it('HCBVTQ (cống hiến): hệ số chức vụ và số tháng dạng chuỗi → tự chuyển sang số rồi gộp', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: '0.9' as unknown as number, so_thang: '12' as unknown as number },
    ]);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(12);
  });

  it('HCBVTQ (cống hiến): bỏ qua dòng có hệ số chức vụ dưới 0.7 (không tính số tháng phục vụ)', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: 0, so_thang: 12 },
      { he_so_chuc_vu: 0.3, so_thang: 24 },
      { he_so_chuc_vu: 0.6, so_thang: 36 },
    ]);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(0);
  });

  it('HCBVTQ (cống hiến): bỏ qua dòng không có hệ số chức vụ', () => {
    const totals = sumMonthsByGroup([
      { he_so_chuc_vu: null, so_thang: 12 },
      { he_so_chuc_vu: undefined, so_thang: 24 },
    ]);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(0);
  });

  it('HCBVTQ (cống hiến): không có dòng nào → mọi nhóm hệ số đều 0 tháng', () => {
    const totals = sumMonthsByGroup([]);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(0);
  });
});

describe('HCBVTQ (cống hiến): gộp số tháng phục vụ tính lại từ ngày bắt đầu/kết thúc chức vụ', () => {
  it('HCBVTQ (cống hiến): tính lại số tháng theo ngày bắt đầu/kết thúc, bỏ qua số tháng cũ sai lệch', () => {
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
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(11);
  });

  it('HCBVTQ (cống hiến): chức vụ chưa kết thúc → tính số tháng đến mốc thời điểm chốt', () => {
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
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]).toBe(11);
  });

  it('HCBVTQ (cống hiến): chức vụ kết thúc sau mốc chốt → chỉ tính số tháng đến mốc chốt', () => {
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
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]).toBe(5);
  });

  it('HCBVTQ (cống hiến): mốc chốt trước cả ngày bắt đầu chức vụ → tính 0 tháng', () => {
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
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(0);
  });

  it('HCBVTQ (cống hiến): gộp số tháng của nhiều chức vụ trải đều các nhóm hệ số', () => {
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
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]).toBe(5);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]).toBe(5);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(11);
  });

  it('HCBVTQ (cống hiến): không có lịch sử chức vụ nào → mọi nhóm hệ số đều 0 tháng', () => {
    const totals = aggregatePositionMonthsByGroup([], new Date(2025, 11, 31));
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]).toBe(0);
    expect(totals[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]).toBe(0);
  });
});
