import {
  evaluateServiceYears,
  requiredServiceYears,
} from '../../src/services/eligibility/serviceYearsEligibility';
import {
  DANH_HIEU_DAC_BIET,
  HCQKQT_YEARS_REQUIRED,
  KNC_YEARS_REQUIRED_NAM,
  KNC_YEARS_REQUIRED_NU,
} from '../../src/constants/danhHieu.constants';
import { GENDER } from '../../src/constants/gender.constants';

const REF_DATE = new Date('2026-01-01');

describe('Xét điều kiện theo số năm phục vụ: số năm yêu cầu của từng danh hiệu', () => {
  it('Xét điều kiện HC QKQT: yêu cầu 25 năm phục vụ, không phân biệt nam hay nữ', () => {
    expect(requiredServiceYears(DANH_HIEU_DAC_BIET.HC_QKQT, GENDER.MALE)).toBe(HCQKQT_YEARS_REQUIRED);
    expect(requiredServiceYears(DANH_HIEU_DAC_BIET.HC_QKQT, GENDER.FEMALE)).toBe(HCQKQT_YEARS_REQUIRED);
    expect(requiredServiceYears(DANH_HIEU_DAC_BIET.HC_QKQT, null)).toBe(HCQKQT_YEARS_REQUIRED);
  });

  it('Xét điều kiện KNC: yêu cầu 25 năm phục vụ với nam, 20 năm với nữ', () => {
    expect(requiredServiceYears(DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN, GENDER.MALE)).toBe(KNC_YEARS_REQUIRED_NAM);
    expect(requiredServiceYears(DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN, GENDER.FEMALE)).toBe(KNC_YEARS_REQUIRED_NU);
  });
});

describe('Xét điều kiện theo số năm phục vụ: tính số năm và kết luận đủ/không đủ điều kiện', () => {
  it('Xét điều kiện theo số năm phục vụ: không tìm thấy quân nhân → trả về NOT_FOUND', () => {
    const r = evaluateServiceYears(null, 'qn-1', DANH_HIEU_DAC_BIET.HC_QKQT, REF_DATE);
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('NOT_FOUND');
    expect(r.personnelId).toBe('qn-1');
    expect(r.hoTen).toBeNull();
  });

  it('Xét điều kiện HC QKQT: không kiểm tra giới tính, thiếu ngày nhập ngũ → trả về MISSING_NHAP_NGU dù chưa có giới tính', () => {
    const r = evaluateServiceYears(
      { id: 'a', ho_ten: 'A', gioi_tinh: null, ngay_nhap_ngu: null, ngay_xuat_ngu: null },
      'a',
      DANH_HIEU_DAC_BIET.HC_QKQT,
      REF_DATE
    );
    expect(r.reason).toBe('MISSING_NHAP_NGU');
  });

  it('Xét điều kiện KNC: thiếu giới tính → trả về MISSING_GENDER (KNC cần giới tính để xác định mốc năm)', () => {
    const r = evaluateServiceYears(
      { id: 'a', ho_ten: 'A', gioi_tinh: null, ngay_nhap_ngu: new Date('1990-01-01'), ngay_xuat_ngu: null },
      'a',
      DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
      REF_DATE
    );
    expect(r.reason).toBe('MISSING_GENDER');
  });

  it('Xét điều kiện KNC (nam): đúng mốc biên 25 năm phục vụ → đủ điều kiện', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.MALE,
        ngay_nhap_ngu: new Date('2001-01-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
      REF_DATE
    );
    expect(r.eligible).toBe(true);
    expect(r.requiredYears).toBe(KNC_YEARS_REQUIRED_NAM);
    expect(r.totalMonths).toBe(25 * 12);
  });

  it('Xét điều kiện KNC (nữ): đúng mốc biên 20 năm phục vụ → đủ điều kiện', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.FEMALE,
        ngay_nhap_ngu: new Date('2006-01-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
      REF_DATE
    );
    expect(r.eligible).toBe(true);
    expect(r.requiredYears).toBe(KNC_YEARS_REQUIRED_NU);
  });

  it('Xét điều kiện KNC (nữ): mới 19 năm phục vụ (dưới mốc 20 năm) → chưa đủ điều kiện', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.FEMALE,
        ngay_nhap_ngu: new Date('2007-02-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
      REF_DATE
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('NOT_ENOUGH_YEARS');
    expect(r.totalMonths).toBeLessThan(20 * 12);
  });

  it('Xét điều kiện theo số năm phục vụ: nếu đã có ngày xuất ngũ thì tính tới ngày đó thay vì ngày hiện tại', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.MALE,
        ngay_nhap_ngu: new Date('1990-01-01'),
        ngay_xuat_ngu: new Date('2000-01-01'),
      },
      'a',
      DANH_HIEU_DAC_BIET.HC_QKQT,
      REF_DATE
    );
    expect(r.eligible).toBe(false);
    expect(r.totalMonths).toBe(10 * 12);
  });

  it('Xét điều kiện HC QKQT: 24 năm 11 tháng phục vụ (ngay dưới mốc 25 năm) → chưa đủ điều kiện', () => {
    const r = evaluateServiceYears(
      {
        id: 'a',
        ho_ten: 'A',
        gioi_tinh: GENDER.MALE,
        ngay_nhap_ngu: new Date('2001-02-01'),
        ngay_xuat_ngu: null,
      },
      'a',
      DANH_HIEU_DAC_BIET.HC_QKQT,
      REF_DATE
    );
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('NOT_ENOUGH_YEARS');
    expect(r.totalMonths).toBe(24 * 12 + 11);
  });
});
