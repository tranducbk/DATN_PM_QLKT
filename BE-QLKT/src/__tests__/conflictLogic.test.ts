/**
 * Test conflict/duplicate check logic patterns used across all flows.
 * Pure logic tests — no DB.
 */
import { DANH_HIEU_CA_NHAN_CO_BAN, DANH_HIEU_CA_NHAN_BANG_KHEN } from '../constants/danhHieu.constants';

interface ExistingRecord {
  danh_hieu: string | null;
  nhan_bkbqp: boolean;
  nhan_cstdtq: boolean;
  nhan_bkttcp: boolean;
}

/** Replicates the conflict check logic from bulkCreateAnnualRewards */
function canAddToExisting(existing: ExistingRecord, incoming: string): { allowed: boolean; reason?: string } {
  const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(incoming);
  const isCoBan = DANH_HIEU_CA_NHAN_CO_BAN.has(incoming);

  // Chain award: check if same flag already set
  if (incoming === 'BKBQP' && existing.nhan_bkbqp) return { allowed: false, reason: 'BKBQP already exists' };
  if (incoming === 'CSTDTQ' && existing.nhan_cstdtq) return { allowed: false, reason: 'CSTDTQ already exists' };
  if (incoming === 'BKTTCP' && existing.nhan_bkttcp) return { allowed: false, reason: 'BKTTCP already exists' };

  // Base title: check if existing already has a base title
  if (isCoBan && existing.danh_hieu) return { allowed: false, reason: `Already has ${existing.danh_hieu}` };

  // Allow: adding chain to existing base, or adding base to record with only flags
  return { allowed: isBangKhen || (isCoBan && !existing.danh_hieu) };
}

/** Replicates flag preservation logic — update should never reset existing true flags */
function buildUpdateData(incoming: string, ghiChu: string | null) {
  const data: Record<string, unknown> = {};

  if (DANH_HIEU_CA_NHAN_CO_BAN.has(incoming)) {
    data.danh_hieu = incoming;
    if (ghiChu) data.ghi_chu = ghiChu;
  } else if (incoming === 'BKBQP') {
    data.nhan_bkbqp = true;
    if (ghiChu) data.ghi_chu_bkbqp = ghiChu;
  } else if (incoming === 'CSTDTQ') {
    data.nhan_cstdtq = true;
    if (ghiChu) data.ghi_chu_cstdtq = ghiChu;
  } else if (incoming === 'BKTTCP') {
    data.nhan_bkttcp = true;
    if (ghiChu) data.ghi_chu_bkttcp = ghiChu;
  }

  return data;
}

describe('Conflict check: canAddToExisting', () => {
  const emptyRecord: ExistingRecord = { danh_hieu: null, nhan_bkbqp: false, nhan_cstdtq: false, nhan_bkttcp: false };
  const cstdcsRecord: ExistingRecord = { danh_hieu: 'CSTDCS', nhan_bkbqp: false, nhan_cstdtq: false, nhan_bkttcp: false };
  const bkbqpOnlyRecord: ExistingRecord = { danh_hieu: null, nhan_bkbqp: true, nhan_cstdtq: false, nhan_bkttcp: false };
  const fullRecord: ExistingRecord = { danh_hieu: 'CSTDCS', nhan_bkbqp: true, nhan_cstdtq: false, nhan_bkttcp: false };

  describe('Adding base title (CSTDCS/CSTT)', () => {
    it('allows adding CSTDCS to record with only flags', () => {
      expect(canAddToExisting(bkbqpOnlyRecord, 'CSTDCS').allowed).toBe(true);
    });

    it('blocks adding CSTDCS when already has CSTDCS', () => {
      expect(canAddToExisting(cstdcsRecord, 'CSTDCS').allowed).toBe(false);
    });

    it('blocks adding CSTT when already has CSTDCS', () => {
      expect(canAddToExisting(cstdcsRecord, 'CSTT').allowed).toBe(false);
    });

    it('blocks adding CSTDCS when already has CSTT', () => {
      const csttRecord = { ...emptyRecord, danh_hieu: 'CSTT' };
      expect(canAddToExisting(csttRecord, 'CSTDCS').allowed).toBe(false);
    });
  });

  describe('Adding chain award (BKBQP/CSTDTQ/BKTTCP)', () => {
    it('allows adding BKBQP to record with CSTDCS', () => {
      expect(canAddToExisting(cstdcsRecord, 'BKBQP').allowed).toBe(true);
    });

    it('allows adding CSTDTQ to record with CSTDCS + BKBQP', () => {
      expect(canAddToExisting(fullRecord, 'CSTDTQ').allowed).toBe(true);
    });

    it('blocks adding BKBQP when already has BKBQP', () => {
      expect(canAddToExisting(bkbqpOnlyRecord, 'BKBQP').allowed).toBe(false);
    });

    it('blocks adding CSTDTQ when already has CSTDTQ', () => {
      const record = { ...emptyRecord, nhan_cstdtq: true };
      expect(canAddToExisting(record, 'CSTDTQ').allowed).toBe(false);
    });

    it('allows adding BKTTCP to empty record', () => {
      expect(canAddToExisting(emptyRecord, 'BKTTCP').allowed).toBe(true);
    });
  });
});

describe('Update data: buildUpdateData', () => {
  it('CSTDCS sets danh_hieu + ghi_chu (not flag fields)', () => {
    const data = buildUpdateData('CSTDCS', 'note');
    expect(data.danh_hieu).toBe('CSTDCS');
    expect(data.ghi_chu).toBe('note');
    expect(data).not.toHaveProperty('nhan_bkbqp');
    expect(data).not.toHaveProperty('ghi_chu_bkbqp');
  });

  it('BKBQP sets nhan_bkbqp + ghi_chu_bkbqp (not danh_hieu)', () => {
    const data = buildUpdateData('BKBQP', 'bkbqp note');
    expect(data.nhan_bkbqp).toBe(true);
    expect(data.ghi_chu_bkbqp).toBe('bkbqp note');
    expect(data).not.toHaveProperty('danh_hieu');
    expect(data).not.toHaveProperty('ghi_chu');
  });

  it('CSTDTQ sets nhan_cstdtq + ghi_chu_cstdtq', () => {
    const data = buildUpdateData('CSTDTQ', 'tq note');
    expect(data.nhan_cstdtq).toBe(true);
    expect(data.ghi_chu_cstdtq).toBe('tq note');
  });

  it('BKTTCP sets nhan_bkttcp + ghi_chu_bkttcp', () => {
    const data = buildUpdateData('BKTTCP', 'ttcp note');
    expect(data.nhan_bkttcp).toBe(true);
    expect(data.ghi_chu_bkttcp).toBe('ttcp note');
  });

  it('null ghi_chu does not add ghi_chu fields', () => {
    const data = buildUpdateData('BKBQP', null);
    expect(data.nhan_bkbqp).toBe(true);
    expect(data).not.toHaveProperty('ghi_chu_bkbqp');
  });

  it('does not contain flags for other chain awards', () => {
    const data = buildUpdateData('BKBQP', null);
    expect(data).not.toHaveProperty('nhan_cstdtq');
    expect(data).not.toHaveProperty('nhan_bkttcp');
  });
});
