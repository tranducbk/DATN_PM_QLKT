import { danhHieuHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { militaryFlagRepository } from '../../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';
import { DANH_HIEU_MAP, getDanhHieuName } from '../../constants/danhHieu.constants';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
  SERVICE_YEARS_PERSONNEL_NOT_FOUND,
} from '../eligibility/serviceYearsEligibility';

/*
 * Các bảng tra cứu (dispatch table) cho luồng cấp khen thưởng hàng loạt (bulk).
 * Mỗi bảng map loại đề xuất (ProposalType) -> hàm/cấu hình xử lý riêng cho loại đó.
 *
 * WHY dùng map thay vì chuỗi if/else theo loại: thêm một loại danh hiệu mới chỉ cần
 * viết hàm xử lý rồi đăng ký thêm 1 dòng vào bảng, không phải sửa rải rác nhiều khối
 * if/else ở các nơi khác nhau (tránh sót nhánh, dễ đọc, dễ mở rộng).
 *
 * Tất cả bảng đều dùng Partial<Record<...>>: chỉ loại nào cần mới có mặt, loại không
 * có trong bảng nghĩa là bước đó không áp dụng cho loại đó (caller tự bỏ qua).
 */

type AwardTableQueryFn = (
  personnelIds: string[],
  nam: number
) => Promise<Array<Record<string, unknown>>>;

/**
 * Bảng map loại đề xuất -> hàm truy vấn bản ghi khen thưởng đã có trên hệ thống.
 * Dùng để phát hiện trùng trước khi cấp; trả về dòng thô chứa `quan_nhan_id`
 * (kèm `danh_hieu` với những loại phân biệt theo hạng/danh hiệu).
 */
export const AWARD_TABLE_QUERIES: Partial<Record<ProposalType, AwardTableQueryFn>> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: (ids, nam) =>
    danhHieuHangNamRepository.findMany({
      where: { quan_nhan_id: { in: ids }, nam },
      select: { quan_nhan_id: true, danh_hieu: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.NIEN_HAN]: ids =>
    tenureMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true, danh_hieu: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.HC_QKQT]: ids =>
    militaryFlagRepository.findManyRaw({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: ids =>
    commemorativeMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.CONG_HIEN]: ids =>
    contributionMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true, danh_hieu: true },
    }) as Promise<Array<Record<string, unknown>>>,
};

/**
 * Bảng map loại đề xuất -> cách kiểm tra trùng và câu thông báo trùng tương ứng.
 * `mode`: 'pair' so trùng theo cặp (người + danh_hieu, vd cùng năm mới tính trùng);
 * 'personnel' so trùng theo người (mỗi quân nhân chỉ được nhận 1 lần). `buildLabel`
 * dựng câu báo lỗi tiếng Việt cho từng loại.
 */
export const DUPLICATE_STRATEGY: Partial<
  Record<
    ProposalType,
    {
      mode: 'pair' | 'personnel';
      buildLabel: (danhHieu: string, nam: number) => string;
    }
  >
> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
    mode: 'pair',
    buildLabel: (danhHieu, nam) => `${getDanhHieuName(danhHieu)} năm ${nam} đã có trên hệ thống`,
  },
  [PROPOSAL_TYPES.NIEN_HAN]: {
    mode: 'pair',
    buildLabel: danhHieu => `đã có ${getDanhHieuName(danhHieu)} trên hệ thống`,
  },
  [PROPOSAL_TYPES.HC_QKQT]: {
    mode: 'personnel',
    buildLabel: () => `đã có ${DANH_HIEU_MAP.HC_QKQT} trên hệ thống`,
  },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
    mode: 'personnel',
    buildLabel: () => `đã có ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} trên hệ thống`,
  },
  [PROPOSAL_TYPES.CONG_HIEN]: {
    mode: 'personnel',
    buildLabel: danhHieu => `đã có ${getDanhHieuName(danhHieu)} trên hệ thống`,
  },
};

type ServiceYearCheckFn = (personnelIds: string[]) => Promise<string[]>;

/**
 * Bảng map loại đề xuất -> hàm kiểm tra điều kiện thâm niên/dữ liệu của quân nhân.
 * Trả về mảng câu lỗi tiếng Việt (rỗng nếu tất cả đạt). Chỉ những loại có ràng buộc
 * thời gian phục vụ (HC_QKQT, KNC) hoặc cần dữ liệu nền (niên hạn cần ngày nhập ngũ)
 * mới có mặt trong bảng.
 */
export const SERVICE_YEAR_CHECKS: Partial<Record<ProposalType, ServiceYearCheckFn>> = {
  [PROPOSAL_TYPES.HC_QKQT]: async personnelIds => {
    const results = await batchEvaluateServiceYears(
      personnelIds,
      PROPOSAL_TYPES.HC_QKQT,
      new Date()
    );
    return results
      .map(r => buildServiceYearsErrorMessage(r, PROPOSAL_TYPES.HC_QKQT))
      .filter((m): m is string => m !== null);
  },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: async personnelIds => {
    const results = await batchEvaluateServiceYears(
      personnelIds,
      PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      new Date()
    );
    return results
      .map(r => buildServiceYearsErrorMessage(r, PROPOSAL_TYPES.KNC_VSNXD_QDNDVN))
      .filter((m): m is string => m !== null);
  },
  // Niên hạn không tính qua batchEvaluateServiceYears mà chỉ cần đủ dữ liệu nền:
  // bắt buộc có ngày nhập ngũ thì mới tính được niên hạn về sau.
  [PROPOSAL_TYPES.NIEN_HAN]: async personnelIds => {
    const errors: string[] = [];
    const personnelList = await quanNhanRepository.findManyRaw({
      where: { id: { in: personnelIds } },
      select: { id: true, ho_ten: true, ngay_nhap_ngu: true },
    });
    const map = new Map(personnelList.map(p => [p.id, p]));
    for (const id of personnelIds) {
      const qn = map.get(id);
      if (!qn) {
        errors.push(SERVICE_YEARS_PERSONNEL_NOT_FOUND);
        continue;
      }
      if (!qn.ngay_nhap_ngu) {
        errors.push(`${qn.ho_ten}: Chưa có thông tin ngày nhập ngũ`);
      }
    }
    return errors;
  },
};

/**
 * Danh sách loại đề xuất mà việc kiểm tra trùng dựa trên danh sách quân nhân được
 * chọn (selectedPersonnel), thay vì theo đơn vị. Caller dùng để chọn đúng nhánh
 * so trùng theo người.
 */
export const TYPES_WITH_PERSONNEL_DUP: ProposalType[] = [
  PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  PROPOSAL_TYPES.NIEN_HAN,
  PROPOSAL_TYPES.HC_QKQT,
  PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
  PROPOSAL_TYPES.CONG_HIEN,
];
