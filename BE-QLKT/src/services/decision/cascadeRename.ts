import type { Prisma } from '../../generated/prisma';
import { proposalRepository } from '../../repositories/proposal.repository';
import type {
  ProposalDanhHieuItem,
  ProposalThanhTichItem,
  ProposalNienHanItem,
  ProposalCongHienItem,
} from '../../types/proposal';

type Tx = Prisma.TransactionClient;

export interface CascadeRenameSummary {
  proposalsScanned: number;
  proposalsUpdated: number;
}

const DANH_HIEU_KEYS = [
  'so_quyet_dinh',
  'so_quyet_dinh_bkbqp',
  'so_quyet_dinh_cstdtq',
  'so_quyet_dinh_bkttcp',
] as const;

const SINGLE_KEY = ['so_quyet_dinh'] as const;

interface ProposalRow {
  id: string;
  data_danh_hieu: Prisma.JsonValue | null;
  data_thanh_tich: Prisma.JsonValue | null;
  data_nien_han: Prisma.JsonValue | null;
  data_cong_hien: Prisma.JsonValue | null;
}

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  CASCADE RENAME số quyết định — đổi số QĐ ở MỌI nơi đang dùng
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Đổi 1 số QĐ (vd "12/QĐ" → "15/QĐ") cần đồng bộ ở 2 NHÓM, theo 2 CÁCH khác nhau:
 *
 *  ① BẢNG KHEN THƯỞNG (cột QUAN HỆ so_quyet_dinh) → TỰ ĐỘNG, KHÔNG cần code.
 *     FK tới "FileQuyetDinh"(so_quyet_dinh) khai báo ON UPDATE CASCADE, nên chỉ cần:
 *        UPDATE "FileQuyetDinh" SET so_quyet_dinh = '15/QĐ' WHERE so_quyet_dinh = '12/QĐ';
 *     → Postgres TỰ cập nhật so_quyet_dinh ở "DanhHieuHangNam", "KhenThuongHCCSVV",
 *       "KhenThuongHCBVTQ", "HuanChuongQuanKyQuyetThang", ... (mọi bảng tham chiếu).
 *
 *  ② PAYLOAD ĐỀ XUẤT (cột JSON data_danh_hieu/_thanh_tich/_nien_han/_cong_hien)
 *     → PHẢI sửa BẰNG CODE (hàm này). Vì số QĐ nằm BÊN TRONG chuỗi JSON, không phải
 *     cột quan hệ, nên FK cascade KHÔNG chạm tới. Quét từng đề xuất, thay trong JSON.
 *
 *  Cả 2 nằm trong transaction đổi tên QĐ → đồng bộ hoặc rollback hết.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Cascade rename so_quyet_dinh across all proposal payloads (JSON columns only),
 * regardless of status. Award tables (relational columns) are auto-updated by
 * Postgres ON UPDATE CASCADE via FileQuyetDinh hard FK — no app-level update needed.
 * Approved/Rejected JSON snapshots are also rewritten so UI views stay consistent
 * across proposal detail and award table list.
 * @param tx - Prisma transaction client
 * @param oldSqd - Trimmed old so_quyet_dinh value
 * @param newSqd - Trimmed new so_quyet_dinh value
 * @returns Count of proposal rows scanned and updated
 */
export async function cascadeRenameSoQuyetDinh(
  tx: Tx,
  oldSqd: string,
  newSqd: string
): Promise<CascadeRenameSummary> {
  const json = await renameInProposalPayloads(tx, oldSqd, newSqd);
  return {
    proposalsScanned: json.scanned,
    proposalsUpdated: json.updated,
  };
}

async function renameInProposalPayloads(
  tx: Tx,
  oldSqd: string,
  newSqd: string
): Promise<{ scanned: number; updated: number }> {
  // Quét MỌI đề xuất (mọi status) để sửa số QĐ nằm TRONG JSON payload.
  // SQL minh hoạ:
  //   SELECT id, data_danh_hieu, data_thanh_tich, data_nien_han, data_cong_hien
  //     FROM "BangDeXuat";
  const proposals = (await proposalRepository.findManyRaw(
    {
      select: {
        id: true,
        data_danh_hieu: true,
        data_thanh_tich: true,
        data_nien_han: true,
        data_cong_hien: true,
      },
    },
    tx
  )) as ProposalRow[];

  let updated = 0;
  for (const row of proposals) {
    const updates: Prisma.BangDeXuatUncheckedUpdateInput = {};
    let rowChanged = false;

    const danhHieuRename = renameItems(row.data_danh_hieu, DANH_HIEU_KEYS, oldSqd, newSqd);
    if (danhHieuRename.changed) {
      updates.data_danh_hieu = danhHieuRename.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    const thanhTichRename = renameItems(row.data_thanh_tich, SINGLE_KEY, oldSqd, newSqd);
    if (thanhTichRename.changed) {
      updates.data_thanh_tich = thanhTichRename.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    const nienHanRename = renameItems(row.data_nien_han, SINGLE_KEY, oldSqd, newSqd);
    if (nienHanRename.changed) {
      updates.data_nien_han = nienHanRename.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    const congHienRename = renameItems(row.data_cong_hien, SINGLE_KEY, oldSqd, newSqd);
    if (congHienRename.changed) {
      updates.data_cong_hien = congHienRename.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    if (!rowChanged) continue;

    await proposalRepository.update(row.id, updates, tx);
    updated++;
  }

  return { scanned: proposals.length, updated };
}

type ProposalItem =
  | ProposalDanhHieuItem
  | ProposalThanhTichItem
  | ProposalNienHanItem
  | ProposalCongHienItem;

function renameItems(
  raw: Prisma.JsonValue | null,
  keys: readonly string[],
  oldSqd: string,
  newSqd: string
): { changed: boolean; next: ProposalItem[] } {
  if (!Array.isArray(raw)) return { changed: false, next: [] };

  let changed = false;
  const next = (raw as ProposalItem[]).map(item => {
    if (!item || typeof item !== 'object') return item;
    let cloned: Record<string, unknown> | null = null;
    for (const key of keys) {
      if ((item as Record<string, unknown>)[key] === oldSqd) {
        if (!cloned) cloned = { ...(item as Record<string, unknown>) };
        cloned[key] = newSqd;
        changed = true;
      }
    }
    return (cloned as ProposalItem | null) ?? item;
  });

  return { changed, next };
}
