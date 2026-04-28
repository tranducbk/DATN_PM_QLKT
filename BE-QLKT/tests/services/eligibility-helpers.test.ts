import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';
import {
  PERSONAL_CHAIN_AWARDS,
  UNIT_CHAIN_AWARDS,
  type ChainAwardConfig,
} from '../../src/constants/chainAwards.constants';
import { checkChainEligibility } from '../../src/services/eligibility/chainEligibility';
import {
  collectPendingProposalPersonnelIdsForAward,
  isPersonalChainAward,
} from '../../src/services/eligibility/annualBulkValidation';
import {
  validateDecisionNumbers,
  missingDecisionNumberMessage,
} from '../../src/services/eligibility/decisionNumberValidation';

function findAward(code: string, list: ChainAwardConfig[]): ChainAwardConfig {
  const found = list.find(item => item.code === code);
  if (!found) throw new Error(`Missing chain-award config for ${code}`);
  return found;
}

describe('eligibility/chainEligibility helper', () => {
  it('keeps unit chain unaffected by NCKH requirement', () => {
    const unitBkbqp = findAward(DANH_HIEU_DON_VI_HANG_NAM.BKBQP, UNIT_CHAIN_AWARDS);
    const result = checkChainEligibility(
      unitBkbqp,
      { streakLength: 2, nckhStreak: 0 },
      false,
      {}
    );
    expect(result.eligible).toBe(true);
  });
});

describe('eligibility/annualBulkValidation helper', () => {
  it('identifies personal chain awards only', () => {
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP)).toBe(true);
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ)).toBe(true);
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP)).toBe(true);
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS)).toBe(false);
  });

  it('ignores malformed JSON payload rows safely', () => {
    const pendingIds = collectPendingProposalPersonnelIdsForAward(
      [
        { data_danh_hieu: null },
        { data_danh_hieu: { personnel_id: 'bad-shape' } },
        {
          data_danh_hieu: [
            'noise',
            { personnel_id: 'qn-1', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP },
          ],
        },
      ],
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect([...pendingIds]).toEqual(['qn-1']);
  });
});

describe('eligibility/decisionNumberValidation helper', () => {
  it('requires CSTDTQ decision number for personal context', () => {
    const errors = validateDecisionNumbers(
      {
        nhan_cstdtq: true,
        so_quyet_dinh_cstdtq: '',
      },
      {
        entityType: 'personal',
        entityName: 'Nguyen Van A',
      }
    );

    expect(errors).toContain(
      missingDecisionNumberMessage('Nguyen Van A', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ)
    );
  });

  it('skips CSTDTQ decision-number validation for unit context', () => {
    const errors = validateDecisionNumbers(
      {
        nhan_cstdtq: true,
        so_quyet_dinh_cstdtq: '',
      },
      {
        entityType: 'unit',
        entityName: 'Don vi A',
      }
    );

    expect(errors).toEqual([]);
  });

  it('formats missing decision-number message with localized award name', () => {
    const expected = `Nguyen Van B: Thiếu số quyết định cho danh hiệu ${getDanhHieuName(
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    )}`;
    expect(
      missingDecisionNumberMessage('Nguyen Van B', DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP)
    ).toBe(expected);
  });
});
