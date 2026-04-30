import { z } from 'zod';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

function parseJsonStringArray(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.every(v => typeof v === 'string') ? (value as string[]) : null;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return null;
      return parsed.every((v: unknown) => typeof v === 'string') ? (parsed as string[]) : null;
    } catch (error) {
      console.error('Failed to parse awardBulk selectedPersonnel JSON:', error);
      return null;
    }
  }
  return null;
}

function parseJsonTitleData(value: unknown): Array<Record<string, unknown>> | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))
      ? (value as Array<Record<string, unknown>>)
      : null;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return null;
      return parsed.every(
        (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)
      )
        ? (parsed as Array<Record<string, unknown>>)
        : null;
    } catch (error) {
      console.error('Failed to parse awardBulk titleData JSON:', error);
      return null;
    }
  }
  return null;
}

const optionalStringArrayField = z
  .preprocess(
    val => (val === undefined ? undefined : parseJsonStringArray(val)),
    z.array(z.string()).nullable().optional()
  )
  .optional();

const titleDataField = z.preprocess(
  val => (val === undefined ? undefined : parseJsonTitleData(val)),
  z.array(z.record(z.string(), z.unknown())).nullable().optional()
);

export const bulkCreateAwards = z
  .object({
    type: z.enum(Object.values(PROPOSAL_TYPES) as [string, ...string[]], {
      message: 'type là bắt buộc',
    }),
    nam: z
      .number({ message: 'nam là bắt buộc' })
      .int()
      .min(YEAR_MIN)
      .max(YEAR_MAX),
    thang: z
      .union([
        z
          .number({ message: 'thang phải là số nguyên 1-12' })
          .int('thang phải là số nguyên 1-12')
          .min(1, 'thang phải từ 1 đến 12')
          .max(12, 'thang phải từ 1 đến 12'),
        z.literal(''),
        z.null(),
      ])
      .optional(),

    selected_personnel: optionalStringArrayField,
    selected_units: optionalStringArrayField,

    title_data: titleDataField,

    ghi_chu: z.string().trim().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const type = value.type as ProposalType;
    const titleData = value.title_data as Array<Record<string, unknown>> | null | undefined;

    if (!Array.isArray(titleData) || titleData.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['title_data'],
        message: 'title_data không hợp lệ',
      });
      return;
    }

    const selectedPersonnel = value.selected_personnel as string[] | null | undefined;
    const selectedUnits = value.selected_units as string[] | null | undefined;

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      if (!selectedUnits || selectedUnits.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['selected_units'],
          message: 'selected_units không hợp lệ',
        });
      }
    } else {
      if (!selectedPersonnel || selectedPersonnel.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['selected_personnel'],
          message: 'selected_personnel không hợp lệ',
        });
      }
    }

    // HCCSVV/HCQKQT/KNC/CONG_HIEN persist `thang` directly into the award table — required.
    const typesNeedingThang: ProposalType[] = [
      PROPOSAL_TYPES.NIEN_HAN,
      PROPOSAL_TYPES.HC_QKQT,
      PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      PROPOSAL_TYPES.CONG_HIEN,
    ];
    if (typesNeedingThang.includes(type) && (value.thang == null || value.thang === '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['thang'],
        message: 'thang là bắt buộc cho loại đề xuất này',
      });
    }

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      for (const item of titleData) {
        if (typeof item.don_vi_id !== 'string' || item.don_vi_id.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'don_vi_id'],
            message: 'title_data.don_vi_id không hợp lệ',
          });
          return;
        }
        if (typeof item.danh_hieu !== 'string' || item.danh_hieu.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'danh_hieu'],
            message: 'title_data.danh_hieu không hợp lệ',
          });
          return;
        }
      }
    } else if (type === PROPOSAL_TYPES.NCKH) {
      for (const item of titleData) {
        if (typeof item.personnel_id !== 'string' || item.personnel_id.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'personnel_id'],
            message: 'title_data.personnel_id không hợp lệ',
          });
          return;
        }
        if (typeof item.loai !== 'string' || item.loai.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'loai'],
            message: 'title_data.loai không hợp lệ',
          });
          return;
        }
        if (typeof item.mo_ta !== 'string' || item.mo_ta.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'mo_ta'],
            message: 'title_data.mo_ta không hợp lệ',
          });
          return;
        }
      }
    } else if (
      type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM ||
      type === PROPOSAL_TYPES.NIEN_HAN ||
      type === PROPOSAL_TYPES.CONG_HIEN
    ) {
      for (const item of titleData) {
        if (typeof item.personnel_id !== 'string' || item.personnel_id.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'personnel_id'],
            message: 'title_data.personnel_id không hợp lệ',
          });
          return;
        }
        if (typeof item.danh_hieu !== 'string' || item.danh_hieu.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'danh_hieu'],
            message: 'title_data.danh_hieu không hợp lệ',
          });
          return;
        }
      }
    } else {
      for (const item of titleData) {
        if (typeof item.personnel_id !== 'string' || item.personnel_id.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['title_data', 'personnel_id'],
            message: 'title_data.personnel_id không hợp lệ',
          });
          return;
        }
      }
    }
  });
