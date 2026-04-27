/**
 * Bulk-duplicate-in-file scenarios.
 *
 * Covers what happens when a single payload (proposal items, bulk personnel_ids,
 * Excel rows) contains the same key twice. Each test pins behavior including
 * cases where the service silently accepts the duplicate. TODO: tighten unique
 * constraints on bulkCreateAnnualRewards.personnel_ids and Excel preview.
 */

import ExcelJS from 'exceljs';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeAdmin, makeAnnualRecord } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  BULK_DUP_PAYLOAD_PREFIX,
  BULK_DUP_PAYLOAD_LINE,
  BULK_DUP_EXCEL_FILE_DUPLICATE,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import annualRewardService from '../../src/services/annualReward.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-bulk-dup';

function arrangeManager() {
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...makeAdmin({ id: ADMIN_ID }),
    QuanNhan: {
      id: 'qn-mgr',
      ho_ten: 'Manager',
      co_quan_don_vi_id: 'cqdv-mgr',
      don_vi_truc_thuoc_id: null,
      CoQuanDonVi: { id: 'cqdv-mgr', ten_don_vi: 'CQDV M', ma_don_vi: 'M' },
      DonViTrucThuoc: null,
    },
  });
}

const HEADERS = [
  'id',
  'ho_va_ten',
  'nam',
  'danh_hieu',
  'cap_bac',
  'chuc_vu',
  'ghi_chu',
  'so_quyet_dinh',
  'nhan_bkbqp',
  'nhan_cstdtq',
  'nhan_bkttcp',
] as const;

async function makeExcelBuffer(rows: Record<string, unknown>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.addRow([...HEADERS]);
  for (const row of rows) {
    worksheet.addRow(HEADERS.map(h => row[h] ?? ''));
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

describe('Bulk dup — same personnel + same danh_hieu in one proposal payload', () => {
  it('Submit CA_NHAN_HANG_NAM với 2 items trùng (qn-A, CSTDCS) → reject DUPLICATE_IN_PAYLOAD', async () => {
    // Given: two CSTDCS items for the same personnel in one proposal
    arrangeManager();
    const target = makePersonnel({ id: 'qn-dup-payload', ho_ten: 'Trùng A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      proposalService.submitProposal(
        [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
        ],
        null,
        null,
        ADMIN_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      `${BULK_DUP_PAYLOAD_PREFIX}\n${BULK_DUP_PAYLOAD_LINE(target.ho_ten, DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS)}`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});

describe('Bulk dup — duplicate personnel_ids in bulkCreateAnnualRewards', () => {
  it('personnel_ids = [qn1, qn1, qn1] → service iterate 3 lần, mock create 3 lần (KHÔNG dedupe)', async () => {
    // Pin: bulkCreateAnnualRewards.personnelIds is iterated as-is; the in-memory
    // existingRewardMap is built once before the transaction starts so subsequent
    // iterations don't see records created earlier in the same loop.
    // TODO: dedupe `personnel_ids` at service entry to prevent unique-constraint races.
    const target = makePersonnel({ id: 'qn-dup-bulk', ho_ten: 'QN Lặp' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.create
      .mockResolvedValueOnce(
        makeAnnualRecord({
          personnelId: target.id,
          nam: 2024,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-DUP',
        })
      )
      .mockResolvedValueOnce(
        makeAnnualRecord({
          personnelId: target.id,
          nam: 2024,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-DUP',
        })
      )
      .mockResolvedValueOnce(
        makeAnnualRecord({
          personnelId: target.id,
          nam: 2024,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-DUP',
        })
      );

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [target.id, target.id, target.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-DUP',
    });

    // Pin: 3 creates fire (in production this would hit unique-constraint on the 2nd write)
    expect(result.success).toBe(3);
    expect(prismaMock.danhHieuHangNam.create).toHaveBeenCalledTimes(3);
  });
});

describe('Bulk dup — Excel rows referencing same personnel + nam', () => {
  it('Preview: 2 row (qn-1, 2024) + (qn-1, 2024) → row thứ hai báo "Trùng lặp trong file"', async () => {
    const p1 = makePersonnel({ id: 'qn-excel-dup', ho_ten: 'Lê Excel' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([
      { so_quyet_dinh: 'QD-A' },
      { so_quyet_dinh: 'QD-B' },
    ]);

    const buffer = await makeExcelBuffer([
      {
        id: 'qn-excel-dup',
        ho_va_ten: 'Lê Excel',
        nam: 2024,
        danh_hieu: 'CSTDCS',
        so_quyet_dinh: 'QD-A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
      {
        id: 'qn-excel-dup',
        ho_va_ten: 'Lê Excel',
        nam: 2024,
        danh_hieu: 'CSTT',
        so_quyet_dinh: 'QD-B',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    // First row valid; second blocked because seenInFile keys on personnel+nam (NOT danh_hieu).
    // Pin: same QN + same year is treated as duplicate even with different danh_hieu in the file.
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe(BULK_DUP_EXCEL_FILE_DUPLICATE(2024));
  });
});

describe('Bulk dup — DON_VI_HANG_NAM duplicate units in payload', () => {
  it('2 items cùng don_vi_id + cùng danh_hieu → reject DUPLICATE_IN_PAYLOAD', async () => {
    // Given: same unit with same DVQT title twice in one proposal
    arrangeManager();
    prismaMock.coQuanDonVi.findUnique.mockResolvedValue({
      id: 'cqdv-dup',
      ten_don_vi: 'Đơn vị Trùng',
      ma_don_vi: 'DT',
    });

    await expectError(
      proposalService.submitProposal(
        [
          {
            personnel_id: '',
            don_vi_id: 'cqdv-dup',
            don_vi_type: 'CO_QUAN_DON_VI',
            danh_hieu: 'ĐVQT',
          },
          {
            personnel_id: '',
            don_vi_id: 'cqdv-dup',
            don_vi_type: 'CO_QUAN_DON_VI',
            danh_hieu: 'ĐVQT',
          },
        ],
        null,
        null,
        ADMIN_ID,
        PROPOSAL_TYPES.DON_VI_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      { startsWith: BULK_DUP_PAYLOAD_PREFIX }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});
