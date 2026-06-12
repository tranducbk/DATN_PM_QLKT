/**
 * Seed file quyết định trực tiếp (không API): copy PDF vào uploads/decisions/ +
 * tạo FileQuyetDinh qua decisionService. Id do cuid tự sinh.
 *
 * File đặt tên "<số QĐ>-<mã loại>.pdf" (vd QD2346-HCQKQT.pdf, QĐ1234-DVHN.pdf).
 * Số QĐ phải duy nhất: nếu 2 file trùng số (vd QĐ1234 dùng cho cả DVHN lẫn HCCSVV)
 * thì file xử lý sau bị bỏ qua.
 *
 *     npm run seed:decisions
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../../src/models';
import decisionService from '../../src/services/decision.service';

const SRC = process.env.DECISIONS_DIR || '/Users/tranduc/Documents/ĐATN/PM QLKT/Quyết định khen thưởng';
const DEST = path.join(__dirname, '..', '..', 'uploads', 'decisions');
const NAM = Number(process.env.DECISION_YEAR || '2024');

const CODE_MAP: Record<string, string> = {
  CNHN: 'CA_NHAN_HANG_NAM',
  DVHN: 'DON_VI_HANG_NAM',
  HCCSVV: 'NIEN_HAN',
  HCBVTQ: 'CONG_HIEN',
  HCQKQT: 'HC_QKQT',
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN',
  NCKH: 'NCKH',
  KTDX: 'DOT_XUAT',
};
const SIGNER: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'Giám đốc Học viện',
  DON_VI_HANG_NAM: 'Giám đốc Học viện',
  NCKH: 'Giám đốc Học viện',
  DOT_XUAT: 'Giám đốc Học viện',
  NIEN_HAN: 'Bộ trưởng Bộ Quốc phòng',
  HC_QKQT: 'Chủ tịch nước',
  KNC_VSNXD_QDNDVN: 'Bộ trưởng Bộ Quốc phòng',
  CONG_HIEN: 'Chủ tịch nước',
};

interface ParsedFile {
  file: string;
  so_quyet_dinh: string;
  loai: string;
}

function parseFiles(): ParsedFile[] {
  return fs
    .readdirSync(SRC)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort()
    .map(file => {
      const base = file.replace(/\.pdf$/i, '');
      const dash = base.indexOf('-');
      const so_quyet_dinh = dash < 0 ? base : base.slice(0, dash);
      const code = dash < 0 ? '' : base.slice(dash + 1);
      return { file, so_quyet_dinh, loai: CODE_MAP[code] || code };
    });
}

async function main(): Promise<void> {
  if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });
  const parsed = parseFiles();

  await prisma.fileQuyetDinh.deleteMany({ where: { so_quyet_dinh: { in: parsed.map(p => p.so_quyet_dinh) } } });

  let created = 0;
  const failures: string[] = [];
  for (const p of parsed) {
    try {
      fs.copyFileSync(path.join(SRC, p.file), path.join(DEST, p.file));
      await decisionService.createDecision({
        so_quyet_dinh: p.so_quyet_dinh,
        nam: NAM,
        ngay_ky: new Date(`${NAM}-12-20`),
        nguoi_ky: SIGNER[p.loai] || 'Thủ trưởng đơn vị',
        loai_khen_thuong: p.loai,
        file_path: `uploads/decisions/${p.file}`,
      });
      created++;
      console.log(`  ✓ ${p.so_quyet_dinh} (${p.loai}) ← ${p.file}`);
    } catch (err) {
      failures.push(`${p.file}: ${(err as Error).message}`);
    }
  }

  console.log(`\nXong: ${created}/${parsed.length} quyết định (PDF copy vào uploads/decisions/).`);
  if (failures.length) {
    console.log(`Bỏ qua (${failures.length}):`);
    failures.forEach(f => console.log(`  ✗ ${f}`));
  }
}

main()
  .catch(err => {
    console.error('Seed quyết định thất bại:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
