/**
 * Seed demo đầy đủ QUA API THẬT (gọi HTTP như admin thao tác trên giao diện) để
 * middleware auditLog tự sinh Nhật ký hệ thống đúng format — không tự chế log.
 *
 * Luồng đúng như giao diện: tạo TÀI KHOẢN trước (POST /accounts) — hệ thống tự sinh
 * quân nhân placeholder KHÔNG có CCCD (ho_ten = username) + lịch sử chức vụ mở. Sau
 * đó PUT /personnel mới điền CCCD + hồ sơ. Tức CCCD chỉ có SAU khi cập nhật, không
 * có lúc tạo. Cuối cùng dựng lịch sử chức vụ thăng tiến thật.
 *
 * USER bắt buộc thuộc một Ban (đơn vị trực thuộc); chỉ Trưởng phòng là MANAGER ở cấp
 * Phòng. Username: "maphongcha.hovaten" (vd pdt.tranquoctoan) / Hvkhqs@123.
 * Cần BE đang chạy (npm run dev). Đổi base qua SEED_API_BASE nếu khác cổng.
 *
 * Eligibility (nhiều người mỗi ca, từ năm phục vụ + hệ số chức vụ tích luỹ):
 *   HCCSVV Ba≥10/Nhì≥15/Nhất≥20 năm; HCQKQT≥25; KNC nam≥25/nữ≥20; HCBVTQ theo bucket
 *   hệ số (Nhất 0.9, Nhì ≥0.8, Ba ≥0.7). Danh hiệu hằng năm bạn tự đề xuất.
 *
 *     npm run seed:all   (= seed:base + seed:decisions)
 */
import { prisma } from '../../src/models';
import accountService from '../../src/services/account.service';
import { ROLES } from '../../src/constants/roles.constants';

const API_BASE = process.env.SEED_API_BASE || 'http://localhost:4000/api';
const DEMO_PASSWORD = 'Hvkhqs@123';
const SYSTEM_ACCOUNTS = [
  { username: 'superadmin', role: ROLES.SUPER_ADMIN },
  { username: 'admin', role: ROLES.ADMIN },
];

let authToken = '';

interface ApiEnvelope {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Calls the backend HTTP API with the current auth token attached.
 * @param method - HTTP method
 * @param path - Path under /api (e.g. "/accounts")
 * @param body - Optional JSON body
 * @returns Parsed response envelope
 * @throws Error - On connection failure or non-2xx response
 */
async function api(method: string, path: string, body?: unknown): Promise<ApiEnvelope> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`Không kết nối được BE (${API_BASE}). Hãy chạy "npm run dev" rồi seed lại.`);
  }
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope;
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${json.message || 'lỗi không xác định'}`);
  }
  return json;
}

const postId = async (path: string, body: unknown): Promise<string> =>
  ((await api('POST', path, body)).data as { id: string }).id;

async function login(username: string, password: string): Promise<void> {
  const env = await api('POST', '/auth/login', { username, password });
  authToken = (env.data as { accessToken: string }).accessToken;
}

function slugify(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

type CqdvKey = 'pdt' | 'pkh';
type DvttKey = 'bkt' | 'bkh' | 'bhl' | 'bnc' | 'btt' | 'bht';
type Level = 'nhanvien' | 'troly' | 'photruongban' | 'truongban' | 'truongphong';

const CQDV: { key: CqdvKey; ma: string; ten: string }[] = [
  { key: 'pdt', ma: 'PDT', ten: 'Phòng Đào tạo' },
  { key: 'pkh', ma: 'PKH', ten: 'Phòng Khoa học Quân sự' },
];
const DVTT: { key: DvttKey; ma: string; ten: string; parent: CqdvKey }[] = [
  { key: 'bkt', ma: 'BKT', ten: 'Ban Khảo thí', parent: 'pdt' },
  { key: 'bkh', ma: 'BKH', ten: 'Ban Kế hoạch', parent: 'pdt' },
  { key: 'bhl', ma: 'BHL', ten: 'Ban Học liệu', parent: 'pdt' },
  { key: 'bnc', ma: 'BNC', ten: 'Ban Nghiên cứu khoa học', parent: 'pkh' },
  { key: 'btt', ma: 'BTT', ten: 'Ban Thông tin tư liệu', parent: 'pkh' },
  { key: 'bht', ma: 'BHT', ten: 'Ban Hợp tác quốc tế', parent: 'pkh' },
];
const PARENT_OF: Record<DvttKey, CqdvKey> = { bkt: 'pdt', bkh: 'pdt', bhl: 'pdt', bnc: 'pkh', btt: 'pkh', bht: 'pkh' };
const CQDV_MA: Record<CqdvKey, string> = { pdt: 'PDT', pkh: 'PKH' };

// Bậc chức vụ: tên + hệ số. Chỉ Trưởng phòng ở cấp Phòng (CQĐV, là chỉ huy); còn lại
// đều ở cấp Ban (ĐVTT) vì account USER bắt buộc thuộc đơn vị trực thuộc.
const LEVEL_META: Record<Level, { ten: string; he_so: number; is_manager?: boolean; at: 'cqdv' | 'dvtt' }> = {
  nhanvien: { ten: 'Nhân viên', he_so: 0.4, at: 'dvtt' },
  troly: { ten: 'Trợ lý', he_so: 0.5, at: 'dvtt' },
  photruongban: { ten: 'Phó trưởng ban', he_so: 0.7, at: 'dvtt' },
  truongban: { ten: 'Trưởng ban', he_so: 0.8, at: 'dvtt' },
  truongphong: { ten: 'Trưởng phòng', he_so: 0.9, is_manager: true, at: 'cqdv' },
};

const MALE_NAMES = ['Trần Quốc Toản', 'Vũ Đình Lâm', 'Nguyễn Văn An', 'Lê Hoàng Nam', 'Phạm Văn Bình', 'Hoàng Minh Đức', 'Đặng Văn Hùng', 'Bùi Quang Huy', 'Phan Văn Khoa', 'Lý Văn Tân', 'Ngô Đức Thắng', 'Đỗ Văn Kiên'];
const FEMALE_NAMES = ['Lê Thị Hoa', 'Nguyễn Thị Mai', 'Bùi Thị Lan', 'Ngô Thị Thu', 'Trần Thị Hằng', 'Phạm Thị Yến'];
const QUE_QUAN = ['Xã An Bình, tỉnh Thái Bình', 'Xã Tiên Lữ, tỉnh Hưng Yên', 'Xã Hồng Phong, tỉnh Hải Dương', 'Xã Quỳnh Lưu, tỉnh Nghệ An', 'Xã Đông Sơn, tỉnh Thanh Hóa', 'Xã Tân Phong, tỉnh Nam Định'];

interface Group {
  count: number;
  gioi_tinh: 'NAM' | 'NU';
  enlistBase: number;
  cap_bac: string;
  level: Level;
  note: string;
}
// level = chức vụ HIỆN TẠI; lịch sử thăng tiến tới đó. Năm nhập ngũ quyết HCCSVV/HCQKQT/KNC.
const GROUPS: Group[] = [
  { count: 1, gioi_tinh: 'NAM', enlistBase: 1996, cap_bac: 'Thượng tá', level: 'truongphong', note: 'Trưởng phòng · HCQKQT, KNC, HCCSVV Nhất, HCBVTQ Nhất' },
  { count: 1, gioi_tinh: 'NAM', enlistBase: 1997, cap_bac: 'Thượng tá', level: 'truongphong', note: 'Trưởng phòng · HCQKQT, KNC, HCCSVV Nhất, HCBVTQ Nhất' },
  { count: 2, gioi_tinh: 'NAM', enlistBase: 1998, cap_bac: 'Trung tá', level: 'truongban', note: 'Trưởng ban · HCQKQT, KNC, HCCSVV Nhất, HCBVTQ Nhì' },
  { count: 2, gioi_tinh: 'NU', enlistBase: 2002, cap_bac: 'Trung tá', level: 'truongban', note: 'Trưởng ban · KNC nữ, HCCSVV Nhất, HCBVTQ Nhì' },
  { count: 3, gioi_tinh: 'NAM', enlistBase: 2007, cap_bac: 'Thiếu tá', level: 'photruongban', note: 'Phó trưởng ban · HCCSVV Nhì, HCBVTQ Ba' },
  { count: 2, gioi_tinh: 'NU', enlistBase: 2010, cap_bac: 'Đại úy', level: 'photruongban', note: 'Phó trưởng ban · HCCSVV Nhì, HCBVTQ Ba' },
  { count: 2, gioi_tinh: 'NAM', enlistBase: 2013, cap_bac: 'Thượng úy', level: 'troly', note: 'Trợ lý · HCCSVV Ba; chưa đủ HCBVTQ' },
  { count: 3, gioi_tinh: 'NAM', enlistBase: 2020, cap_bac: 'Thiếu úy', level: 'nhanvien', note: 'Mới — danh hiệu hằng năm' },
];

interface Career {
  level: Level;
  fromYear: number;
  toYear: number | null; // null = đang đảm nhiệm
}
// Lộ trình thăng tiến tới chức vụ hiện tại, liền mạch từ năm nhập ngũ.
function buildCareer(level: Level, enlistYear: number): Career[] {
  const e = enlistYear;
  const open = (lv: Level, from: number): Career => ({ level: lv, fromYear: from, toYear: null });
  const seg = (lv: Level, from: number, to: number): Career => ({ level: lv, fromYear: from, toYear: to });
  switch (level) {
    case 'truongphong':
      return [seg('troly', e, e + 5), seg('photruongban', e + 5, e + 11), seg('truongban', e + 11, e + 15), open('truongphong', e + 15)];
    case 'truongban':
      return [seg('troly', e, e + 5), seg('photruongban', e + 5, e + 11), open('truongban', e + 11)];
    case 'photruongban':
      return [seg('nhanvien', e, e + 4), seg('troly', e + 4, e + 8), open('photruongban', e + 8)];
    case 'troly':
      return [seg('nhanvien', e, e + 4), open('troly', e + 4)];
    default:
      return [open('nhanvien', e)];
  }
}

interface Person {
  cccd: string;
  username: string;
  ho_ten: string;
  gioi_tinh: 'NAM' | 'NU';
  ngay_sinh: string;
  ngay_nhap_ngu: string;
  cap_bac: string;
  que_quan: string;
  so_dien_thoai: string;
  ngay_vao_dang: string;
  role: (typeof ROLES)[keyof typeof ROLES];
  level: Level;
  dvtt: DvttKey;
  enlistYear: number;
  note: string;
}

function buildPersonnel(): Person[] {
  const out: Person[] = [];
  const usedUsernames = new Set<string>();
  let idx = 0;
  let m = 0;
  let f = 0;
  for (const g of GROUPS) {
    for (let i = 0; i < g.count; i++) {
      const enlistYear = g.enlistBase + (i % 2);
      const birthYear = enlistYear - 22;
      const centuryGender = birthYear < 2000 ? (g.gioi_tinh === 'NAM' ? '0' : '1') : g.gioi_tinh === 'NAM' ? '2' : '3';
      const cccd = '001' + centuryGender + String(birthYear % 100).padStart(2, '0') + String(idx + 1).padStart(6, '0');
      const ho_ten = g.gioi_tinh === 'NAM' ? MALE_NAMES[m++ % MALE_NAMES.length] : FEMALE_NAMES[f++ % FEMALE_NAMES.length];
      const dvtt = DVTT[idx % DVTT.length].key;
      const parentMa = CQDV_MA[PARENT_OF[dvtt]].toLowerCase();
      let username = `${parentMa}.${slugify(ho_ten)}`;
      for (let n = 2; usedUsernames.has(username); n++) username = `${parentMa}.${slugify(ho_ten)}${n}`;
      usedUsernames.add(username);
      out.push({
        cccd,
        username,
        ho_ten,
        gioi_tinh: g.gioi_tinh,
        ngay_sinh: `${birthYear}-05-15`,
        ngay_nhap_ngu: `${enlistYear}-09-01`,
        cap_bac: g.cap_bac,
        que_quan: QUE_QUAN[idx % QUE_QUAN.length],
        so_dien_thoai: '09' + String(12000001 + idx).padStart(8, '0'),
        ngay_vao_dang: `${enlistYear + 3}-05-19`,
        role: g.level === 'truongphong' ? ROLES.MANAGER : ROLES.USER,
        level: g.level,
        dvtt,
        enlistYear,
        note: g.note,
      });
      idx++;
    }
  }
  return out;
}

const ALL_CODES = [...CQDV.map(c => c.ma), ...DVTT.map(d => d.ma)];
const LEGACY_CODES = ['PDT-2C', 'PKH-2C', 'PCT-2C', 'BKT-2C', 'BKH-2C', 'BHL-2C', 'BNC-2C', 'BTT-2C', 'BHT-2C', 'BCN-2C', 'BTH-2C', 'BTC-2C', 'BDV-2C', 'BBV-2C', 'PDT-API', 'BKT-API', 'BKH-API', 'BHC-API'];

/**
 * Wipes prior demo data (direct DB — teardown, not the demo flow) so a re-run starts
 * clean: removes demo personnel/units/positions/accounts and resets the system log
 * (FK to notifications/actors is onDelete: SetNull, no orphans).
 * @param personnel - Demo personnel definitions (matched by CCCD)
 */
async function cleanup(personnel: Person[]): Promise<void> {
  const codes = [...ALL_CODES, ...LEGACY_CODES];
  const cleared = await prisma.systemLog.deleteMany({});
  if (cleared.count) console.log(`Xoá ${cleared.count} nhật ký cũ.`);
  await prisma.taiKhoan.deleteMany({ where: { username: { in: [...SYSTEM_ACCOUNTS.map(a => a.username), 'admin_demo'] } } });

  const [cqdvs, dvtts] = await Promise.all([
    prisma.coQuanDonVi.findMany({ where: { ma_don_vi: { in: codes } }, select: { id: true } }),
    prisma.donViTrucThuoc.findMany({ where: { ma_don_vi: { in: codes } }, select: { id: true } }),
  ]);
  const cqdvIds = cqdvs.map(u => u.id);
  const dvttIds = dvtts.map(u => u.id);

  await prisma.quanNhan.deleteMany({
    where: {
      OR: [
        { cccd: { in: personnel.map(p => p.cccd) } },
        { co_quan_don_vi_id: { in: cqdvIds } },
        { don_vi_truc_thuoc_id: { in: dvttIds } },
      ],
    },
  });
  await prisma.chucVu.deleteMany({
    where: { OR: [{ co_quan_don_vi_id: { in: cqdvIds } }, { don_vi_truc_thuoc_id: { in: dvttIds } }] },
  });
  await prisma.donViTrucThuoc.deleteMany({ where: { ma_don_vi: { in: codes } } });
  await prisma.coQuanDonVi.deleteMany({ where: { ma_don_vi: { in: codes } } });
}

const LOG_STEP_MS = 15000;

/**
 * Spreads the middleware-generated log timestamps over a realistic session so the
 * Nhật ký không bị dồn trong vài giây (seed chạy nhanh + createdAt second-precision).
 * Order theo id asc = đúng trình tự tạo (CUID v1 sort được); cleanup đã xoá log cũ
 * nên toàn bộ log hiện tại đều thuộc lần seed này.
 */
async function restampLogs(): Promise<void> {
  const logs = await prisma.systemLog.findMany({ orderBy: { id: 'asc' }, select: { id: true } });
  const end = new Date();
  for (let i = 0; i < logs.length; i++) {
    const at = new Date(end.getTime() - (logs.length - 1 - i) * LOG_STEP_MS);
    await prisma.systemLog.update({ where: { id: logs[i].id }, data: { createdAt: at } });
  }
  console.log(`Giãn ${logs.length} nhật ký theo trình tự tạo (mỗi mục ~${LOG_STEP_MS / 1000}s, mới nhất = hiện tại).`);
}

async function main(): Promise<void> {
  const personnel = buildPersonnel();
  await cleanup(personnel);

  // Bootstrap: tài khoản đầu tiên không thể tạo qua API → tạo superadmin trực tiếp.
  await accountService.createAccount({ username: 'superadmin', password: DEMO_PASSWORD, role: ROLES.SUPER_ADMIN });
  await login('superadmin', DEMO_PASSWORD);

  // Từ đây mọi thứ qua API → auditLog middleware tự ghi nhật ký, actor = admin.
  await api('POST', '/accounts', { username: 'admin', password: DEMO_PASSWORD, role: ROLES.ADMIN });
  await login('admin', DEMO_PASSWORD);
  console.log('Tài khoản hệ thống: superadmin (bootstrap) + admin (API).');

  const unitIds = {} as Record<CqdvKey | DvttKey, string>;
  for (const c of CQDV) unitIds[c.key] = await postId('/units', { ma_don_vi: c.ma, ten_don_vi: c.ten });
  for (const d of DVTT) unitIds[d.key] = await postId('/units', { ma_don_vi: d.ma, ten_don_vi: d.ten, co_quan_don_vi_id: unitIds[d.parent] });
  console.log(`Đơn vị: ${CQDV.length} cha + ${DVTT.length} con`);

  const positionId: Record<string, string> = {};
  const ensurePosition = async (level: Level, unitKey: CqdvKey | DvttKey): Promise<string> => {
    const key = `${level}@${unitKey}`;
    if (!positionId[key]) {
      const meta = LEVEL_META[level];
      positionId[key] = await postId('/positions', {
        unit_id: unitIds[unitKey],
        ten_chuc_vu: meta.ten,
        is_manager: meta.is_manager ?? false,
        he_so_chuc_vu: meta.he_so,
      });
    }
    return positionId[key];
  };

  for (const p of personnel) {
    const cqdv = PARENT_OF[p.dvtt];
    const career = buildCareer(p.level, p.enlistYear);
    const current = career[career.length - 1];
    const currentUnit: CqdvKey | DvttKey = LEVEL_META[current.level].at === 'cqdv' ? cqdv : p.dvtt;
    const currentPositionId = await ensurePosition(current.level, currentUnit);

    // Tạo TÀI KHOẢN → hệ thống tự sinh quân nhân placeholder (cccd = null, ho_ten =
    // username) + lịch sử chức vụ mở. MANAGER chỉ gắn CQĐV; USER gắn cả ĐVTT.
    const accountBody =
      p.role === ROLES.MANAGER
        ? { username: p.username, password: DEMO_PASSWORD, role: p.role, co_quan_don_vi_id: unitIds[cqdv], chuc_vu_id: currentPositionId }
        : { username: p.username, password: DEMO_PASSWORD, role: p.role, co_quan_don_vi_id: unitIds[cqdv], don_vi_truc_thuoc_id: unitIds[p.dvtt], chuc_vu_id: currentPositionId };
    const account = (await api('POST', '/accounts', accountBody)).data as { quan_nhan_id: string };
    const pid = account.quan_nhan_id;

    // CHỈ bây giờ mới điền CCCD + hồ sơ (đúng luồng: cập nhật sau khi tạo tài khoản).
    await api('PUT', `/personnel/${pid}`, {
      ho_ten: p.ho_ten,
      cccd: p.cccd,
      gioi_tinh: p.gioi_tinh,
      ngay_sinh: p.ngay_sinh,
      ngay_nhap_ngu: p.ngay_nhap_ngu,
      cap_bac: p.cap_bac,
      que_quan_2_cap: p.que_quan,
      tru_quan: 'Hà Nội',
      cho_o_hien_nay: 'Học viện Khoa học Quân sự, Hà Nội',
      so_dien_thoai: p.so_dien_thoai,
      ngay_vao_dang: p.ngay_vao_dang,
    });

    // Tài khoản tạo sẵn 1 entry "hiện tại" bắt đầu hôm nay; sửa về đúng mốc nhận chức
    // rồi thêm các đoạn trước đó để có lộ trình thăng tiến liền mạch.
    const hist = (await api('GET', `/position-history?personnel_id=${pid}`)).data as Array<{ id: string }>;
    if (hist[0]) {
      await api('PUT', `/personnel/${pid}/position-history/${hist[0].id}`, {
        chuc_vu_id: currentPositionId,
        ngay_bat_dau: `${current.fromYear}-09-01`,
        ngay_ket_thuc: null,
      });
    }
    for (const seg of career.slice(0, -1)) {
      const unitKey: CqdvKey | DvttKey = LEVEL_META[seg.level].at === 'cqdv' ? cqdv : p.dvtt;
      await api('POST', `/personnel/${pid}/position-history`, {
        chuc_vu_id: await ensurePosition(seg.level, unitKey),
        ngay_bat_dau: `${seg.fromYear}-09-01`,
        ngay_ket_thuc: `${seg.toYear}-08-31`,
      });
    }
    console.log(`  ✓ ${p.ho_ten} (${p.cap_bac}) — tk: ${p.username} — ${p.note}`);
  }

  await restampLogs();

  const managers = personnel.filter(p => p.role === ROLES.MANAGER).map(p => p.username);
  console.log(`\nXong: ${personnel.length} quân nhân qua API (tạo tài khoản → cập nhật CCCD; nhật ký do middleware tự sinh).`);
  console.log(`SUPER_ADMIN: superadmin · ADMIN: admin · MANAGER: ${managers.join(', ')} (đều ${DEMO_PASSWORD}).`);
}

main()
  .catch(err => {
    console.error('Seed thất bại:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
