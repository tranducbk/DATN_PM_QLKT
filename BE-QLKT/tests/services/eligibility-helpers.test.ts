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

describe('Xét điều kiện chuỗi danh hiệu: hàm lõi checkChainEligibility', () => {
  it('Xét điều kiện chuỗi danh hiệu đơn vị: chuỗi đơn vị không bị ràng buộc NCKH (đủ 2 năm là đủ điều kiện)', () => {
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

describe('Xét điều kiện chuỗi danh hiệu: nhận diện danh hiệu chuỗi và đọc đề xuất chờ duyệt', () => {
  it('Xét điều kiện chuỗi danh hiệu: chỉ BKBQP/CSTDTQ/BKTTCP là danh hiệu chuỗi cá nhân, CSTDCS thì không', () => {
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP)).toBe(true);
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ)).toBe(true);
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP)).toBe(true);
    expect(isPersonalChainAward(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS)).toBe(false);
  });

  it('Xét điều kiện chuỗi danh hiệu: bỏ qua an toàn các dòng đề xuất sai định dạng, chỉ lấy đúng quân nhân có BKBQP đang chờ duyệt', () => {
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

describe('Xét điều kiện chuỗi danh hiệu: kiểm tra số quyết định kèm theo từng danh hiệu', () => {
  it('Phê duyệt bị chặn: cá nhân có CSTDTQ nhưng chưa nhập số quyết định CSTDTQ → báo thiếu số quyết định', () => {
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

  it('Phê duyệt đơn vị: bỏ qua kiểm tra số quyết định CSTDTQ (đơn vị không có CSTDTQ) → không báo lỗi', () => {
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

  it('Phê duyệt bị chặn: thông báo thiếu số quyết định hiển thị đúng tên danh hiệu tiếng Việt', () => {
    const expected = `Nguyen Van B: Thiếu số quyết định cho danh hiệu ${getDanhHieuName(
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    )}`;
    expect(
      missingDecisionNumberMessage('Nguyen Van B', DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP)
    ).toBe(expected);
  });
});
