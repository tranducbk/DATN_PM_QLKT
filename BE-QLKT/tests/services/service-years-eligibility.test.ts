import {
  evaluateServiceYears,
  requiredServiceYears,
} from '../../src/services/eligibility/serviceYearsEligibility';
import {
  HCQKQT_YEARS_REQUIRED,
  KNC_YEARS_REQUIRED_NAM,
  KNC_YEARS_REQUIRED_NU,
} from '../../src/constants/danhHieu.constants';
import { GENDER } from '../../src/constants/gender.constants';

const REF_DATE = new Date('2026-01-01');

describe('requiredServiceYears', () => {
  it('returns 25 for HC_QKQT regardless of gender', () => {
    expect(requiredServiceYears('HC_QKQT', GENDER.MALE)).toBe(HCQKQT_YEARS_REQUIRED);
    expect(requiredServiceYears('HC_QKQT', GENDER.FEMALE)).toBe(HCQKQT_YEARS_REQUIRED);
    expect(requiredServiceYears('HC_QKQT', null)).toBe(HCQKQT_YEARS_REQUIRED);
  });

  it('returns 25 for KNC nam, 20 for KNC nu', () => {
    expect(requiredServiceYears('KNC_VSNXD_QDNDVN', GENDER.MALE)).toBe(KNC_YEARS_REQUIRED_NAM);
    expect(requiredServiceYears('KNC_VSNXD_QDNDVN', GENDER.FEMALE)).toBe(KNC_YEARS_REQUIRED_NU);
  });
});

describe('evaluateServiceYears', () => {
  it('returns NOT_FOUND when personnel is null', () => {
    const r = evaluateServiceYears(null, 'qn-1', 'HC_QKQT', REF_DATE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('NOT_FOUND');
    expect(r.personnelId).toBe('qn-1');
    expect(r.hoTen).toBeNull();
  });

  it('HC_QKQT skips gender check (returns MISSING_NHAP_NGU even when gender missing)', () => {
    const r = evaluateServiceYears(
      { id: 'a', ho_ten: 'A', gioi_tinh: null, ngay_nhap_ngu: null, ngay_xuat_ngu: null },
      'a',
      'HC_QKQT',
      REF_DATE
    );
    expect(r.reason).toBe('MISSING_NHAP_NGU');
  });

  it('KNC reports MISSING_GENDER when gender is null', () => {
    const r = evaluateServiceYears(
      { id: 'a', ho_ten: 'A', gioi_tinh: null, ngay_nhap_ngu: new Date('1990-01-01'), ngay_xuat_ngu: null },
      'a',
      'KNC_VSNXD_QDNDVN',
      REF_DATE
    );
    expect(r.reason).toBe('MISSING_GENDER');
  });

  it('KNC nam: eligible at exactly 25 years (boundary)', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.MALE,
        ngay_nhap_ngu: new Date('2001-01-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      'KNC_VSNXD_QDNDVN',
      REF_DATE
    );
    expect(r.eligible).toBe(true);
    expect(r.requiredYears).toBe(KNC_YEARS_REQUIRED_NAM);
    expect(r.totalMonths).toBe(25 * 12);
  });

  it('KNC nu: eligible at exactly 20 years', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.FEMALE,
        ngay_nhap_ngu: new Date('2006-01-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      'KNC_VSNXD_QDNDVN',
      REF_DATE
    );
    expect(r.eligible).toBe(true);
    expect(r.requiredYears).toBe(KNC_YEARS_REQUIRED_NU);
  });

  it('KNC nu: ineligible at 19 years (below threshold)', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.FEMALE,
        ngay_nhap_ngu: new Date('2007-02-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      'KNC_VSNXD_QDNDVN',
      REF_DATE
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('NOT_ENOUGH_YEARS');
    expect(r.totalMonths).toBeLessThan(20 * 12);
  });

  it('uses ngay_xuat_ngu when present (instead of refDate)', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.MALE,
        ngay_nhap_ngu: new Date('1990-01-01'),
        ngay_xuat_ngu: new Date('2000-01-01'),
      },
      'a',
      'HC_QKQT',
      REF_DATE
    );
    expect(r.eligible).toBe(false);
    expect(r.totalMonths).toBe(10 * 12);
  });

  it('HC_QKQT: ineligible at 24 years 11 months (boundary just below)', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.MALE,
        ngay_nhap_ngu: new Date('2001-02-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      'HC_QKQT',
      REF_DATE
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('NOT_ENOUGH_YEARS');
    expect(r.totalMonths).toBe(24 * 12 + 11);
  });
});
