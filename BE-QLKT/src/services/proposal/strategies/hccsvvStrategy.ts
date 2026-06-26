import { tenureMedalRepository } from '../../../repositories/tenureMedal.repository';
import { quanNhanRepository } from '../../../repositories/quanNhan.repository';
import { tenureProfileRepository } from '../../../repositories/tenureProfile.repository';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { DANH_HIEU_HCCSVV, getLoaiDeXuatName } from '../../../constants/danhHieu.constants';
import { ELIGIBILITY_STATUS } from '../../../constants/eligibilityStatus.constants';
import { validateHCCSVVRankOrder } from '../../../helpers/awardValidation/tenureMedalRankOrder';
import { formatPersonnelLabel } from './personnelLabel';
import { calculateServiceMonths, formatServiceDuration } from '../../../helpers/serviceYearsHelper';
import type { EditedProposalData, ProposalNienHanItem } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';
import {
  loadPersonnelWithUnitsMap,
  buildNienHanPayloadItem,
  type NienHanInputItem,
} from './nienHanPayloadHelper';

// Nhãn tiếng Việt của loại đề xuất NIEN_HAN, tính 1 lần để tái dùng trong
// mọi message lỗi (tránh gọi getLoaiDeXuatName lặp lại trong vòng lặp).
const NIEN_HAN_LABEL = getLoaiDeXuatName(PROPOSAL_TYPES.NIEN_HAN);

/**
 * Strategy xử lý đề xuất HCCSVV (Huy chương Chiến sĩ vẻ vang) theo loại
 * NIEN_HAN — xét trao theo niên hạn (số năm công tác), gồm 3 hạng tuần tự
 * Hạng Ba -> Hạng Nhì -> Hạng Nhất. Implement interface ProposalStrategy
 * nên TỰ VIẾT đủ buildSubmitPayload + importInTransaction (không có code cha).
 */
class HccsvvStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.NIEN_HAN;

  /**
   * Chuẩn hoá dữ liệu khi Manager nộp đề xuất HCCSVV và validate sơ bộ.
   * Làm 2 lớp kiểm tra: (1) chỉ cho phép các hạng HCCSVV, (2) đúng thứ tự
   * hạng Ba -> Nhì -> Nhất so với các hạng quân nhân đã có trên hệ thống.
   * @param titleData - Danh sách item thô từ request body
   * @param ctx - Ngữ cảnh nộp đề xuất (người nộp, đơn vị, năm, tháng)
   * @returns Mảng lỗi validate + payload đã chuẩn hoá cho cột data_nien_han
   */
  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as NienHanInputItem[];
    // Batch nạp quân nhân + đơn vị + ngày nhập/xuất ngũ 1 lần để tránh N+1
    // khi build payload (thoi_gian niên hạn cần ngày nhập ngũ của từng người).
    const personnelIds = items.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    const personnelMap = await loadPersonnelWithUnitsMap(personnelIds);

    // Dùng helper dùng chung với HC_QKQT/KNC: payload niên hạn có cùng shape
    // (gắn thoi_gian phục vụ + thông tin đơn vị) chỉ khác danh hiệu bên trong.
    const dataNienHan = items.map(item =>
      buildNienHanPayloadItem(
        item,
        item.personnel_id ? personnelMap.get(item.personnel_id) : undefined,
        ctx.nam,
        ctx.thang
      )
    );

    const errors: string[] = [];
    // Chặn nhầm loại: đề xuất NIEN_HAN chỉ chứa hạng HCCSVV. HC_QKQT và KNC
    // tuy cũng là "niên hạn" nhưng có loại đề xuất riêng -> không lẫn vào đây.
    const allowedDanhHieus = Object.values(DANH_HIEU_HCCSVV) as string[];
    const danhHieus = dataNienHan.map(i => i.danh_hieu).filter(Boolean) as string[];
    const invalidDanhHieus = danhHieus.filter(dh => !allowedDanhHieus.includes(dh));
    if (invalidDanhHieus.length > 0) {
      errors.push(
        `Loại đề xuất "${NIEN_HAN_LABEL}" chỉ cho phép các hạng HCCSVV. ` +
          `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}. ` +
          `Vui lòng sử dụng loại đề xuất riêng cho HC_QKQT hoặc KNC_VSNXD_QDNDVN.`
      );
    }

    // Chỉ kiểm thứ tự hạng khi không còn lỗi loại danh hiệu — nếu đã sai loại
    // thì check thứ tự vô nghĩa, tránh đẩy thêm message gây rối cho người dùng.
    if (errors.length === 0) {
      const evalIds = dataNienHan
        .map(i => i.personnel_id)
        .filter((id): id is string => Boolean(id));
      if (evalIds.length > 0) {
        // Batch query HCCSVV đã có của những người trong đề xuất, để kiểm tra
        // THỨ TỰ HẠNG: phải Ba → Nhì → Nhất, không nhảy cóc / không cấp ngược.
        // SQL minh hoạ:
        //   SELECT quan_nhan_id, danh_hieu, nam FROM "KhenThuongHCCSVV"
        //     WHERE quan_nhan_id IN ('id1','id2', ...);
        const existingHCCSVV = await tenureMedalRepository.findManyRaw({
          where: { quan_nhan_id: { in: evalIds } },
          select: { quan_nhan_id: true, danh_hieu: true, nam: true },
        });
        // Gom thành Map quan_nhan_id → [danh hiệu đã có] để tra O(1) trong vòng lặp.
        const hccsvvByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
        for (const r of existingHCCSVV) {
          const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
          list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
          hccsvvByPersonnel.set(r.quan_nhan_id, list);
        }
        // Với mỗi item: đối chiếu hạng đề xuất với các hạng đã có để bắt buộc
        // tuần tự Ba -> Nhì -> Nhất và năm nhận tăng dần (rule trong helper).
        // Fallback tên 'một quân nhân' khi ho_ten null — không lộ ID kỹ thuật.
        const rankOrderErrors: string[] = [];
        for (const item of dataNienHan) {
          if (!item.personnel_id || !item.danh_hieu) continue;
          const existing = hccsvvByPersonnel.get(item.personnel_id) || [];
          const orderError = validateHCCSVVRankOrder(item.danh_hieu, ctx.nam, existing);
          if (orderError) {
            const personnel = personnelMap.get(item.personnel_id);
            const hoTen = personnel?.ho_ten || 'một quân nhân';
            rankOrderErrors.push(`${hoTen}: ${orderError}`);
          }
        }
        if (rankOrderErrors.length > 0) {
          errors.push(
            `Một số quân nhân chưa đủ điều kiện theo thứ tự hạng HCCSVV:\n${rankOrderErrors.join('\n')}`
          );
        }
      }
    }

    return { errors, payload: { data_nien_han: dataNienHan } };
  }

  /**
   * Ghi HCCSVV vào bảng khen thưởng + cập nhật hồ sơ niên hạn trong cùng
   * 1 transaction khi Admin duyệt đề xuất. Validate lại thứ tự hạng và mốc
   * thời gian nhận ngay trước khi ghi (không tin payload đã chỉnh tay).
   * Mỗi item lỗi chỉ ghi message generic vào acc.errors và bỏ qua item đó,
   * không throw — để các item hợp lệ khác vẫn được lưu.
   * @param editedData - Payload JSON đã được Admin chỉnh sửa khi duyệt
   * @param ctx - Ngữ cảnh duyệt (năm/tháng đề xuất, mapping số quyết định)
   * @param _decisions - Map số quyết định (không dùng ở loại HCCSVV)
   * @param _pdfPaths - Map đường dẫn PDF quyết định (không dùng ở đây)
   * @param acc - Bộ tích luỹ kết quả (lỗi, số bản ghi, id bị ảnh hưởng)
   * @param prismaTx - Transaction client đang mở
   */
  /** See HcQkqtStrategy — approve flow lives in approve.ts pipeline. */
  async importInTransaction(
    editedData: EditedProposalData,
    ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void> {
    const nienHanData = (editedData.data_nien_han ?? []) as ProposalNienHanItem[];
    const decisionMapping = ctx.mappings?.decisionMapping ?? {};
    const proposalYear = ctx.proposalYear;
    const proposalMonth = ctx.proposalMonth;

    // Batch các hạng HCCSVV đã có (trong transaction) để check lại thứ tự hạng
    // tại thời điểm duyệt — gom thành Map quan_nhan_id -> danh sách hạng đã có.
    const personnelIds = nienHanData.map(it => it.personnel_id).filter(Boolean) as string[];
    const existingForOrder = await tenureMedalRepository.findManyRaw(
      {
        where: { quan_nhan_id: { in: personnelIds } },
        select: { quan_nhan_id: true, danh_hieu: true, nam: true },
      },
      prismaTx
    );
    const existingByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
    for (const r of existingForOrder) {
      const list = existingByPersonnel.get(r.quan_nhan_id) || [];
      list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
      existingByPersonnel.set(r.quan_nhan_id, list);
    }

    const allowedDanhHieus = Object.values(DANH_HIEU_HCCSVV) as string[];

    for (const item of nienHanData) {
      try {
        if (!item.personnel_id) {
          acc.errors.push(`Thiếu thông tin quân nhân khi xử lý ${NIEN_HAN_LABEL}.`);
          continue;
        }
        // Đọc lại quân nhân từ DB (không tin snapshot trong payload): có thể đã
        // bị xoá giữa lúc nộp và lúc duyệt -> báo lỗi để Admin tải lại đề xuất.
        const personnel = await quanNhanRepository.findUniqueRaw(
          { where: { id: item.personnel_id } },
          prismaTx
        );
        if (!personnel) {
          acc.errors.push(
            `Không tìm thấy thông tin quân nhân khi xử lý ${NIEN_HAN_LABEL}. ` +
              'Quân nhân có thể đã bị xoá khỏi hệ thống — vui lòng tải lại đề xuất.'
          );
          continue;
        }
        if (!item.danh_hieu) {
          acc.errors.push(`${formatPersonnelLabel(personnel)} chưa chọn hạng ${NIEN_HAN_LABEL}.`);
          continue;
        }
        // Bỏ qua âm thầm hạng không thuộc HCCSVV — đề xuất có thể trộn nhiều
        // loại; loại khác sẽ do strategy tương ứng xử lý, không báo lỗi ở đây.
        if (!allowedDanhHieus.includes(item.danh_hieu)) continue;

        // Số QĐ ưu tiên giá trị nhập tay trên item, fallback về mapping chung
        // theo từng hạng (Admin có thể nhập 1 số QĐ áp cho cả nhóm cùng hạng).
        const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
        const soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
        const namNhan = item.nam_nhan;
        const thangNhan = item.thang_nhan;
        if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
          acc.errors.push(`${formatPersonnelLabel(personnel)} thiếu tháng/năm nhận huy chương`);
          continue;
        }
        // Mốc nhận không được trước mốc đề xuất (so theo năm trước, rồi tháng
        // khi cùng năm) — không thể "trao trước cả khi đề xuất được lập".
        if (
          namNhan < proposalYear ||
          (proposalMonth != null && namNhan === proposalYear && thangNhan < proposalMonth)
        ) {
          acc.errors.push(
            `${formatPersonnelLabel(personnel)}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposalMonth ?? '--'}/${proposalYear})`
          );
          continue;
        }
        // Năm nhận không được trước năm ra quyết định (chỉ check khi FE gửi
        // nam_quyet_dinh; KHÔNG check thang_quyet_dinh vì FE không gửi field đó).
        if (item.nam_quyet_dinh && namNhan < item.nam_quyet_dinh) {
          acc.errors.push(
            `${formatPersonnelLabel(personnel)}: năm nhận (${namNhan}) không được trước năm quyết định (${item.nam_quyet_dinh})`
          );
          continue;
        }

        // Tái kiểm thứ tự hạng tại thời điểm duyệt (dùng năm nhận thực tế,
        // không phải năm đề xuất) — bắt buộc đã có hạng dưới với năm sớm hơn.
        const orderError = validateHCCSVVRankOrder(
          item.danh_hieu,
          namNhan,
          existingByPersonnel.get(personnel.id) || []
        );
        if (orderError) {
          acc.errors.push(`${formatPersonnelLabel(personnel)}: ${orderError}`);
          continue;
        }

        // Tính lại thời gian phục vụ (niên hạn) làm bằng chứng đủ năm cho hạng:
        // mốc kết thúc là ngày xuất ngũ nếu có, ngược lại lấy cuối tháng nhận
        // (new Date(year, month, 0) = ngày cuối của tháng `month`).
        let thoiGian: {
          total_months: number;
          years: number;
          months: number;
          display: string;
        } | null = null;
        if (personnel.ngay_nhap_ngu) {
          const ngayKetThuc = personnel.ngay_xuat_ngu
            ? new Date(personnel.ngay_xuat_ngu)
            : new Date(namNhan, thangNhan, 0);
          const months = calculateServiceMonths(new Date(personnel.ngay_nhap_ngu), ngayKetThuc);
          thoiGian = {
            total_months: months,
            years: Math.floor(months / 12),
            months: months % 12,
            display: formatServiceDuration(months),
          };
        }

        const awardData = {
          nam: namNhan,
          thang: thangNhan,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          ghi_chu: item.ghi_chu || null,
          so_quyet_dinh: soQuyetDinh,
          thoi_gian: thoiGian,
        };

        // Upsert theo khoá (quan_nhan_id + danh_hieu): mỗi hạng HCCSVV lưu 1 row
        // riêng, duyệt lại cùng hạng sẽ cập nhật chứ không tạo bản ghi trùng.
        await tenureMedalRepository.upsertRaw(
          {
            where: {
              quan_nhan_id_danh_hieu: { quan_nhan_id: personnel.id, danh_hieu: item.danh_hieu },
            },
            update: awardData,
            create: { quan_nhan_id: personnel.id, danh_hieu: item.danh_hieu, ...awardData },
          },
          prismaTx
        );

        // Đồng bộ hồ sơ niên hạn: đánh dấu hạng tương ứng là DA_NHAN kèm ngày
        // nhận. Dùng UTC ngày 1 của tháng để mốc lưu nhất quán, không lệch TZ.
        const ngayNhan = new Date(Date.UTC(namNhan, thangNhan - 1, 1));
        const PROFILE_FIELDS: Record<string, { status: string; ngay: string }> = {
          [DANH_HIEU_HCCSVV.HANG_BA]: {
            status: 'hccsvv_hang_ba_status',
            ngay: 'hccsvv_hang_ba_ngay',
          },
          [DANH_HIEU_HCCSVV.HANG_NHI]: {
            status: 'hccsvv_hang_nhi_status',
            ngay: 'hccsvv_hang_nhi_ngay',
          },
          [DANH_HIEU_HCCSVV.HANG_NHAT]: {
            status: 'hccsvv_hang_nhat_status',
            ngay: 'hccsvv_hang_nhat_ngay',
          },
        };
        // Chọn đúng cặp cột status/ngay theo hạng (map ở trên) rồi upsert hồ sơ.
        const fields = PROFILE_FIELDS[item.danh_hieu];
        const profileUpdate = {
          [fields.status]: ELIGIBILITY_STATUS.DA_NHAN,
          [fields.ngay]: ngayNhan,
        };
        await tenureProfileRepository.upsert(
          personnel.id,
          { quan_nhan_id: personnel.id, ...profileUpdate },
          profileUpdate,
          prismaTx
        );

        acc.importedNienHan++;
        acc.affectedPersonnelIds.add(personnel.id);
      } catch (error) {
        // Log chi tiết kỹ thuật (personnel_id, stack) để debug, nhưng chỉ trả
        // message generic tiếng Việt cho người dùng — không lộ ID/lỗi nội bộ.
        console.error('[approveProposal] HCCSVV error:', {
          personnel_id: item.personnel_id,
          error,
        });
        acc.errors.push(`Có lỗi xảy ra khi lưu ${NIEN_HAN_LABEL}, vui lòng thử lại.`);
      }
    }
  }

}

export const hccsvvStrategy = new HccsvvStrategy();
