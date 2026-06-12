/**
 * End-to-end proposal flow over HTTP (supertest), exercising the REAL stack:
 * route -> auth middleware -> controller -> service -> Prisma -> profile recalc.
 *
 * Unlike the unit tests (which jest.mock Prisma), this hits a real database, so
 * it runs under its own config:
 *     npm run test:integration
 *
 * Prerequisites:
 *   - DATABASE_URL in .env points at a disposable/demo database.
 *   - Base demo seed loaded: `npm run seed:reset && npm run seed:ui`
 *     (provides `manager_demo` / `admin_demo` accounts + personnel).
 */
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/models';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { ROLES } from '../../src/constants/roles.constants';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Hvkhqs@123';
const TEST_YEAR = 2099; // unlikely to collide with seeded award years

let managerUsername = '';
let adminUsername = '';
let personnelId = '';

async function login(username: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  expect(res.body?.data?.accessToken).toBeTruthy();
  return res.body.data.accessToken;
}

beforeAll(async () => {
  const manager = await prisma.taiKhoan.findFirst({
    where: { role: ROLES.MANAGER, quan_nhan_id: { not: null } },
    include: { QuanNhan: true },
  });
  const admin = await prisma.taiKhoan.findFirst({ where: { role: ROLES.ADMIN } });
  if (!manager?.QuanNhan || !admin) {
    throw new Error('Thiếu tài khoản demo. Chạy `npm run seed:reset && npm run seed:ui` trước.');
  }

  managerUsername = manager.username;
  adminUsername = admin.username;

  const unitId = manager.QuanNhan.co_quan_don_vi_id || manager.QuanNhan.don_vi_truc_thuoc_id;
  const target =
    (await prisma.quanNhan.findFirst({
      where: {
        id: { not: manager.QuanNhan.id },
        OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: unitId }],
      },
    })) ?? manager.QuanNhan;
  personnelId = target.id;

  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: personnelId, nam: TEST_YEAR } });
});

afterAll(async () => {
  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: personnelId, nam: TEST_YEAR } });
  await prisma.bangDeXuat.deleteMany({
    where: { nam: TEST_YEAR, loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM },
  });
  await prisma.$disconnect();
});

describe('Proposal flow (HTTP): submit -> approve -> award + profile', () => {
  it('manager submits CSTDCS, admin approves, award and annual profile are created', async () => {
    const managerToken = await login(managerUsername);
    const adminToken = await login(adminUsername);

    const submitRes = await request(app)
      .post('/api/proposals')
      .set('Authorization', `Bearer ${managerToken}`)
      .field('type', PROPOSAL_TYPES.CA_NHAN_HANG_NAM)
      .field(
        'title_data',
        JSON.stringify([
          { personnel_id: personnelId, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
        ])
      )
      .field('nam', String(TEST_YEAR));
    expect(submitRes.status).toBe(201);
    const proposalId = submitRes.body?.data?.id;
    expect(proposalId).toBeTruthy();

    const approveRes = await request(app)
      .post(`/api/proposals/${proposalId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field(
        'data_danh_hieu',
        JSON.stringify([
          {
            personnel_id: personnelId,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: `QD-TEST-${TEST_YEAR}`,
          },
        ])
      )
      .field('data_thanh_tich', '[]')
      .field('data_nien_han', '[]')
      .field('data_cong_hien', '[]');
    expect(approveRes.status).toBe(200);

    const award = await prisma.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: personnelId, nam: TEST_YEAR },
    });
    expect(award).toBeTruthy();
    expect(award?.danh_hieu).toBe(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS);
    expect(award?.so_quyet_dinh).toBe(`QD-TEST-${TEST_YEAR}`);

    const profile = await prisma.hoSoHangNam.findUnique({ where: { quan_nhan_id: personnelId } });
    expect(profile).toBeTruthy();
  });
});
