import type { Prisma } from '../../generated/prisma';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
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

interface PendingProposalRow {
  id: string;
  data_danh_hieu: Prisma.JsonValue | null;
  data_thanh_tich: Prisma.JsonValue | null;
  data_nien_han: Prisma.JsonValue | null;
  data_cong_hien: Prisma.JsonValue | null;
}

/**
 * Cascade rename so_quyet_dinh across pending proposal payloads (JSON columns only).
 * Award tables (relational columns) are auto-updated by Postgres ON UPDATE CASCADE
 * via FileQuyetDinh hard FK — no app-level update needed for those.
 * @param tx - Prisma transaction client
 * @param oldSqd - Trimmed old so_quyet_dinh value
 * @param newSqd - Trimmed new so_quyet_dinh value
 * @returns Count of pending proposal rows scanned and updated
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
  const pending = (await tx.bangDeXuat.findMany({
    where: { status: PROPOSAL_STATUS.PENDING },
    select: {
      id: true,
      data_danh_hieu: true,
      data_thanh_tich: true,
      data_nien_han: true,
      data_cong_hien: true,
    },
  })) as PendingProposalRow[];

  let updated = 0;
  for (const row of pending) {
    const updates: Prisma.BangDeXuatUpdateInput = {};
    let rowChanged = false;

    const dh = renameItems(row.data_danh_hieu, DANH_HIEU_KEYS, oldSqd, newSqd);
    if (dh.changed) {
      updates.data_danh_hieu = dh.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    const tt = renameItems(row.data_thanh_tich, SINGLE_KEY, oldSqd, newSqd);
    if (tt.changed) {
      updates.data_thanh_tich = tt.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    const nh = renameItems(row.data_nien_han, SINGLE_KEY, oldSqd, newSqd);
    if (nh.changed) {
      updates.data_nien_han = nh.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    const ch = renameItems(row.data_cong_hien, SINGLE_KEY, oldSqd, newSqd);
    if (ch.changed) {
      updates.data_cong_hien = ch.next as Prisma.InputJsonValue;
      rowChanged = true;
    }

    if (!rowChanged) continue;

    await tx.bangDeXuat.update({ where: { id: row.id }, data: updates });
    updated++;
  }

  return { scanned: pending.length, updated };
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
