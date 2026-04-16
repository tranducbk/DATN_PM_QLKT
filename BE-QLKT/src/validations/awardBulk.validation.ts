import Joi from 'joi';
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
    } catch {
      return null;
    }
  }
  return null;
}

function parseJsonStringArraySchema(name: string) {
  return Joi.any().custom((value, helpers) => {
    const parsed = parseJsonStringArray(value);
    if (!parsed || parsed.length === 0) {
      return helpers.error('any.invalid', { key: name });
    }
    return parsed;
  }, 'parse json array strings');
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
    } catch {
      return null;
    }
  }
  return null;
}

export const bulkCreateAwards: Joi.ObjectSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(PROPOSAL_TYPES))
    .required()
    .messages({ 'any.required': 'type là bắt buộc' }),
  nam: Joi.number().integer().min(YEAR_MIN).max(YEAR_MAX).required().messages({
    'any.required': 'nam là bắt buộc',
  }),

  selected_personnel: parseJsonStringArraySchema('selected_personnel').optional(),
  selected_units: parseJsonStringArraySchema('selected_units').optional(),

  title_data: Joi.any().custom((value, helpers) => {
    const parsed = parseJsonTitleData(value);
    if (!parsed || parsed.length === 0) return helpers.error('any.invalid');
    return parsed;
  }, 'parse json title_data'),

  ghi_chu: Joi.string().trim().optional().allow(null, ''),
})
  .custom((value: any, helpers) => {
    const type = value.type as ProposalType;
    const titleData = value.title_data as Array<Record<string, unknown>>;

    if (!Array.isArray(titleData) || titleData.length === 0) {
      return helpers.error('any.invalid', { key: 'title_data' });
    }

    const selectedPersonnel = value.selected_personnel as string[] | undefined;
    const selectedUnits = value.selected_units as string[] | undefined;

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      if (!selectedUnits || selectedUnits.length === 0) {
        return helpers.error('any.invalid', { key: 'selected_units' });
      }
    } else {
      if (!selectedPersonnel || selectedPersonnel.length === 0) {
        return helpers.error('any.invalid', { key: 'selected_personnel' });
      }
    }

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      for (const item of titleData) {
        if (typeof item.don_vi_id !== 'string' || item.don_vi_id.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.don_vi_id' });
        }
        if (typeof item.danh_hieu !== 'string' || item.danh_hieu.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.danh_hieu' });
        }
      }
    } else if (type === PROPOSAL_TYPES.NCKH) {
      for (const item of titleData) {
        if (typeof item.personnel_id !== 'string' || item.personnel_id.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.personnel_id' });
        }
        if (typeof item.loai !== 'string' || item.loai.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.loai' });
        }
        if (typeof item.mo_ta !== 'string' || item.mo_ta.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.mo_ta' });
        }
      }
    } else if (
      type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM ||
      type === PROPOSAL_TYPES.NIEN_HAN ||
      type === PROPOSAL_TYPES.CONG_HIEN
    ) {
      for (const item of titleData) {
        if (typeof item.personnel_id !== 'string' || item.personnel_id.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.personnel_id' });
        }
        if (typeof item.danh_hieu !== 'string' || item.danh_hieu.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.danh_hieu' });
        }
      }
    } else {
      for (const item of titleData) {
        if (typeof item.personnel_id !== 'string' || item.personnel_id.trim() === '') {
          return helpers.error('any.invalid', { key: 'title_data.personnel_id' });
        }
      }
    }

    return value;
  }, 'validate conditional fields');

