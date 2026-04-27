import type { QuanNhan } from '../../generated/prisma';
import type { ContributionTimeAggregate } from '../../types/proposal';

export interface TitleDataItem {
  personnel_id: string;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  loai?: string;
  mo_ta?: string;
  don_vi_id?: string;
  thoi_gian_nhom_0_7?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_8?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_9_1_0?: ContributionTimeAggregate | null;
}

export interface BulkCreateContext {
  type: string;
  nam: number;
  thang?: number | null;
  selectedPersonnel: string[];
  titleData: TitleDataItem[];
  ghiChu?: string | null;
  adminId: string;
  personnelMap: Map<string, QuanNhan>;
  errors: string[];
  createdRecords: unknown[];
  errorDetails: { personnelId: string; error: string }[];
  affectedPersonnelIds: Set<string>;
  affectedUnitIds: Set<string>;
  importedCount: { value: number };
}

export type CreateHandler = (ctx: BulkCreateContext) => Promise<void>;

export interface BulkCreateAwardsParams {
  type: string;
  nam: number;
  /** Decision month (1-12). Required for HCCSVV/HCQKQT/KNC/CONG_HIEN — DB schemas mark `thang` NOT NULL. */
  thang?: number | null;
  selectedPersonnel: string[];
  selectedUnits?: string[];
  titleData: TitleDataItem[];
  ghiChu?: string | null;
  attachedFiles?: unknown[];
  adminId: string;
}
