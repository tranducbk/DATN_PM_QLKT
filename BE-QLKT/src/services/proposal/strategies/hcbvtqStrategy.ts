import { quanNhanRepository } from '../../../repositories/quanNhan.repository';
import { positionHistoryRepository } from '../../../repositories/positionHistory.repository';
import { contributionMedalRepository } from '../../../repositories/contributionMedal.repository';
import { contributionProfileRepository } from '../../../repositories/contributionProfile.repository';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import {
  CONTRIBUTION_COEFFICIENT_GROUPS,
  DANH_HIEU_HCBVTQ,
  getDanhHieuName,
  getLoaiDeXuatName,
} from '../../../constants/danhHieu.constants';
import { ELIGIBILITY_STATUS } from '../../../constants/eligibilityStatus.constants';
import { RESOURCE_SLUGS } from '../../../constants/resourceSlugs.constants';
import { GENDER } from '../../../constants/gender.constants';
import { writeSystemLog } from '../../../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../../constants/auditActions.constants';
import { buildCutoffDate, formatServiceDuration } from '../../../helpers/serviceYearsHelper';
import { validateHCBVTQHighestRank } from '../../../helpers/awardValidation/contributionMedalHighestRank';
import { formatPersonnelLabel } from './personnelLabel';
import {
  aggregatePositionMonthsByGroup,
  type PositionMonthsByGroup,
} from '../../eligibility/contributionMonthsAggregator';
import {
  evaluateHCBVTQRank,
  getMonthsByGroup,
  loadHCBVTQEvaluationContext,
  requiredContributionMonths,
} from '../../eligibility/hcbvtqEligibility';
import { collectPersonnelDuplicateErrors } from '../../eligibility/personnelDuplicateCheck';
import type { EditedProposalData, ProposalCongHienItem } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';

// Nhãn loại đề xuất ("cống hiến") dùng nhất quán trong mọi message gửi cho user —
// lấy từ constant thay vì hardcode để đổi tên 1 chỗ là lan ra hết.
const CONTRIBUTION_LABEL = getLoaiDeXuatName(PROPOSAL_TYPES.CONG_HIEN);

// Item thô FE gửi lên lúc Manager nộp đề xuất: chỉ cần quân nhân + hạng huân chương
// muốn đề nghị; cấp bậc/chức vụ là snapshot tại thời điểm nộp (có thể null).
interface CongHienInputItem {
  personnel_id?: string;
  danh_hieu?: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

// Hàng quân nhân kèm cây đơn vị 2 cấp (cơ quan đơn vị cha + đơn vị trực thuộc con).
// Lưu cả 2 cấp để snapshot vào payload, hiển thị đúng đơn vị kể cả sau này đổi tên.
interface CongHienPersonnelRow {
  id: string;
  ho_ten: string | null;
  CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  DonViTrucThuoc: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  } | null;
}

/**
 * Nạp 1 lần toàn bộ quân nhân kèm cây đơn vị, trả về Map tra cứu theo id.
 * Gom batch để tránh N+1 khi build payload cho nhiều dòng cùng lúc.
 * @param personnelIds - Danh sách id quân nhân trong đề xuất
 * @returns Map id quân nhân → hàng dữ liệu (rỗng nếu input rỗng)
 */
async function loadPersonnelMap(
  personnelIds: string[]
): Promise<Map<string, CongHienPersonnelRow>> {
  if (personnelIds.length === 0) return new Map();
  const rows = await quanNhanRepository.findManyRaw({
    where: { id: { in: personnelIds } },
    select: {
      id: true,
      ho_ten: true,
      CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
      DonViTrucThuoc: {
        select: {
          id: true,
          ten_don_vi: true,
          ma_don_vi: true,
          CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
        },
      },
    },
  });
  return new Map(rows.map(r => [r.id, r as CongHienPersonnelRow]));
}

// Đóng gói số tháng thành object hiển thị (năm/tháng + chuỗi "X năm Y tháng").
// Lưu sẵn cả total_months thô để các bước sau tính toán, không phải parse lại chuỗi.
function formatTime(totalMonths: number) {
  return {
    total_months: totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    // 0 tháng hiển thị "-" thay vì "0 tháng" để bảng nhìn gọn, dễ phân biệt "chưa có".
    display: totalMonths === 0 ? '-' : formatServiceDuration(totalMonths),
  };
}

// Strategy cho loại đề xuất CONG_HIEN (Huân chương Bảo vệ Tổ quốc — HCBVTQ).
// HCBVTQ xét theo tổng số tháng giữ chức ở từng nhóm hệ số chứ không theo
// chuỗi danh hiệu hằng năm, nên logic tách hẳn khỏi các strategy khác.
class HcbvtqStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.CONG_HIEN;

  /**
   * Chuẩn hoá + kiểm tra dữ liệu lúc Manager nộp đề xuất HCBVTQ.
   * Snapshot đơn vị + tính sẵn số tháng theo 3 nhóm hệ số, rồi chặn trùng và
   * chặn đề nghị sai hạng (thiếu tháng hoặc thấp hơn hạng cao nhất đủ điều kiện).
   * @param titleData - Mảng item thô từ request body
   * @param ctx - Ngữ cảnh người nộp (đơn vị, năm, tháng đề xuất)
   * @returns Danh sách lỗi + payload đã đóng gói để lưu vào BangDeXuat
   */
  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as CongHienInputItem[];
    const personnelIds = items.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    const personnelMap = await loadPersonnelMap(personnelIds);

    // cutoffDate = mốc chốt tính thời gian phục vụ (cuối tháng/năm đề xuất). Không
    // tính tháng "tương lai" sau mốc này — số tháng phải đúng tại thời điểm xét.
    const cutoffDate = buildCutoffDate(ctx.nam, ctx.thang);

    const dataCongHien = await Promise.all(
      items.map(async item => {
        const personnel = item.personnel_id ? personnelMap.get(item.personnel_id) : undefined;
        // baseData = phần payload luôn có (không phụ thuộc lịch sử chức vụ). Snapshot
        // tên quân nhân + cả cây đơn vị cha/con để hiển thị ổn định kể cả sau đổi tên.
        const baseData = {
          personnel_id: item.personnel_id,
          ho_ten: personnel?.ho_ten || '',
          nam: ctx.nam,
          thang: ctx.thang,
          danh_hieu: item.danh_hieu,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          co_quan_don_vi: personnel?.CoQuanDonVi
            ? {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              }
            : null,
          don_vi_truc_thuoc: personnel?.DonViTrucThuoc
            ? {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              }
            : null,
        };

        // Không có quân nhân thì không tính được thời gian cống hiến → trả baseData
        // (dòng trống) để FE vẫn hiển thị, validate trùng/đủ ĐK xử lý ở vòng sau.
        if (!item.personnel_id) return baseData;
        try {
          // Lấy TOÀN BỘ lịch sử chức vụ để tính SỐ THÁNG CỐNG HIẾN theo từng NHÓM
          // HỆ SỐ — cơ sở xét hạng HCBVTQ. SQL minh hoạ:
          //   SELECT he_so_chuc_vu, so_thang, ngay_bat_dau, ngay_ket_thuc
          //     FROM "LichSuChucVu" WHERE quan_nhan_id = $personnelId;
          const histories = await positionHistoryRepository.findManyRaw({
            where: { quan_nhan_id: item.personnel_id },
            select: {
              he_so_chuc_vu: true,
              so_thang: true,
              ngay_bat_dau: true,
              ngay_ket_thuc: true,
            },
          });
          // Gộp tháng theo NHÓM HỆ SỐ: mỗi đoạn giữ chức cộng số tháng
          // (ngay_bat_dau → min(ngay_ket_thuc, cutoffDate)) vào nhóm theo he_so_chuc_vu:
          //   he_so 0.9-1.0 → nhóm cao  (đủ tháng ⇒ hạng Nhất)
          //   he_so 0.8     → nhóm giữa (⇒ Nhì)
          //   he_so 0.7     → nhóm thấp (⇒ Ba)
          // cutoffDate = mốc chốt (vd cuối năm xét) để không tính tháng "tương lai".
          const monthsByGroup = aggregatePositionMonthsByGroup(histories, cutoffDate);
          return {
            ...baseData,
            thoi_gian_nhom_0_7: formatTime(monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]),
            thoi_gian_nhom_0_8: formatTime(monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]),
            thoi_gian_nhom_0_9_1_0: formatTime(monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]),
          };
        } catch (error) {
          // Lỗi đọc lịch sử chức vụ không được làm hỏng cả đề xuất: log technical
          // (id + message) để debug rồi trả baseData (không có thời gian) cho dòng này.
          console.error('ProposalSubmit.fetchPositionHistory failed', {
            personnelId: item.personnel_id,
            error,
          });
          void writeSystemLog({
            action: AUDIT_ACTIONS.ERROR,
            resource: RESOURCE_SLUGS.PROPOSALS,
            description: `Lỗi lấy lịch sử chức vụ khi tạo đề xuất, quân nhân ${item.personnel_id}: ${(error as Error).message}`,
          });
          return baseData;
        }
      })
    );

    if (dataCongHien.length === 0) {
      return { errors: [], payload: { data_cong_hien: dataCongHien } };
    }

    const errors: string[] = [];
    const hoTenMap = new Map<string, string>(
      Array.from(personnelMap.entries()).map(([id, p]) => [id, p.ho_ten || id])
    );
    // Chặn trùng: cùng quân nhân + cùng năm + cùng danh hiệu thì không nộp lại.
    // Dừng ngay khi có trùng để Manager sửa trước, không cho lọt vào payload.
    const duplicateErrors = await collectPersonnelDuplicateErrors(
      dataCongHien,
      ctx.nam,
      this.type,
      { hoTenMap }
    );
    if (duplicateErrors.length > 0) {
      errors.push(
        `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
      );
      return { errors, payload: { data_cong_hien: dataCongHien } };
    }

    const evalIds = dataCongHien.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    if (evalIds.length === 0) {
      return { errors, payload: { data_cong_hien: dataCongHien } };
    }

    // Nạp 1 lần context xét điều kiện (giới tính + số tháng theo nhóm) cho mọi quân
    // nhân — 2 batch query duy nhất, dùng lại trong vòng lặp dưới (tránh N+1).
    const evalCtx = await loadHCBVTQEvaluationContext(evalIds, cutoffDate);

    for (const item of dataCongHien) {
      if (!item.danh_hieu || !item.personnel_id) continue;

      const personnel = personnelMap.get(item.personnel_id);
      // Fallback "một quân nhân" khi thiếu tên — không bao giờ lộ id kỹ thuật ra message.
      const hoTen =
        personnel?.ho_ten || evalCtx.hoTenByPersonnel.get(item.personnel_id) || 'một quân nhân';
      const gioiTinh = evalCtx.genderByPersonnel.get(item.personnel_id) ?? null;
      // Ngưỡng tháng phụ thuộc giới tính (nữ được giảm 1/3 thời gian), nên phải
      // tính theo từng quân nhân chứ không dùng 1 hằng số chung.
      const requiredMonths = requiredContributionMonths(gioiTinh);
      // Bóc số tháng đã gộp sẵn theo 3 nhóm hệ số để truyền vào các hàm xét hạng.
      const months: PositionMonthsByGroup = {
        [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: getMonthsByGroup(
          evalCtx,
          item.personnel_id,
          CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07
        ),
        [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: getMonthsByGroup(
          evalCtx,
          item.personnel_id,
          CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08
        ),
        [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: getMonthsByGroup(
          evalCtx,
          item.personnel_id,
          CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10
        ),
      };

      // HCBVTQ là huân chương lifetime, không thể nâng hạng sau khi đã trao. Nếu quân
      // nhân đủ điều kiện hạng cao hơn thì không cho đề nghị hạng thấp — phải trao đúng
      // hạng cao nhất ngay từ đầu.
      const downgradeError = validateHCBVTQHighestRank(item.danh_hieu, months, requiredMonths);
      if (downgradeError) {
        errors.push(`Quân nhân "${hoTen}": ${downgradeError}`);
        return { errors, payload: { data_cong_hien: dataCongHien } };
      }

      // Xét đúng hạng đã chọn có đủ tháng tích luỹ không. rank=null nghĩa là danh hiệu
      // không phải HCBVTQ hợp lệ → bỏ qua (đã chặn ở chỗ khác), không báo lỗi sai chỗ.
      const result = evaluateHCBVTQRank(item.danh_hieu, months, gioiTinh);
      if (!result.rank) continue;
      if (!result.eligible) {
        // Thiếu tháng cho hạng đề nghị: dựng message nêu rõ yêu cầu vs hiện có để
        // Manager biết chính xác còn thiếu bao nhiêu, kèm chú thích ưu đãi cho nữ.
        const totalYearsText = formatServiceDuration(result.totalMonths);
        const requiredYearsText = formatServiceDuration(result.requiredMonths);
        const genderText = gioiTinh === GENDER.FEMALE ? ' (Nữ giảm 1/3 thời gian)' : '';
        errors.push(
          `Quân nhân "${hoTen}" không đủ điều kiện đề xuất ${CONTRIBUTION_LABEL} ${result.rankName}. ` +
            `Yêu cầu: ít nhất ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}. ` +
            `Vui lòng kiểm tra lại lịch sử chức vụ của quân nhân này.`
        );
        return { errors, payload: { data_cong_hien: dataCongHien } };
      }
    }

    return { errors, payload: { data_cong_hien: dataCongHien } };
  }

  /**
   * Ghi HCBVTQ vào bảng đích khi Admin duyệt, chạy trong transaction chung.
   * Mỗi quân nhân chỉ giữ 1 bản ghi HCBVTQ: đã có thì chỉ nâng hạng (không hạ),
   * chưa có thì tạo mới; đồng thời cập nhật trạng thái hạng vào hồ sơ cống hiến.
   * Lỗi từng dòng được gom vào acc.errors (generic, không lộ id) để duyệt tiếp.
   * @param editedData - Payload đã được người duyệt chỉnh sửa
   * @param ctx - Ngữ cảnh duyệt (năm/tháng đề xuất, ...)
   * @param decisions - Map số quyết định theo key so_quyet_dinh_<loại>
   * @param _pdfPaths - Map file PDF (HCBVTQ không dùng nên prefix _)
   * @param acc - Bộ đếm/lỗi được mutate tại chỗ
   * @param prismaTx - Transaction client đang mở
   * @returns Không trả về; kết quả nằm trong acc
   */
  async importInTransaction(
    editedData: EditedProposalData,
    ctx: ProposalApproveContext,
    decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void> {
    const congHienData = (editedData.data_cong_hien ?? []) as ProposalCongHienItem[];
    const proposalYear = ctx.proposalYear;
    const proposalMonth = ctx.proposalMonth;

    for (const item of congHienData) {
      try {
        if (!item.personnel_id) {
          acc.errors.push(`Thiếu thông tin quân nhân khi xử lý ${CONTRIBUTION_LABEL}.`);
          continue;
        }
        // Đọc lại trong transaction để bắt trường hợp quân nhân bị xoá giữa lúc
        // nộp và lúc duyệt — tránh ghi mồ côi.
        const personnel = await quanNhanRepository.findUniqueRaw(
          { where: { id: item.personnel_id }, select: { id: true, ho_ten: true } },
          prismaTx
        );
        if (!personnel) {
          acc.errors.push(
            `Không tìm thấy thông tin quân nhân khi xử lý ${CONTRIBUTION_LABEL}. ` +
              'Quân nhân có thể đã bị xoá khỏi hệ thống — vui lòng tải lại đề xuất.'
          );
          continue;
        }

        // Số quyết định: ưu tiên giá trị riêng từng dòng (item) trước số chung của
        // cả đợt (decisions) — cho phép trộn nhiều quyết định trong 1 lần duyệt.
        const soQuyetDinhDanhHieu = item.so_quyet_dinh || decisions.so_quyet_dinh_cong_hien || null;
        const namNhan = item.nam_nhan;
        const thangNhan = item.thang_nhan;

        if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
          acc.errors.push(
            `${formatPersonnelLabel(personnel)} thiếu tháng/năm nhận ${CONTRIBUTION_LABEL}`
          );
          continue;
        }
        // Mốc nhận không được sớm hơn mốc đề xuất: không thể "nhận" huân chương trước
        // khi đề xuất tồn tại. So tháng chỉ khi cùng năm và đề xuất có tháng cụ thể.
        if (
          namNhan < proposalYear ||
          (proposalMonth != null && namNhan === proposalYear && thangNhan < proposalMonth)
        ) {
          acc.errors.push(
            `${formatPersonnelLabel(personnel)}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposalMonth ?? '--'}/${proposalYear})`
          );
          continue;
        }
        // Mốc nhận cũng không được sớm hơn mốc quyết định (nếu có). HCBVTQ có gửi
        // cả thang_quyet_dinh từ FE nên check tới cấp tháng — khác HCCSVV chỉ có năm.
        const namQuyetDinh = item.nam_quyet_dinh;
        const thangQuyetDinh = item.thang_quyet_dinh;
        if (
          namQuyetDinh &&
          (namNhan < namQuyetDinh ||
            (thangQuyetDinh && namNhan === namQuyetDinh && thangNhan < thangQuyetDinh))
        ) {
          acc.errors.push(
            `${formatPersonnelLabel(personnel)}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm quyết định (${thangQuyetDinh ?? '--'}/${namQuyetDinh})`
          );
          continue;
        }
        if (!item.danh_hieu) {
          acc.errors.push(`${formatPersonnelLabel(personnel)} chưa chọn hạng ${CONTRIBUTION_LABEL}.`);
          continue;
        }

        // Số tháng theo 3 nhóm hệ số (đã tính lúc nộp) lưu kèm bản ghi để tra cứu sau,
        // không phải tính lại; null khi dòng thiếu dữ liệu.
        const thoiGianNhom0_7 = item.thoi_gian_nhom_0_7 || null;
        const thoiGianNhom0_8 = item.thoi_gian_nhom_0_8 || null;
        const thoiGianNhom0_9_1_0 = item.thoi_gian_nhom_0_9_1_0 || null;

        // Mỗi quân nhân chỉ có duy nhất 1 bản ghi HCBVTQ (huân chương lifetime), nên
        // tra theo quan_nhan_id để quyết định nâng hạng hay tạo mới.
        const existingCongHien = await contributionMedalRepository.findUniqueRaw(
          { where: { quan_nhan_id: personnel.id } },
          prismaTx
        );

        if (existingCongHien) {
          // Xếp thứ tự hạng (Ba<Nhì<Nhất) để so cao/thấp — chỉ cho nâng hạng,
          // không bao giờ ghi đè bằng hạng thấp hơn hoặc bằng.
          const rankOrder: Record<string, number> = {
            [DANH_HIEU_HCBVTQ.HANG_BA]: 1,
            [DANH_HIEU_HCBVTQ.HANG_NHI]: 2,
            [DANH_HIEU_HCBVTQ.HANG_NHAT]: 3,
          };
          const existingRank = rankOrder[existingCongHien.danh_hieu] || 0;
          const newRank = rankOrder[item.danh_hieu] || 0;
          if (newRank > existingRank) {
            await contributionMedalRepository.update(
              existingCongHien.id,
              {
                danh_hieu: item.danh_hieu,
                nam: namNhan,
                thang: thangNhan,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: item.ghi_chu || null,
                so_quyet_dinh: soQuyetDinhDanhHieu,
                thoi_gian_nhom_0_7: thoiGianNhom0_7,
                thoi_gian_nhom_0_8: thoiGianNhom0_8,
                thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
              },
              prismaTx
            );
            acc.importedDanhHieu++;
            acc.affectedPersonnelIds.add(personnel.id);
          } else {
            // Hạng mới ≤ hạng đã có → từ chối nâng cấp, báo rõ tên hạng cũ/mới cho user.
            const existingDanhHieuName = getDanhHieuName(existingCongHien.danh_hieu);
            const newDanhHieuName = getDanhHieuName(item.danh_hieu);
            acc.errors.push(
              `Quân nhân "${personnel.ho_ten}" đã có ${CONTRIBUTION_LABEL} "${existingDanhHieuName}" (năm ${existingCongHien.nam}). ` +
                `Không thể lưu danh hiệu "${newDanhHieuName}" vì hạng thấp hơn hoặc bằng.`
            );
            continue;
          }
        } else {
          // Chưa có bản ghi → tạo mới HCBVTQ cho quân nhân (lần trao đầu tiên).
          await contributionMedalRepository.create(
            {
              quan_nhan_id: personnel.id,
              danh_hieu: item.danh_hieu,
              nam: namNhan,
              thang: thangNhan,
              cap_bac: item.cap_bac || null,
              chuc_vu: item.chuc_vu || null,
              ghi_chu: item.ghi_chu || null,
              so_quyet_dinh: soQuyetDinhDanhHieu,
              thoi_gian_nhom_0_7: thoiGianNhom0_7,
              thoi_gian_nhom_0_8: thoiGianNhom0_8,
              thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
            },
            prismaTx
          );
          acc.importedDanhHieu++;
          acc.affectedPersonnelIds.add(personnel.id);
        }

        // Ngoài bảng khen thưởng, đánh dấu trạng thái "đã nhận" + ngày nhận vào hồ sơ
        // cống hiến (mỗi hạng 1 cặp cột status/ngày riêng) để hồ sơ phản ánh đúng và
        // engine xét điều kiện về sau biết quân nhân đã có hạng nào.
        const ngayNhan = new Date(Date.UTC(namNhan, thangNhan - 1, 1));
        const HCBVTQ_FIELDS: Record<string, { status: string; ngay: string }> = {
          [DANH_HIEU_HCBVTQ.HANG_BA]: {
            status: 'hcbvtq_hang_ba_status',
            ngay: 'hcbvtq_hang_ba_ngay',
          },
          [DANH_HIEU_HCBVTQ.HANG_NHI]: {
            status: 'hcbvtq_hang_nhi_status',
            ngay: 'hcbvtq_hang_nhi_ngay',
          },
          [DANH_HIEU_HCBVTQ.HANG_NHAT]: {
            status: 'hcbvtq_hang_nhat_status',
            ngay: 'hcbvtq_hang_nhat_ngay',
          },
        };
        const profileFields = HCBVTQ_FIELDS[item.danh_hieu];
        if (profileFields) {
          const profileUpdate = {
            [profileFields.status]: ELIGIBILITY_STATUS.DA_NHAN,
            [profileFields.ngay]: ngayNhan,
          };
          // upsert: tạo hồ sơ nếu quân nhân chưa có (hcbvtq_total_months khởi tạo 0),
          // ngược lại chỉ cập nhật cặp cột của hạng vừa trao.
          await contributionProfileRepository.upsert(
            personnel.id,
            { quan_nhan_id: personnel.id, hcbvtq_total_months: 0, ...profileUpdate },
            profileUpdate,
            prismaTx
          );
        }
      } catch (error) {
        // Lỗi 1 dòng không làm hỏng cả đợt duyệt: log technical (id + stack) để debug,
        // đẩy message generic tiếng Việt cho user, vòng lặp tiếp tục dòng sau.
        console.error('[approveProposal] HCBVTQ error:', {
          personnel_id: item.personnel_id,
          error,
        });
        acc.errors.push(`Có lỗi xảy ra khi lưu ${CONTRIBUTION_LABEL}, vui lòng thử lại.`);
      }
    }
  }

}

export const hcbvtqStrategy = new HcbvtqStrategy();
