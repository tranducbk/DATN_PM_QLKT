import { danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import { unitAnnualProfileRepository } from '../../repositories/unitAnnualProfile.repository';
import {
  getDanhHieuName,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../constants/danhHieu.constants';
import { evaluateUnitChain, getUnitChainConfig } from '../eligibility/unitChainEvaluator';
import { resolveUnit, buildUnitIdFields } from '../../helpers/unitHelper';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  UNIT ANNUAL ELIGIBILITY — chuỗi danh hiệu ĐƠN VỊ (BKBQP/BKTTCP đơn vị)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  PARITY VỚI CÁ NHÂN (xem `services/profile/annual.ts`):
 *
 *      Cá nhân (`annual.ts`)                  ↔  Đơn vị (file này)
 *      ───────────────────────────────────────────────────────────
 *      calculateContinuousCSTDCS              ↔  calculateContinuousYears (ĐVQT)
 *      đếm BKBQP trong cửa sổ trượt           ↔  evaluateUnitChain → countFlag-
 *                                                InWindow (đếm nội bộ từ titleRows)
 *      countCSTDTQInStreak                    ↔  KHÔNG CÓ (đơn vị không CSTDTQ)
 *      computeChainContext                    ↔  recalculateAnnualUnit (inline)
 *      computeEligibilityFlags                ↔  checkUnitAwardEligibility
 *
 *  KHÁC BIỆT QUAN TRỌNG:
 *  ① 2 cấp đơn vị (CoQuanDonVi vs DonViTrucThuoc) → mọi query phải dùng
 *     OR clause: `[{co_quan_don_vi_id: donViId}, {don_vi_truc_thuoc_id: donViId}]`
 *     để match cả 2 loại FK trong cùng bảng DanhHieuDonViHangNam.
 *  ② Đơn vị KHÔNG có CSTDTQ trung gian → chuỗi chỉ 2 mức:
 *        ĐVQT (cơ bản, đếm streak) → BKBQP (chu kỳ 2y) → BKTTCP (chu kỳ 7y)
 *  ③ Đơn vị KHÔNG có NCKH → evaluateUnitChain truyền nckhStreak=0, bỏ qua
 *     check NCKH liên tục.
 *  ④ BKTTCP đơn vị KHÔNG lifetime → nhận lặp lại mỗi 7y (xem
 *     chainAwards.constants.ts: UNIT_CHAIN_AWARDS).
 *  ⑤ Tất cả các hàm đều ASYNC (cá nhân pure sync) vì đơn vị phải query
 *     bảng nhỏ hơn, không cache pre-load như cá nhân.
 *
 *  RECALC FLOW (recalculateAnnualUnit):
 *  - Trigger sau khi approve đề xuất DON_VI_HANG_NAM.
 *  - Tính: dvqt_lien_tuc, du_dieu_kien_bkbqp, du_dieu_kien_bkttcp, goi_y
 *    (text gợi ý cho FE). evaluateUnitChain tự đếm BKBQP trong cửa sổ trượt.
 *  - Upsert vào bảng UnitAnnualProfile (1 record/đơn vị/năm).
 * ════════════════════════════════════════════════════════════════════════════
 */

async function calculateContinuousYears(donViId: string, year: number) {
  year = Number(year);
  // Lấy các năm đơn vị ĐẠT ĐVQT (Đơn vị Quyết thắng), mới nhất trước, để đếm
  // CHUỖI LIÊN TỤC tính đến year-1. OR(...) vì donViId có thể là CQĐV hoặc ĐVTT.
  // SQL minh hoạ:
  //   SELECT nam, danh_hieu FROM "DanhHieuDonViHangNam"
  //     WHERE (co_quan_don_vi_id = $donVi OR don_vi_truc_thuoc_id = $donVi)
  //       AND nam <= $year - 1 AND danh_hieu = 'DVQT'
  //     ORDER BY nam DESC;
  // Vòng lặp dưới dừng NGAY khi gặp năm bị "đứt" (r.nam !== current) → độ dài chuỗi.
  const records = await danhHieuDonViHangNamRepository.findMany({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      nam: { lte: year - 1 },
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    },
    orderBy: { nam: 'desc' },
    select: { nam: true, danh_hieu: true },
  });

  let continuous = 0;
  let current = year - 1; // bắt đầu đếm từ năm liền trước năm xét
  for (const r of records) {
    if (r.nam !== current) break; // records sort giảm dần; năm không khớp mốc → chuỗi đứt, dừng
    continuous += 1;
    current -= 1; // lùi xuống năm liền trước để kiểm tra tiếp
  }
  return continuous;
}

async function calculateTotalDVQT(donViId: string, year: number) {
  year = Number(year);
  // Lấy mọi dòng danh hiệu đơn vị tới năm xét (kèm flag bằng khen) để dựng tổng số + chi tiết.
  const records = await danhHieuDonViHangNamRepository.findMany({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      nam: { lte: year },
      danh_hieu: { not: null },
    },
    select: {
      nam: true,
      danh_hieu: true,
      so_quyet_dinh: true,
      nhan_bkbqp: true,
      nhan_bkttcp: true,
      so_quyet_dinh_bkbqp: true,
      so_quyet_dinh_bkttcp: true,
    },
  });

  // Chỉ giữ danh hiệu CƠ BẢN (ĐVQT...) khi đếm "tổng số lần đạt"; loại các loại khác ra.
  const validRecords = records.filter(
    r => r.danh_hieu && DANH_HIEU_DON_VI_CO_BAN.has(r.danh_hieu)
  );
  return {
    total: validRecords.length,
    details: validRecords.map(r => ({
      nam: r.nam,
      danh_hieu: r.danh_hieu,
      so_quyet_dinh: r.so_quyet_dinh || null,
      nhan_bkbqp: r.nhan_bkbqp || false,
      nhan_bkttcp: r.nhan_bkttcp || false,
      so_quyet_dinh_bkbqp: r.so_quyet_dinh_bkbqp || null,
      so_quyet_dinh_bkttcp: r.so_quyet_dinh_bkttcp || null,
    })),
  };
}

function buildSuggestion(
  du_dieu_kien_bkbqp: boolean,
  du_dieu_kien_bkttcp: boolean
) {
  const tenBKBQP = getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP);
  const tenBKTTCP = getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);

  // Ưu tiên gợi ý mức CAO NHẤT đã đủ ĐK: BKTTCP trước, rồi BKBQP, cuối cùng "chưa đủ".
  if (du_dieu_kien_bkttcp) {
    return `Đã đủ điều kiện đề nghị xét ${tenBKTTCP}.`;
  }
  if (du_dieu_kien_bkbqp) {
    return `Đã đủ điều kiện đề nghị xét ${tenBKBQP}.`;
  }
  return `Chưa đủ điều kiện đề nghị xét ${tenBKBQP}.`;
}

export async function checkUnitAwardEligibility(donViId: string, year: number, danhHieu: string) {
  year = Number(year);
  // Chỉ chuỗi bằng khen (BKBQP/BKTTCP) mới cần xét điều kiện; danh hiệu cơ bản luôn pass.
  if (!DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu)) {
    return { eligible: true, reason: '' };
  }

  // Config chu kỳ + flag yêu cầu của danh hiệu; null = không phải chuỗi → pass.
  const config = getUnitChainConfig(danhHieu);
  if (!config) return { eligible: true, reason: '' };

  // Song song: (1) chuỗi ĐVQT liên tục, (2) toàn bộ dòng danh hiệu tới năm xét
  // (titleRows để evaluateUnitChain đếm flag trong cửa sổ trượt).
  const [dvqtLienTuc, danhHieuList] = await Promise.all([
    calculateContinuousYears(donViId, year),
    danhHieuDonViHangNamRepository.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: { lte: year },
      },
      orderBy: { nam: 'asc' },
    }),
  ]);

  const titleRows = danhHieuList as Array<Record<string, unknown> & { nam: number }>;
  // Chuỗi đơn vị hiện đều non-lifetime → nhánh này luôn false; giữ để tương
  // thích config nếu sau này có danh hiệu đơn vị lifetime.
  const hasReceived = config.isLifetime
    ? titleRows.some(r => r[config.flagColumn] === true)
    : false;

  return evaluateUnitChain(danhHieu, dvqtLienTuc, titleRows, year, hasReceived);
}

export async function recalculateAnnualUnit(donViId: string, year: number | null = null) {
  const { isCoQuanDonVi } = await resolveUnit(donViId);
  const targetYear = year ? Number(year) : new Date().getFullYear(); // mặc định năm hiện tại

  // Song song 3 phép tính: danh sách danh hiệu (titleRows), tổng/chi tiết ĐVQT, độ dài chuỗi liên tục.
  const [danhHieuList, dvqtResult, dvqtLienTuc] = await Promise.all([
    danhHieuDonViHangNamRepository.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: { lte: targetYear },
      },
      orderBy: { nam: 'asc' },
    }),
    calculateTotalDVQT(donViId, targetYear),
    calculateContinuousYears(donViId, targetYear),
  ]);

  const titleRows = danhHieuList as Array<Record<string, unknown> & { nam: number }>;
  // evaluateUnitChain tự đếm BKBQP trong cửa sổ trượt từ titleRows + targetYear.
  const du_dieu_kien_bkbqp = evaluateUnitChain(
    DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
    dvqtLienTuc,
    titleRows,
    targetYear
  ).eligible;
  const du_dieu_kien_bkttcp = evaluateUnitChain(
    DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
    dvqtLienTuc,
    titleRows,
    targetYear
  ).eligible;

  const goi_y = buildSuggestion(du_dieu_kien_bkbqp, du_dieu_kien_bkttcp);

  // Khóa upsert khác nhau theo cấp đơn vị (CQĐV vs ĐVTT) — đảm bảo 1 hồ sơ / đơn vị / năm.
  const whereCondition = isCoQuanDonVi
    ? { unique_co_quan_don_vi_nam: { co_quan_don_vi_id: donViId, nam: targetYear } }
    : { unique_don_vi_truc_thuoc_nam: { don_vi_truc_thuoc_id: donViId, nam: targetYear } };

  const hoSoData = {
    tong_dvqt: dvqtResult.total,
    tong_dvqt_json: dvqtResult.details,
    dvqt_lien_tuc: dvqtLienTuc,
    du_dieu_kien_bkbqp,
    du_dieu_kien_bkttcp,
    goi_y,
  };

  const hoSo = await unitAnnualProfileRepository.upsertRaw({
    where: whereCondition,
    update: hoSoData,
    create: {
      ...hoSoData,
      ...buildUnitIdFields(donViId, isCoQuanDonVi),
      nam: targetYear,
    },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: true,
    },
  });

  return hoSo;
}

export async function recalculate({ don_vi_id, nam }) {
  // TH1: chỉ định cả đơn vị + năm → recalc đúng 1 hồ sơ.
  if (don_vi_id && nam) {
    await recalculateAnnualUnit(don_vi_id, Number(nam));
    return 1;
  }

  // TH2: chỉ có đơn vị → recalc tất cả các năm đơn vị này từng có hồ sơ.
  if (don_vi_id) {
    const records = await unitAnnualProfileRepository.findManyRaw({
      where: {
        OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
      },
      select: { nam: true },
      distinct: ['nam'],
    });

    for (const r of records) {
      await recalculateAnnualUnit(don_vi_id, r.nam);
    }

    return records.length;
  }

  // TH3: không tham số → recalc TOÀN BỘ; gom cặp (đơn vị, năm) duy nhất rồi chạy lần lượt.
  const records = await unitAnnualProfileRepository.findManyRaw({
    select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true, nam: true },
  });

  const uniqueUnits = new Map();
  for (const r of records) {
    const unitId = r.co_quan_don_vi_id || r.don_vi_truc_thuoc_id;
    if (!uniqueUnits.has(unitId)) {
      uniqueUnits.set(unitId, new Set());
    }
    uniqueUnits.get(unitId).add(r.nam);
  }

  let count = 0;
  for (const [unitId, years] of uniqueUnits) {
    for (const year of years) {
      await recalculateAnnualUnit(unitId, year);
      count++;
    }
  }

  return count;
}
