/**
 * Per-query Prisma mock used by every Phase 2 test file.
 *
 * - `prismaMock` is a Jest-mocked stand-in for `prisma` exported by `src/models`.
 * - Each test arranges return values via `prismaMock.<model>.<method>.mockResolvedValueOnce(...)`.
 * - `resetPrismaMock()` clears all mock state — invoked by `tests/setup.ts` `beforeEach`.
 *
 * The mock list below is exhaustive enough for the proposal/award flows under test.
 * If a service under test touches a model not listed, add it here and re-run typecheck.
 */

const PRISMA_METHODS = [
  'findUnique',
  'findFirst',
  'findMany',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'groupBy',
  'aggregate',
] as const;

const PRISMA_MODELS = [
  'quanNhan',
  'coQuanDonVi',
  'donViTrucThuoc',
  'chucVu',
  'lichSuChucVu',
  'taiKhoan',
  'bangDeXuat',
  'danhHieuHangNam',
  'danhHieuDonViHangNam',
  'hoSoHangNam',
  'hoSoNienHan',
  'hoSoCongHien',
  'hoSoDonViHangNam',
  'thanhTichKhoaHoc',
  'khenThuongHCCSVV',
  'khenThuongHCBVTQ',
  'khenThuongDotXuat',
  'huanChuongQuanKyQuyetThang',
  'kyNiemChuongVSNXDQDNDVN',
  'fileQuyetDinh',
  'thongBao',
  'systemLog',
  'systemSetting',
] as const;

type PrismaMethod = (typeof PRISMA_METHODS)[number];
type PrismaModel = (typeof PRISMA_MODELS)[number];

export type PrismaModelMock = Record<PrismaMethod, jest.Mock>;
export type PrismaMock = Record<PrismaModel, PrismaModelMock> & {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

function buildModelMock(): PrismaModelMock {
  const entries = PRISMA_METHODS.map(method => [method, jest.fn()] as const);
  return Object.fromEntries(entries) as PrismaModelMock;
}

function buildPrismaMock(): PrismaMock {
  const modelEntries = PRISMA_MODELS.map(model => [model, buildModelMock()] as const);
  const models = Object.fromEntries(modelEntries) as Record<PrismaModel, PrismaModelMock>;

  const $transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => Promise<unknown>)(prismaMock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg as Promise<unknown>[]);
    }
    return undefined;
  });

  return {
    ...models,
    $transaction,
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

export const prismaMock: PrismaMock = buildPrismaMock();

/** Clears every model mock and resets `$transaction` to its default callback handler. */
export function resetPrismaMock(): void {
  for (const model of PRISMA_MODELS) {
    for (const method of PRISMA_METHODS) {
      prismaMock[model][method].mockReset();
    }
  }
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => Promise<unknown>)(prismaMock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg as Promise<unknown>[]);
    }
    return undefined;
  });
  prismaMock.$queryRaw.mockReset().mockResolvedValue([]);
  prismaMock.$executeRaw.mockReset().mockResolvedValue(0);
  prismaMock.$queryRawUnsafe.mockReset().mockResolvedValue([]);
  prismaMock.$executeRawUnsafe.mockReset().mockResolvedValue(0);
  prismaMock.$connect.mockReset().mockResolvedValue(undefined);
  prismaMock.$disconnect.mockReset().mockResolvedValue(undefined);
}

jest.mock('../../src/models', () => ({
  prisma: prismaMock,
}));

// Silence the recalcAnnualProfile side effect — every reward write triggers it.
jest.mock('../../src/helpers/profileRecalcHelper', () => ({
  safeRecalculateAnnualProfile: jest.fn().mockResolvedValue(undefined),
}));

// Silence systemLog writes; tests assert business behavior, not log lines.
jest.mock('../../src/helpers/systemLogHelper', () => ({
  writeSystemLog: jest.fn().mockResolvedValue(undefined),
}));

// uuid ships ESM-only in v9+; jest cannot parse it without extra transforms.
jest.mock('uuid', () => ({
  v4: () => '00000000-0000-4000-8000-000000000000',
}));

// Notification helpers are fire-and-forget; stub the entire barrel.
jest.mock('../../src/helpers/notification', () => ({
  notifyOnAwardDeleted: jest.fn().mockResolvedValue(undefined),
  notifyOnBulkAwardAdded: jest.fn().mockResolvedValue(undefined),
  notifyOnAwardCreated: jest.fn().mockResolvedValue(undefined),
  notifyOnAwardUpdated: jest.fn().mockResolvedValue(undefined),
  notifyOnProposalSubmitted: jest.fn().mockResolvedValue(undefined),
  notifyOnProposalApproved: jest.fn().mockResolvedValue(undefined),
  notifyOnProposalRejected: jest.fn().mockResolvedValue(undefined),
}));
