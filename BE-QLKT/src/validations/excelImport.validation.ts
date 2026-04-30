import { z } from 'zod';

const personnelImportItemBase = {
  personnel_id: z.string().trim().min(1, 'ID quân nhân là bắt buộc'),
  nam: z
    .number({ message: 'Năm là bắt buộc' })
    .int('Năm phải là số nguyên')
    .min(1900, 'Năm phải từ 1900 đến 2100')
    .max(2100, 'Năm phải từ 1900 đến 2100'),
  cap_bac: z.string().trim().nullable().optional(),
  chuc_vu: z.string().trim().nullable().optional(),
  so_quyet_dinh: z.string().trim().nullable().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
};

const wrapItemsSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z
      .array(itemSchema, { message: 'Danh sách items là bắt buộc' })
      .min(1, 'Danh sách phải có ít nhất 1 mục'),
  });

const personnelWithDanhHieuSchema = wrapItemsSchema(
  z.object({
    ...personnelImportItemBase,
    danh_hieu: z.string().trim().min(1, 'Danh hiệu là bắt buộc'),
  })
);

const personnelBaseSchema = wrapItemsSchema(z.object({ ...personnelImportItemBase }));

/** Annual reward. */
export const confirmImportAnnualReward = personnelWithDanhHieuSchema;

/** Glorious Soldier Medal (HCCSVV). */
export const confirmImportHccsvv = personnelWithDanhHieuSchema;

/** Fatherland Defense Order (Contribution Award / HCBVTQ). */
export const confirmImportContributionAward = personnelWithDanhHieuSchema;

/** Determined-to-Win Military Flag Medal. */
export const confirmImportMilitaryFlag = personnelBaseSchema;

/** Commemorative Medal for Building the Vietnam People's Army. */
export const confirmImportCommemorativeMedal = personnelBaseSchema;

/**
 * Scientific achievement.
 * Fields: personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu
 */
export const confirmImportScientificAchievement = wrapItemsSchema(
  z.object({
    ...personnelImportItemBase,
    loai: z.string().trim().min(1, 'Loại thành tích là bắt buộc'),
    mo_ta: z.string().trim().nullable().optional(),
  })
);

/**
 * Annual unit award.
 * Fields: unit_id, nam, danh_hieu, so_quyet_dinh, ghi_chu, is_co_quan_don_vi
 */
export const confirmImportUnitAnnualAward = wrapItemsSchema(
  z.object({
    unit_id: z.string().trim().min(1, 'ID đơn vị là bắt buộc'),
    nam: z
      .number({ message: 'Năm là bắt buộc' })
      .int('Năm phải là số nguyên')
      .min(1900, 'Năm phải từ 1900 đến 2100')
      .max(2100, 'Năm phải từ 1900 đến 2100'),
    danh_hieu: z.string().trim().min(1, 'Danh hiệu là bắt buộc'),
    so_quyet_dinh: z.string().trim().nullable().optional(),
    ghi_chu: z.string().trim().nullable().optional(),
    is_co_quan_don_vi: z.boolean({ message: 'Loại đơn vị (is_co_quan_don_vi) là bắt buộc' }),
  })
);
