import { prisma } from '../models';

/**
 * One-time data migration: rewrites already-stored SystemLog.description and
 * ThongBao.title rows to match the standardized wording introduced in code
 * (centralized into logMessages / notificationMessages constants).
 *
 * Run `npx tsx src/scripts/syncLogNotificationText.ts` to preview (dry-run),
 * add `--apply` to execute the updates inside a transaction.
 */

interface SubstringRepl {
  from: string;
  to: string;
  like?: string;
}

// SystemLog.description — substring rewrites (REPLACE is a no-op when absent).
const DESCRIPTION_REPLACERS: SubstringRepl[] = [
  { from: '[Recalculate] Bắt đầu tính toán cho ', to: 'Bắt đầu tính toán lại hồ sơ cho ' },
  { from: '[Recalculate] Hoàn tất: ', to: 'Tính toán lại hồ sơ hoàn tất: ' },
  { from: '[Recalculate] Lỗi: ', to: 'Lỗi tính lại hồ sơ quân nhân ' },
  { from: ') — ', to: '): ', like: 'Lỗi tính lại hồ sơ quân nhân %) — %' },
  { from: '[Phê duyệt đề xuất] ', to: 'Phê duyệt đề xuất ' },
  {
    from: '[Tạo đề xuất] Lỗi lấy lịch sử chức vụ quân nhân ',
    to: 'Lỗi lấy lịch sử chức vụ khi tạo đề xuất, quân nhân ',
  },
  { from: ' — Validation thất bại:', to: ', kiểm tra dữ liệu thất bại:' },
  { from: '[Thêm khen thưởng đồng loạt] ', to: 'Thêm khen thưởng đồng loạt ' },
  { from: '[Sửa dữ liệu cũ - bỏ qua kiểm tra] ', to: 'Sửa dữ liệu cũ (bỏ qua kiểm tra): ' },
  { from: '[Import ', to: 'Nhập dữ liệu ' },
  { from: '] Hoàn tất:', to: ' hoàn tất:', like: 'Nhập dữ liệu %] Hoàn tất:%' },
  { from: 'Import ', to: 'Nhập dữ liệu ', like: 'Import %từ file%' },
  { from: 'Cron job ', to: 'Tác vụ định kỳ ' },
  { from: '(trigger thủ công)', to: '(kích hoạt thủ công)' },
  { from: 'Xoá toàn bộ ', to: 'Xóa toàn bộ ' },
  { from: 'repeat_map (', to: 'lặp lại của ', like: 'Dữ liệu repeat_map (%' },
  { from: ') không hợp lệ', to: ' không hợp lệ', like: 'Dữ liệu lặp lại của %) không hợp lệ%' },
  { from: 'Lỗi gửi thông báo xóa khen thưởng ', to: 'Lỗi gửi thông báo xóa ' },
  { from: 'Lỗi gửi thông báo import ', to: 'Lỗi gửi thông báo nhập dữ liệu ' },
  { from: 'Lỗi tính lại hồ sơ hằng năm sau khi ', to: 'Lỗi tính lại hồ sơ sau khi ' },
  { from: 'Lỗi tính lại hồ sơ khen thưởng niên hạn sau khi ', to: 'Lỗi tính lại hồ sơ sau khi ' },
  { from: 'Lỗi tính lại hồ sơ khen thưởng cống hiến sau khi ', to: 'Lỗi tính lại hồ sơ sau khi ' },
];

// ThongBao.title — whole-value rewrites (standardized verbs / merged variants).
const TITLE_REPLACERS: [string, string][] = [
  ['Đơn vị được khen thưởng đột xuất', 'Đơn vị của bạn đã nhận khen thưởng'],
  ['Bạn được khen thưởng đột xuất', 'Bạn đã nhận khen thưởng'],
  ['Đơn vị trực thuộc được khen thưởng đột xuất', 'Đơn vị trực thuộc đã nhận khen thưởng'],
  ['Khen thưởng mới được nhập dữ liệu', 'Khen thưởng mới đã được thêm'],
  ['Khen thưởng đột xuất mới', 'Khen thưởng mới đã được thêm'],
  ['Khen thưởng đột xuất đã được cập nhật', 'Khen thưởng đã được cập nhật'],
  ['Khen thưởng đơn vị đã được cập nhật', 'Khen thưởng đã được cập nhật'],
  ['Khen thưởng đơn vị trực thuộc đã được cập nhật', 'Khen thưởng đã được cập nhật'],
  ['Khen thưởng đột xuất đã bị xóa', 'Khen thưởng đã bị xóa'],
  ['Khen thưởng đơn vị đã bị xóa', 'Khen thưởng đã bị xóa'],
  ['Khen thưởng đơn vị trực thuộc đã bị xóa', 'Khen thưởng đã bị xóa'],
];

async function countLike(table: string, col: string, like: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "${table}" WHERE "${col}" LIKE $1`,
    like
  );
  return rows[0]?.n ?? 0;
}

async function countEquals(table: string, col: string, value: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "${table}" WHERE "${col}" = $1`,
    value
  );
  return rows[0]?.n ?? 0;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLY mode ===' : '=== DRY-RUN (preview only, no writes) ===');

  let descTotal = 0;
  console.log('\n[SystemLog.description]');
  for (const { from, to, like } of DESCRIPTION_REPLACERS) {
    const pattern = like ?? `%${from}%`;
    const n = await countLike('SystemLog', 'description', pattern);
    descTotal += n;
    if (n > 0) console.log(`  ${n.toString().padStart(4)} × "${from}" → "${to}"`);
    if (apply && n > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "SystemLog" SET description = LEFT(REPLACE(description, $1, $2), 500) WHERE description LIKE $3`,
        from,
        to,
        pattern
      );
    }
  }

  let titleTotal = 0;
  console.log('\n[ThongBao.title]');
  for (const [from, to] of TITLE_REPLACERS) {
    const n = await countEquals('ThongBao', 'title', from);
    titleTotal += n;
    if (n > 0) console.log(`  ${n.toString().padStart(4)} × "${from}" → "${to}"`);
    if (apply && n > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "ThongBao" SET title = $1 WHERE title = $2`,
        to,
        from
      );
    }
  }

  console.log(
    `\n${apply ? 'Updated' : 'Would update'}: ${descTotal} description rows, ${titleTotal} title rows.`
  );
  if (!apply && descTotal + titleTotal > 0) {
    console.log('Re-run with --apply to write the changes.');
  }
}

main()
  .catch(err => {
    console.error('syncLogNotificationText failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
