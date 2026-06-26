import { z } from 'zod';
import { YEAR_MIN, YEAR_MAX } from '../constants/validation.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  EXCEL IMPORT VALIDATION — Zod schema cho bước CONFIRM (route validate())
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Đây là chốt chặn ở RANH GIỚI HTTP cho bước confirmImport: body { items: [...] }
 *  do FE gửi lên (KHÔNG phải file — file đã được parse ở bước preview). Validate
 *  shape trước khi vào service → service không phải tự kiểm kiểu dữ liệu thô.
 *
 *  Tái dùng qua composition (DRY):
 *   • personnelImportItemBase: field chung mọi loại cá nhân (id, năm, cấp/chức...).
 *   • wrapItemsSchema(x): bọc thành { items: array(x).min(1) } — schema chung cho
 *     mọi endpoint confirm, chỉ khác phần item bên trong.
 *   • Loại có danh hiệu → .extend danh_hieu; KNC/HCQKQT 1 hạng → dùng base trơn;
 *     NCKH thêm loai+mo_ta; đơn vị dùng unit_id thay personnel_id.
 *
 *  LƯU Ý: Zod object mặc định STRIP key lạ → field FE thừa bị loại tự động, không
 *  cần .passthrough (đúng rule security: không nhận field ngoài schema).
 * ════════════════════════════════════════════════════════════════════════════
 */

const personnelImportItemBase = {
  personnel_id: z.string().trim().min(1, 'ID quân nhân là bắt buộc'),
  nam: z
    .number({ message: 'Năm là bắt buộc' })
    .int('Năm phải là số nguyên')
    .min(YEAR_MIN, 'Năm phải từ 1900 đến 2100')
    .max(YEAR_MAX, 'Năm phải từ 1900 đến 2100'),
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

const danhHieuField = z.string().trim().min(1, 'Danh hiệu là bắt buộc');

// Must survive confirm validation — Zod strips unknown keys, dropping the month
const thangField = z
  .number({ message: 'Tháng là bắt buộc' })
  .int('Tháng phải là số nguyên')
  .min(1, 'Tháng phải từ 1 đến 12')
  .max(12, 'Tháng phải từ 1 đến 12');

const personnelWithDanhHieuSchema = wrapItemsSchema(
  z.object({ ...personnelImportItemBase, danh_hieu: danhHieuField })
);

const personnelBaseSchema = wrapItemsSchema(z.object({ ...personnelImportItemBase }));

const personnelWithDanhHieuAndThangSchema = wrapItemsSchema(
  z.object({ ...personnelImportItemBase, danh_hieu: danhHieuField, thang: thangField })
);

const personnelWithThangSchema = wrapItemsSchema(
  z.object({ ...personnelImportItemBase, thang: thangField })
);

/** Annual reward (yearly — no award month). */
export const confirmImportAnnualReward = personnelWithDanhHieuSchema;

/** Glorious Soldier Medal (HCCSVV). */
export const confirmImportHccsvv = personnelWithDanhHieuAndThangSchema;

/** Fatherland Defense Order (Contribution Award / HCBVTQ). */
export const confirmImportContributionAward = personnelWithDanhHieuAndThangSchema;

/** Determined-to-Win Military Flag Medal. */
export const confirmImportMilitaryFlag = personnelWithThangSchema;

/** Commemorative Medal for Building the Vietnam People's Army. */
export const confirmImportCommemorativeMedal = personnelWithThangSchema;

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
      .min(YEAR_MIN, 'Năm phải từ 1900 đến 2100')
      .max(YEAR_MAX, 'Năm phải từ 1900 đến 2100'),
    danh_hieu: z.string().trim().min(1, 'Danh hiệu là bắt buộc'),
    so_quyet_dinh: z.string().trim().nullable().optional(),
    ghi_chu: z.string().trim().nullable().optional(),
    is_co_quan_don_vi: z.boolean({ message: 'Loại đơn vị (is_co_quan_don_vi) là bắt buộc' }),
  })
);
