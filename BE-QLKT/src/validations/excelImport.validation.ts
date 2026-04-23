import Joi from 'joi';

/**
 * Shared base fields for personnel-based import items
 */
const personnelImportItemBase = {
  personnel_id: Joi.string().trim().required().messages({
    'any.required': 'ID quân nhân là bắt buộc',
  }),
  nam: Joi.number().integer().min(1900).max(2100).required().messages({
    'any.required': 'Năm là bắt buộc',
  }),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  chuc_vu: Joi.string().trim().optional().allow(null, ''),
  so_quyet_dinh: Joi.string().trim().optional().allow(null, ''),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
};

/**
 * Wraps an item schema into { items: [...] } body schema
 */
const wrapItemsSchema = (itemSchema: Joi.ObjectSchema): Joi.ObjectSchema =>
  Joi.object({
    items: Joi.array().items(itemSchema).min(1).required().messages({
      'array.min': 'Danh sách phải có ít nhất 1 mục',
      'any.required': 'Danh sách items là bắt buộc',
    }),
  });

/**
 * Shared schema: personnel base fields + danh_hieu required
 * Used by: Annual Reward, HCCSVV, Contribution Award (HCBVTQ)
 */
const personnelWithDanhHieuSchema = wrapItemsSchema(
  Joi.object({
    ...personnelImportItemBase,
    danh_hieu: Joi.string().trim().required().messages({
      'any.required': 'Danh hiệu là bắt buộc',
    }),
  })
);

/**
 * Shared schema: personnel base fields only
 * Used by: Military Flag, Commemorative Medal
 */
const personnelBaseSchema = wrapItemsSchema(
  Joi.object({
    ...personnelImportItemBase,
  })
);

/** Annual reward. */
export const confirmImportAnnualReward: Joi.ObjectSchema = personnelWithDanhHieuSchema;

/** Glorious Soldier Medal (HCCSVV). */
export const confirmImportHccsvv: Joi.ObjectSchema = personnelWithDanhHieuSchema;

/** Fatherland Defense Order (Contribution Award / HCBVTQ). */
export const confirmImportContributionAward: Joi.ObjectSchema = personnelWithDanhHieuSchema;

/** Determined-to-Win Military Flag Medal. */
export const confirmImportMilitaryFlag: Joi.ObjectSchema = personnelBaseSchema;

/** Commemorative Medal for Building the Vietnam People's Army. */
export const confirmImportCommemorativeMedal: Joi.ObjectSchema = personnelBaseSchema;

/**
 * Scientific achievement.
 * Fields: personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu
 */
export const confirmImportScientificAchievement: Joi.ObjectSchema = wrapItemsSchema(
  Joi.object({
    ...personnelImportItemBase,
    loai: Joi.string().trim().required().messages({
      'any.required': 'Loại thành tích là bắt buộc',
    }),
    mo_ta: Joi.string().trim().optional().allow(null, ''),
  })
);

/**
 * Annual unit award.
 * Fields: unit_id, nam, danh_hieu, so_quyet_dinh, ghi_chu, is_co_quan_don_vi
 */
export const confirmImportUnitAnnualAward: Joi.ObjectSchema = wrapItemsSchema(
  Joi.object({
    unit_id: Joi.string().trim().required().messages({
      'any.required': 'ID đơn vị là bắt buộc',
    }),
    nam: Joi.number().integer().min(1900).max(2100).required().messages({
      'any.required': 'Năm là bắt buộc',
    }),
    danh_hieu: Joi.string().trim().required().messages({
      'any.required': 'Danh hiệu là bắt buộc',
    }),
    so_quyet_dinh: Joi.string().trim().optional().allow(null, ''),
    ghi_chu: Joi.string().trim().optional().allow(null, ''),
    is_co_quan_don_vi: Joi.boolean().required().messages({
      'any.required': 'Loại đơn vị (is_co_quan_don_vi) là bắt buộc',
    }),
  })
);
