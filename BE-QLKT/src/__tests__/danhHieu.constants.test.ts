import {
  getDanhHieuName,
  formatDanhHieuList,
  resolveDanhHieuFromRecord,
  resolveDanhHieuCode,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_CA_NHAN_CO_BAN,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../constants/danhHieu.constants';

describe('getDanhHieuName', () => {
  it('returns Vietnamese name for valid code', () => {
    expect(getDanhHieuName('CSTDCS')).toBe('Chiến sĩ thi đua cơ sở');
    expect(getDanhHieuName('BKBQP')).toContain('Bằng khen');
  });

  it('returns fallback for null/undefined', () => {
    expect(getDanhHieuName(null)).toBe('Chưa có dữ liệu');
    expect(getDanhHieuName(undefined)).toBe('Chưa có dữ liệu');
  });

  it('returns code itself for unknown value', () => {
    expect(getDanhHieuName('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('formatDanhHieuList', () => {
  it('formats codes to Vietnamese names without parentheses', () => {
    const result = formatDanhHieuList(['CSTDCS', 'CSTT']);
    expect(result).not.toContain('(');
    expect(result).toContain('Chiến sĩ thi đua cơ sở');
    expect(result).toContain('Chiến sĩ tiên tiến');
  });
});

describe('resolveDanhHieuFromRecord', () => {
  it('returns danh_hieu when present', () => {
    expect(resolveDanhHieuFromRecord({ danh_hieu: 'CSTDCS' })).toBe('CSTDCS');
  });

  it('returns BKBQP when danh_hieu is null and nhan_bkbqp is true', () => {
    expect(resolveDanhHieuFromRecord({ danh_hieu: null, nhan_bkbqp: true })).toBe('BKBQP');
  });

  it('returns CSTDTQ when danh_hieu is null and nhan_cstdtq is true', () => {
    expect(resolveDanhHieuFromRecord({ danh_hieu: null, nhan_cstdtq: true })).toBe('CSTDTQ');
  });

  it('returns BKTTCP when danh_hieu is null and nhan_bkttcp is true', () => {
    expect(resolveDanhHieuFromRecord({ danh_hieu: null, nhan_bkttcp: true })).toBe('BKTTCP');
  });

  it('returns null when no danh_hieu and no flags', () => {
    expect(resolveDanhHieuFromRecord({ danh_hieu: null })).toBeNull();
  });

  it('prioritizes danh_hieu over flags', () => {
    expect(resolveDanhHieuFromRecord({ danh_hieu: 'CSTT', nhan_bkbqp: true })).toBe('CSTT');
  });
});

describe('resolveDanhHieuCode', () => {
  it('resolves code from code', () => {
    expect(resolveDanhHieuCode('CSTDCS')).toBe('CSTDCS');
  });

  it('resolves code from Vietnamese label', () => {
    expect(resolveDanhHieuCode('Chiến sĩ thi đua cơ sở')).toBe('CSTDCS');
  });
});

describe('Constants sets', () => {
  it('DANH_HIEU_CA_NHAN_CO_BAN contains CSTDCS and CSTT', () => {
    expect(DANH_HIEU_CA_NHAN_CO_BAN.has('CSTDCS')).toBe(true);
    expect(DANH_HIEU_CA_NHAN_CO_BAN.has('CSTT')).toBe(true);
    expect(DANH_HIEU_CA_NHAN_CO_BAN.has('BKBQP')).toBe(false);
  });

  it('DANH_HIEU_CA_NHAN_BANG_KHEN contains chain awards', () => {
    expect(DANH_HIEU_CA_NHAN_BANG_KHEN.has('BKBQP')).toBe(true);
    expect(DANH_HIEU_CA_NHAN_BANG_KHEN.has('CSTDTQ')).toBe(true);
    expect(DANH_HIEU_CA_NHAN_BANG_KHEN.has('BKTTCP')).toBe(true);
    expect(DANH_HIEU_CA_NHAN_BANG_KHEN.has('CSTDCS')).toBe(false);
  });

  it('DANH_HIEU_DON_VI sets are correct', () => {
    expect(DANH_HIEU_DON_VI_CO_BAN.has('ĐVQT')).toBe(true);
    expect(DANH_HIEU_DON_VI_CO_BAN.has('ĐVTT')).toBe(true);
    expect(DANH_HIEU_DON_VI_BANG_KHEN.has('BKBQP')).toBe(true);
    expect(DANH_HIEU_DON_VI_BANG_KHEN.has('BKTTCP')).toBe(true);
  });
});
