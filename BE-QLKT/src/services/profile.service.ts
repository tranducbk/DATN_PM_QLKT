import type { HoSoNienHan } from '../generated/prisma';
import { prisma } from '../models';
import { ELIGIBILITY_STATUS } from '../constants/eligibilityStatus.constants';
import { formatServiceDuration } from '../helpers/serviceYearsHelper';
import positionHistoryService from './positionHistory.service';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { NotFoundError } from '../middlewares/errorHandler';
import { DANH_HIEU_HCCSVV, DANH_HIEU_HCBVTQ, DANH_HIEU_CA_NHAN_BANG_KHEN, DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_CA_NHAN_CO_BAN, CONG_HIEN_BASE_REQUIRED_MONTHS, CONG_HIEN_FEMALE_REQUIRED_MONTHS } from '../constants/danhHieu.constants';
import { GENDER } from '../constants/gender.constants';

class ProfileService {
  /**
   * Loads or creates the annual profile with unit and position context.
   * @param personnelId - Personnel ID
   * @returns Annual profile row (created when missing)
   */
  async getAnnualProfile(personnelId) {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    let profile = await prisma.hoSoHangNam.findUnique({
      where: { quan_nhan_id: personnelId },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
            ChucVu: true,
          },
        },
      },
    });

    if (!profile) {
      profile = await prisma.hoSoHangNam.create({
        data: {
          quan_nhan_id: personnelId,
          tong_cstdcs: 0,
          tong_nckh: 0,
          tong_cstdcs_json: [],
          tong_nckh_json: [],
          cstdcs_lien_tuc: 0,
          du_dieu_kien_bkbqp: false,
          du_dieu_kien_cstdtq: false,
          goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập danh hiệu và thành tích.',
        },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: true,
              ChucVu: true,
            },
          },
        },
      });
    }

    return profile;
  }

  /**
   * Loads or creates the tenure profile and augments it with award year/month data.
   * @param personnelId - Personnel ID
   * @returns Tenure profile with hccsvv_nam_nhan timeline data
   */
  async getTenureProfile(personnelId) {
    const includeQuanNhan = {
      QuanNhan: {
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: { include: { CoQuanDonVi: true } },
          ChucVu: true,
          KhenThuongHCCSVV: { select: { danh_hieu: true, nam: true, thang: true } },
        },
      },
    };

    let profile = await prisma.hoSoNienHan.findUnique({
      where: { quan_nhan_id: personnelId },
      include: includeQuanNhan,
    });

    if (!profile) {
      profile = await prisma.hoSoNienHan.create({
        data: {
          quan_nhan_id: personnelId,
          hccsvv_hang_ba_status: ELIGIBILITY_STATUS.CHUA_DU,
          hccsvv_hang_nhi_status: ELIGIBILITY_STATUS.CHUA_DU,
          hccsvv_hang_nhat_status: ELIGIBILITY_STATUS.CHUA_DU,
          goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập lịch sử chức vụ.',
        },
        include: includeQuanNhan,
      });
    }

    (profile as Record<string, unknown>).hccsvv_nam_nhan = Object.fromEntries(
      (profile.QuanNhan?.KhenThuongHCCSVV || []).map(r => [r.danh_hieu, { nam: r.nam, thang: r.thang }])
    );

    return profile;
  }

  /**
   * Loads or creates the contribution profile with months and tier statuses.
   * @param personnelId - Personnel ID
   * @returns Contribution profile row (created when missing)
   */
  async getContributionProfile(personnelId) {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    let profile = await prisma.hoSoCongHien.findUnique({
      where: { quan_nhan_id: personnelId },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
            ChucVu: true,
          },
        },
      },
    });

    if (!profile) {
      profile = await prisma.hoSoCongHien.create({
        data: {
          quan_nhan_id: personnelId,
          hcbvtq_total_months: 0,
          hcbvtq_hang_ba_status: ELIGIBILITY_STATUS.CHUA_DU,
          hcbvtq_hang_nhi_status: ELIGIBILITY_STATUS.CHUA_DU,
          hcbvtq_hang_nhat_status: ELIGIBILITY_STATUS.CHUA_DU,
          goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập lịch sử chức vụ.',
        },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
              ChucVu: true,
            },
          },
        },
      });
    }

    return profile;
  }

  /**
   * Longest backward chain of calendar years ending at `year - 1` where each year has `danh_hieu === 'CSTDCS'`.
   * @param danhHieuList - `DanhHieuHangNam` rows (callers may pass filtered or full lists)
   * @param year - Evaluation anchor year
   * @returns Streak length; non-`CSTDCS` years in the sequence stop the count
   */
  calculateContinuousCSTDCS(danhHieuList, year) {
    let count = 0;
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const filteredRewards = sortedRewards.filter(r => r.nam <= year - 1);
    let currentYear = year - 1;
    for (const reward of filteredRewards) {
      if (reward.nam !== currentYear) break;
      if (reward.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS) {
        count++;
        currentYear--;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Counts consecutive approved science rows ending at `year - 1` (one per calendar year).
   * @param thanhTichList - `ThanhTichKhoaHoc` rows (any order; sorted internally)
   * @param year - Proposal / evaluation anchor year
   * @returns Streak length
   */
  calculateContinuousNCKH(thanhTichList, year) {
    let count = 0;
    const sortedRewards = [...thanhTichList].sort((a, b) => b.nam - a.nam);
    const filteredRewards = sortedRewards.filter(r => r.nam <= year - 1);
    const uniqueRewards = filteredRewards.filter(
      (item, index, self) => index === self.findIndex(t => t.nam === item.nam)
    );
    let currentYear = year - 1;
    for (const reward of uniqueRewards) {
      if (reward.nam !== currentYear) break;
      count++;
      currentYear--;
    }

    return count;
  }

  /**
   * Counts BKBQP awards on the 2-year cadence ending at `year - 1`.
   * @param danhHieuList - Annual title rows (any order)
   * @param year - Evaluation anchor year
   * @returns Number of BKBQP steps in the active chain
   */
  calculateContinuousBKBQP(danhHieuList, year) {
    let count = 0;
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const filteredRewards = sortedRewards.filter(r => r.nhan_bkbqp === true && r.nam <= year - 1);
    let currentYear = year - 1;

    for (const reward of filteredRewards) {
      if (reward.nam !== currentYear) break;
      count++;
      currentYear -= 2;
    }
    return count;
  }

  /**
   * Counts CSTDTQ awards on the 3-year cadence ending at `year - 1`.
   * @param danhHieuList - Annual title rows (any order)
   * @param year - Evaluation anchor year
   * @returns Number of CSTDTQ steps in the active chain
   */
  calculateContinuousCSTDTQ(danhHieuList, year) {
    let count = 0;
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const filteredRewards = sortedRewards.filter(r => r.nhan_cstdtq === true && r.nam <= year - 1);
    let currentYear = year - 1;

    for (const reward of filteredRewards) {
      if (reward.nam !== currentYear) break;
      count++;
      currentYear -= 3;
    }
    return count;
  }

  /**
   * Whether approved NCKH exists for any year in the candidate list.
   * @param nckhList - Approved `ThanhTichKhoaHoc` rows
   * @param years - Years to intersect (e.g. streak window)
   * @returns Flags plus the matching year subset
   */
  checkNCKHInYears(nckhList, years) {
    const nckhYears = nckhList.map(n => n.nam);
    const foundYears = years.filter(year => nckhYears.includes(year));
    return {
      hasNCKH: foundYears.length > 0,
      years: foundYears,
    };
  }

  /**
   * Detects admin-forced medals or broken CSTDCS chains that restart eligibility messaging.
   * @param danhHieuList - Annual rows (newest first after internal sort)
   * @returns Whether to show a one-off hint and whether streak counters reset
   */
  handleSpecialCases(danhHieuList) {
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const latestReward = sortedRewards[0];

    if (!latestReward) {
      return { isSpecialCase: false, goiY: '', resetChain: false };
    }

    // Case 1: Admin explicitly set BKTTCP (highest)
    if (latestReward.nhan_bkttcp === true) {
      return {
        isSpecialCase: true,
        goiY: `Đã nhận Bằng khen thi đua cấp phòng (Năm ${latestReward.nam}). Bắt đầu chuỗi thành tích mới.`,
        resetChain: true,
      };
    }

    // Case 2: Admin explicitly set CSTDTQ
    if (latestReward.nhan_cstdtq === true) {
      return {
        isSpecialCase: true,
        goiY: `Đã nhận Chiến sĩ thi đua Toàn quân (Năm ${latestReward.nam}). Bắt đầu chuỗi thành tích mới.`,
        resetChain: true,
      };
    }

    // Case 3: Admin explicitly set BKBQP (CSTDTQ not yet reached)
    if (latestReward.nhan_bkbqp === true && !latestReward.nhan_cstdtq) {
      return {
        isSpecialCase: true,
        goiY: `Đã nhận Bằng khen Bộ Quốc phòng (Năm ${latestReward.nam}).`,
        resetChain: false,
      };
    }

    // Case 4: Not eligible for CSTDCS this year
    if (latestReward.danh_hieu !== DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS && latestReward.danh_hieu !== null) {
      return {
        isSpecialCase: true,
        goiY: 'Chưa có CSTDCS liên tục. Cần đạt CSTDCS để bắt đầu tính điều kiện khen thưởng.',
        resetChain: true,
      };
    }

    return { isSpecialCase: false, goiY: '', resetChain: false };
  }

  /**
   * Eligibility date = enlistment + required years of service for the given HCCSVV tier.
   * @param ngayNhapNgu - Enlistment date
   * @param soNam - Required tenure (10 / 15 / 20)
   * @returns Calendar date when the tier becomes eligible, or `null` without enlistment
   */
  calculateEligibilityDate(ngayNhapNgu, soNam) {
    if (!ngayNhapNgu) return null;
    const eligibilityDate = new Date(ngayNhapNgu);
    eligibilityDate.setFullYear(eligibilityDate.getFullYear() + soNam);
    return eligibilityDate;
  }

  /**
   * Eligibility snapshot for one HCCSVV tier, including operator-facing `goiY` text.
   * @param ngayNhapNgu - Enlistment date
   * @param soNam - Required years for this tier
   * @param currentStatus - `ELIGIBILITY_STATUS` from `ho_so_nien_han`
   * @param hangName - Tier label
   * @returns Status, optional milestone date, and Vietnamese guidance string
   */
  calculateHCCSVV(ngayNhapNgu, soNam, currentStatus, hangName) {
    if (!ngayNhapNgu) {
      return {
        status: ELIGIBILITY_STATUS.CHUA_DU,
        ngay: null,
        goiY: `Chưa có ngày nhập ngũ. Không thể tính toán HCCSVV Hạng ${hangName}.`,
      };
    }

    const today = new Date();
    const eligibilityDate = this.calculateEligibilityDate(ngayNhapNgu, soNam);

    // Case 13: Admin explicitly set DA_NHAN
    if (currentStatus === ELIGIBILITY_STATUS.DA_NHAN) {
      return {
        status: ELIGIBILITY_STATUS.DA_NHAN,
        ngay: eligibilityDate,
        goiY: `Đã nhận HCCSVV Hạng ${hangName}.`,
      };
    }

    if (today >= eligibilityDate) {
      return {
        status: ELIGIBILITY_STATUS.DU_DIEU_KIEN,
        ngay: eligibilityDate,
        goiY: `Đủ điều kiện (${soNam} năm) xét HCCSVV Hạng ${hangName}. Ngày đủ điều kiện: ${eligibilityDate.toLocaleDateString('vi-VN')}.`,
      };
    }

    const monthsLeft = Math.max(0,
      (eligibilityDate.getFullYear() - today.getFullYear()) * 12 +
      eligibilityDate.getMonth() - today.getMonth()
    );
    return {
      status: ELIGIBILITY_STATUS.CHUA_DU,
      ngay: null,
      goiY: `Chưa đủ điều kiện (${soNam} năm) xét HCCSVV Hạng ${hangName}. Dự kiến: ${eligibilityDate.toLocaleDateString('vi-VN')} (còn ${formatServiceDuration(monthsLeft)}).`,
    };
  }

  /**
   * Loads personnel with awards/achievements and computes all streak counters.
   * @param personnelId - Personnel ID
   * @param year - Evaluation anchor year
   * @returns Personnel data, lists, and computed streaks
   */
  private async computeAnnualStreaks(personnelId: string, year: number) {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
      include: {
        DanhHieuHangNam: { where: { nam: { lte: year } }, orderBy: { nam: 'asc' } },
        ThanhTichKhoaHoc: { where: { nam: { lte: year } }, orderBy: { nam: 'asc' } },
      },
    });

    if (!personnel) throw new NotFoundError('Quân nhân');

    const danhHieuList = personnel.DanhHieuHangNam || [];
    const thanhTichList = personnel.ThanhTichKhoaHoc || [];

    const cstdcs_lien_tuc = this.calculateContinuousCSTDCS(
      danhHieuList.filter(dh => dh.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
      year
    );
    const nckh_lien_tuc = this.calculateContinuousNCKH(thanhTichList, year);
    const bkbqp_lien_tuc = this.calculateContinuousBKBQP(danhHieuList, year);
    const cstdtq_lien_tuc = this.calculateContinuousCSTDTQ(danhHieuList, year);

    return { personnel, danhHieuList, thanhTichList, cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc };
  }

  /**
   * Computes BKBQP / CSTDTQ / BKTTCP eligibility flags from streak counters.
   * @param streaks - Streak values from computeAnnualStreaks
   * @param danhHieuList - Full annual award list for re-check edge cases
   * @param year - Evaluation year
   * @returns Eligibility booleans for the three medal tiers
   */
  private computeEligibilityFlags(
    streaks: { cstdcs_lien_tuc: number; nckh_lien_tuc: number; bkbqp_lien_tuc: number; cstdtq_lien_tuc: number },
    danhHieuList: unknown[],
    year: number
  ) {
    const { cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc } = streaks;

    const du_dieu_kien_bkbqp =
      cstdcs_lien_tuc % 2 === 0 && cstdcs_lien_tuc >= 2 && nckh_lien_tuc >= cstdcs_lien_tuc;

    let du_dieu_kien_cstdtq =
      cstdcs_lien_tuc % 3 === 0 &&
      bkbqp_lien_tuc >= 1 &&
      cstdcs_lien_tuc >= 3 &&
      nckh_lien_tuc >= cstdcs_lien_tuc;
    // Edge case: at 6-year boundary, check BKBQP from previous year
    if (cstdcs_lien_tuc % 6 === 0) {
      const bkbqp_lt = this.calculateContinuousBKBQP(danhHieuList, year - 1);
      du_dieu_kien_cstdtq =
        cstdcs_lien_tuc % 3 === 0 &&
        bkbqp_lt >= 1 &&
        cstdcs_lien_tuc >= 3 &&
        nckh_lien_tuc >= cstdcs_lien_tuc;
    }

    const du_dieu_kien_bkttcp =
      cstdcs_lien_tuc % 7 === 0 &&
      bkbqp_lien_tuc % 3 === 0 &&
      cstdtq_lien_tuc % 2 === 0 &&
      nckh_lien_tuc >= cstdcs_lien_tuc &&
      cstdcs_lien_tuc >= 7 &&
      bkbqp_lien_tuc >= 3 &&
      cstdtq_lien_tuc >= 2;

    return { du_dieu_kien_bkbqp, du_dieu_kien_cstdtq, du_dieu_kien_bkttcp };
  }

  /**
   * Recomputes annual-profile counters and suggestion text for one personnel.
   * @param personnelId - Personnel ID
   * @param year - Evaluation year (defaults to current calendar year)
   * @returns Success response with message and updated profile row
   */
  async recalculateAnnualProfile(personnelId, year = new Date().getFullYear()) {
    const { danhHieuList, thanhTichList, cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc } =
      await this.computeAnnualStreaks(personnelId, year);

    const tong_cstdcs_json = danhHieuList
      .filter(
        dh => dh.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS || dh.nhan_bkbqp || dh.nhan_cstdtq || dh.nhan_bkttcp
      )
      .map(dh => ({
        nam: dh.nam,
        danh_hieu: dh.danh_hieu,
        so_quyet_dinh: dh.so_quyet_dinh || null,
        nhan_bkbqp: dh.nhan_bkbqp || false,
        nhan_cstdtq: dh.nhan_cstdtq || false,
        nhan_bkttcp: dh.nhan_bkttcp || false,
        so_quyet_dinh_bkbqp: dh.so_quyet_dinh_bkbqp || null,
        so_quyet_dinh_cstdtq: dh.so_quyet_dinh_cstdtq || null,
        so_quyet_dinh_bkttcp: dh.so_quyet_dinh_bkttcp || null,
      }))
      .sort((a, b) => a.nam - b.nam);
    const tong_cstdcs = tong_cstdcs_json.length;
    const tong_nckh_json = thanhTichList
      .map(tt => ({
        nam: tt.nam,
        loai: tt.loai,
        mo_ta: tt.mo_ta,
        so_quyet_dinh: tt.so_quyet_dinh || null,
      }))
      .sort((a, b) => a.nam - b.nam);
    const tong_nckh = tong_nckh_json.length;

    const { du_dieu_kien_bkbqp, du_dieu_kien_cstdtq, du_dieu_kien_bkttcp } =
      this.computeEligibilityFlags(
        { cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc },
        danhHieuList,
        year
      );

    const goi_y = du_dieu_kien_bkttcp
      ? 'Đã đủ điều kiện đề nghị xét Bằng khen thi đua cấp phòng (BKTTCP).'
      : du_dieu_kien_cstdtq
        ? 'Đã đủ điều kiện đề nghị xét Chiến sĩ thi đua Toàn quân.'
        : du_dieu_kien_bkbqp
          ? 'Đã đủ điều kiện đề nghị xét Bằng khen Bộ Quốc phòng.'
          : 'Chưa đủ điều kiện đề nghị xét Bằng khen Bộ Quốc phòng hoặc Chiến sĩ thi đua Toàn quân.';

    const profileData = {
      tong_cstdcs,
      tong_nckh,
      tong_cstdcs_json,
      tong_nckh_json,
      cstdcs_lien_tuc,
      nckh_lien_tuc,
      bkbqp_lien_tuc,
      cstdtq_lien_tuc,
      du_dieu_kien_bkbqp,
      du_dieu_kien_cstdtq,
      du_dieu_kien_bkttcp,
      goi_y,
    };

    const hoSoHangNam = await prisma.hoSoHangNam.upsert({
      where: { quan_nhan_id: personnelId },
      update: profileData,
      create: { quan_nhan_id: personnelId, ...profileData },
    });

    return {
      success: true,
      message: 'Tính toán hồ sơ hằng năm thành công',
      data: hoSoHangNam,
    };
  }

  /**
   * Chain eligibility for BKBQP / CSTDTQ / BKTTCP (proposal submit, approval, import preview).
   * @param personnelId - Personnel ID
   * @param year - Proposal year under validation
   * @param danhHieu - Medal code to validate
   * @returns Eligibility result with operator-facing reason
   */
  async checkAwardEligibility(personnelId, year, danhHieu) {
    if (!DANH_HIEU_CA_NHAN_BANG_KHEN.has(danhHieu)) {
      return { eligible: true, reason: '' };
    }

    let streaks;
    try {
      streaks = await this.computeAnnualStreaks(personnelId, year);
    } catch {
      return { eligible: false, reason: 'Quân nhân không tồn tại' };
    }

    const { cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc, danhHieuList } = streaks;

    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) {
      const eligible =
        cstdcs_lien_tuc % 2 === 0 && cstdcs_lien_tuc >= 2 && nckh_lien_tuc >= cstdcs_lien_tuc;
      return eligible
        ? { eligible: true, reason: 'Đủ điều kiện BKBQP' }
        : { eligible: false, reason: `Chưa đủ điều kiện BKBQP: cần 2 năm CSTDCS liên tục + mỗi năm có NCKH (hiện có ${cstdcs_lien_tuc} năm CSTDCS, ${nckh_lien_tuc} năm NCKH liên tục)` };
    }

    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ) {
      let eligible =
        cstdcs_lien_tuc % 3 === 0 &&
        bkbqp_lien_tuc >= 1 &&
        cstdcs_lien_tuc >= 3 &&
        nckh_lien_tuc >= cstdcs_lien_tuc;
      if (cstdcs_lien_tuc % 6 === 0) {
        const bkbqp_lt = this.calculateContinuousBKBQP(danhHieuList, year - 1);
        eligible =
          cstdcs_lien_tuc % 3 === 0 &&
          bkbqp_lt >= 1 &&
          cstdcs_lien_tuc >= 3 &&
          nckh_lien_tuc >= cstdcs_lien_tuc;
      }
      return eligible
        ? { eligible: true, reason: 'Đủ điều kiện CSTDTQ' }
        : { eligible: false, reason: `Chưa đủ điều kiện CSTDTQ: cần 3 năm CSTDCS liên tục + đã có BKBQP + mỗi năm có NCKH (hiện có ${cstdcs_lien_tuc} năm CSTDCS, ${bkbqp_lien_tuc} lần BKBQP, ${nckh_lien_tuc} năm NCKH liên tục)` };
    }

    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP) {
      const eligible =
        cstdcs_lien_tuc % 7 === 0 &&
        bkbqp_lien_tuc % 3 === 0 &&
        cstdtq_lien_tuc % 2 === 0 &&
        nckh_lien_tuc >= cstdcs_lien_tuc &&
        cstdcs_lien_tuc >= 7 &&
        bkbqp_lien_tuc >= 3 &&
        cstdtq_lien_tuc >= 2;
      return eligible
        ? { eligible: true, reason: 'Đủ điều kiện BKTTCP' }
        : { eligible: false, reason: `Chưa đủ điều kiện BKTTCP: cần 7 năm CSTDCS + 3 lần BKBQP + 2 lần CSTDTQ + NCKH mỗi năm (hiện có ${cstdcs_lien_tuc} CSTDCS, ${bkbqp_lien_tuc} BKBQP, ${cstdtq_lien_tuc} CSTDTQ, ${nckh_lien_tuc} NCKH)` };
    }

    return { eligible: true, reason: '' };
  }

  /**
   * Recomputes HCCSVV tier statuses and hints on `ho_so_nien_han` from `khen_thuong_hccsvv` (tenure medals only).
   * @param personnelId - Personnel ID
   * @returns Success message for admin flows
   */
  async recalculateTenureProfile(personnelId) {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
    });

      if (!personnel) {
        throw new NotFoundError('Quân nhân');
      }

      const existingProfile = await prisma.hoSoNienHan.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      const khenthuonghccsvv = await prisma.khenThuongHCCSVV.findMany({
        where: { quan_nhan_id: personnelId },
      });

      // Reset status when no HCCSVV awards exist
      let newProfile: Partial<HoSoNienHan> = existingProfile ?? {};
      newProfile.hccsvv_hang_ba_status = ELIGIBILITY_STATUS.CHUA_DU;
      newProfile.hccsvv_hang_nhi_status = ELIGIBILITY_STATUS.CHUA_DU;
      newProfile.hccsvv_hang_nhat_status = ELIGIBILITY_STATUS.CHUA_DU;

      // Store actual award year for FE display (differs from eligibility year)
      const hccsvvNamNhan: Record<string, number | null> = {
        [DANH_HIEU_HCCSVV.HANG_BA]: null,
        [DANH_HIEU_HCCSVV.HANG_NHI]: null,
        [DANH_HIEU_HCCSVV.HANG_NHAT]: null,
      };
      for (const kt of khenthuonghccsvv) {
        if (kt.danh_hieu === DANH_HIEU_HCCSVV.HANG_BA) {
          newProfile.hccsvv_hang_ba_status = ELIGIBILITY_STATUS.DA_NHAN;
          hccsvvNamNhan[DANH_HIEU_HCCSVV.HANG_BA] = kt.nam;
        }
        if (kt.danh_hieu === DANH_HIEU_HCCSVV.HANG_NHI) {
          newProfile.hccsvv_hang_nhi_status = ELIGIBILITY_STATUS.DA_NHAN;
          hccsvvNamNhan[DANH_HIEU_HCCSVV.HANG_NHI] = kt.nam;
        }
        if (kt.danh_hieu === DANH_HIEU_HCCSVV.HANG_NHAT) {
          newProfile.hccsvv_hang_nhat_status = ELIGIBILITY_STATUS.DA_NHAN;
          hccsvvNamNhan[DANH_HIEU_HCCSVV.HANG_NHAT] = kt.nam;
        }
      }

      // HCCSVV calculation
      const hccsvvBa = this.calculateHCCSVV(
        personnel.ngay_nhap_ngu,
        10,
        newProfile.hccsvv_hang_ba_status || ELIGIBILITY_STATUS.CHUA_DU,
        'Ba'
      );
      // Preserve the approval date entered by admins; do not recompute it here.
      if (hccsvvBa.status === ELIGIBILITY_STATUS.DA_NHAN && existingProfile?.hccsvv_hang_ba_ngay) {
        hccsvvBa.ngay = existingProfile.hccsvv_hang_ba_ngay;
      }

      // Rank 2 requires Rank 3 to already be received (DA_NHAN), not just eligible
      let hccsvvNhi;
      if (newProfile.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN) {
        hccsvvNhi = this.calculateHCCSVV(
          personnel.ngay_nhap_ngu,
          15,
          newProfile.hccsvv_hang_nhi_status || ELIGIBILITY_STATUS.CHUA_DU,
          'Nhì'
        );
        if (hccsvvNhi.status === ELIGIBILITY_STATUS.DA_NHAN && existingProfile?.hccsvv_hang_nhi_ngay) {
          hccsvvNhi.ngay = existingProfile.hccsvv_hang_nhi_ngay;
        }
      } else {
        hccsvvNhi = {
          status: ELIGIBILITY_STATUS.CHUA_DU,
          ngay: null,
          goiY: '',
        };
      }

      // Rank 1 requires Rank 2 to already be received (DA_NHAN)
      let hccsvvNhat;
      if (newProfile.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN) {
        hccsvvNhat = this.calculateHCCSVV(
          personnel.ngay_nhap_ngu,
          20,
          newProfile.hccsvv_hang_nhat_status || ELIGIBILITY_STATUS.CHUA_DU,
          'Nhất'
        );
        if (hccsvvNhat.status === ELIGIBILITY_STATUS.DA_NHAN && existingProfile?.hccsvv_hang_nhat_ngay) {
          hccsvvNhat.ngay = existingProfile.hccsvv_hang_nhat_ngay;
        }
      } else {
        hccsvvNhat = {
          status: ELIGIBILITY_STATUS.CHUA_DU,
          ngay: null,
          goiY: '',
        };
      }

      const goiYList = [];
      if (hccsvvBa.goiY) goiYList.push(hccsvvBa.goiY);
      if (hccsvvNhi.goiY) goiYList.push(hccsvvNhi.goiY);
      if (hccsvvNhat.goiY) goiYList.push(hccsvvNhat.goiY);

      const finalGoiY =
        goiYList.length > 0
          ? goiYList.join('\n')
          : 'Chưa đủ điều kiện xét Huy chương Chiến sĩ vẻ vang.';

      const tenureData = {
        hccsvv_hang_ba_status: hccsvvBa.status,
        hccsvv_hang_ba_ngay: hccsvvBa.ngay,
        hccsvv_hang_nhi_status: hccsvvNhi.status,
        hccsvv_hang_nhi_ngay: hccsvvNhi.ngay,
        hccsvv_hang_nhat_status: hccsvvNhat.status,
        hccsvv_hang_nhat_ngay: hccsvvNhat.ngay,
        goi_y: finalGoiY,
      };

      await prisma.hoSoNienHan.upsert({
        where: { quan_nhan_id: personnelId },
        update: tenureData,
        create: { quan_nhan_id: personnelId, ...tenureData },
      });
    return { message: 'Tính toán lại hồ sơ Huy chương Chiến sĩ vẻ vang thành công' };
  }

  /**
   * Recomputes HCBVTQ months and tier eligibility on `ho_so_cong_hien` from position history and existing medals.
   * @param personnelId - Personnel ID
   * @returns Success message for admin flows
   */
  async recalculateContributionProfile(personnelId) {
    const checkEligibleForRank = (personnel, rank) => {
      const months0_9_1_0 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.9-1.0');
      const months0_8 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.8');
      const months0_7 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.7');
      const baseRequiredMonths = CONG_HIEN_BASE_REQUIRED_MONTHS;
      const femaleRequiredMonths = CONG_HIEN_FEMALE_REQUIRED_MONTHS;

      const requiredMonths =
        personnel?.gioi_tinh === GENDER.FEMALE ? femaleRequiredMonths : baseRequiredMonths;

      if (rank === 'HANG_NHAT') {
        return months0_9_1_0 >= requiredMonths;
      } else if (rank === 'HANG_NHI') {
        return months0_8 + months0_9_1_0 >= requiredMonths;
      } else if (rank === 'HANG_BA') {
        return months0_7 + months0_8 + months0_9_1_0 >= requiredMonths;
      }

      return false;
    };
    const getTotalMonthsByGroup = (histories, group) => {
      let totalMonths = 0;

      histories.forEach(history => {
        const heSo = Number(history.he_so_chuc_vu) || 0;
        let belongsToGroup = false;

        if (group === '0.7') {
          belongsToGroup = heSo >= 0.7 && heSo < 0.8;
        } else if (group === '0.8') {
          belongsToGroup = heSo >= 0.8 && heSo < 0.9;
        } else if (group === '0.9-1.0') {
          belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
        }
        const monthDiff = (start, end) => {
          const s = new Date(start);
          const e = new Date(end);

          return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
        };

        if (belongsToGroup) {
          // so_thang is null for current position — calculate from start date
          totalMonths += history.so_thang || monthDiff(history.ngay_bat_dau, new Date());
        }
      });

      return totalMonths;
    };

    const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
        include: {
          LichSuChucVu: {
            include: {
              ChucVu: true,
            },
            orderBy: {
              ngay_bat_dau: 'asc',
            },
          },
        },
      });

      if (!personnel) {
        throw new NotFoundError('Quân nhân');
      }

      const existingProfile = await prisma.hoSoCongHien.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      const personnelHCBVTQ = await prisma.khenThuongHCBVTQ.findMany({
        where: { quan_nhan_id: personnelId },
      });

      // Award hierarchy: lower rank must be received (DA_NHAN) before higher rank can be proposed
      const hcbvtqBa = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_BA)
        ? {
            status: ELIGIBILITY_STATUS.DA_NHAN,
          }
        : (await checkEligibleForRank(personnel, 'HANG_BA'))
          ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
          : { status: ELIGIBILITY_STATUS.CHUA_DU };

      const hcbvtqNhi = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHI)
        ? {
            status: ELIGIBILITY_STATUS.DA_NHAN,
          }
        : (await checkEligibleForRank(personnel, 'HANG_NHI'))
          ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
          : { status: ELIGIBILITY_STATUS.CHUA_DU };

      const hcbvtqNhat = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHAT)
        ? {
            status: ELIGIBILITY_STATUS.DA_NHAN,
          }
        : (await checkEligibleForRank(personnel, 'HANG_NHAT'))
          ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
          : { status: ELIGIBILITY_STATUS.CHUA_DU };

      const months0_7 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.7');
      const months0_8 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.8');
      const months0_9_1_0 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.9-1.0');

      const contributionData = {
        hcbvtq_total_months: months0_7 + months0_8 + months0_9_1_0,
        months_07: months0_7,
        months_08: months0_8,
        months_0910: months0_9_1_0,
        hcbvtq_hang_ba_status: hcbvtqBa.status,
        hcbvtq_hang_ba_ngay: null as Date | null,
        hcbvtq_hang_nhi_status: hcbvtqNhi.status,
        hcbvtq_hang_nhi_ngay: null as Date | null,
        hcbvtq_hang_nhat_status: hcbvtqNhat.status,
        hcbvtq_hang_nhat_ngay: null as Date | null,
        goi_y: null as string | null,
      };

      await prisma.hoSoCongHien.upsert({
        where: { quan_nhan_id: personnelId },
        update: contributionData,
        create: { quan_nhan_id: personnelId, ...contributionData },
      });

      // Legacy table: refresh coefficient-group month mirrors when a contribution award row exists.
      const existingCongHien = await prisma.khenThuongHCBVTQ.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      if (existingCongHien) {
        let updatedStatus = existingCongHien.danh_hieu;

        await prisma.khenThuongHCBVTQ.update({
          where: { id: existingCongHien.id },
          data: {
            thoi_gian_nhom_0_7: existingCongHien.thoi_gian_nhom_0_7,
            thoi_gian_nhom_0_8: existingCongHien.thoi_gian_nhom_0_8,
            thoi_gian_nhom_0_9_1_0: existingCongHien.thoi_gian_nhom_0_9_1_0,
          },
        });
      }

    return { message: 'Tính toán lại hồ sơ Huân chương Bảo vệ Tổ quốc thành công' };
  }

  /**
   * HCBVTQ tier helper: compares total months served against the coefficient-specific threshold.
   * @param totalMonths - Cumulative qualifying months
   * @param requiredMonths - Threshold from position group rules
   * @param currentStatus - Existing `ELIGIBILITY_STATUS` (preserves `DA_NHAN`)
   * @param rank - Medal tier label used in `goiY` text
   * @returns Status, optional milestone date, and Vietnamese guidance string
   */
  calculateHCBVTQ(totalMonths, requiredMonths, currentStatus, rank) {
    // Already received — preserve status
    if (currentStatus === ELIGIBILITY_STATUS.DA_NHAN) {
      return {
        status: ELIGIBILITY_STATUS.DA_NHAN,
        ngay: null,
        goiY: '',
      };
    }

    if (totalMonths >= requiredMonths) {
      const years = Math.floor(totalMonths / 12);
      return {
        status: ELIGIBILITY_STATUS.DU_DIEU_KIEN,
        ngay: new Date(),
        goiY: `Đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank} (đã công tác ${years} năm).`,
      };
    }

    // Not yet eligible
    const remainingMonths = requiredMonths - totalMonths;
    const remainingYears = Math.floor(remainingMonths / 12);
    const remainingMonthsOnly = remainingMonths % 12;

    return {
      status: ELIGIBILITY_STATUS.CHUA_DU,
      ngay: null,
      goiY:
        remainingYears > 0
          ? `Còn ${remainingYears} năm ${remainingMonthsOnly} tháng nữa mới đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank}.`
          : `Còn ${remainingMonthsOnly} tháng nữa mới đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank}.`,
    };
  }

  /**
   * Batch job: `recalculateAnnualProfile` for every personnel (best-effort per row).
   * @returns Aggregate counts and per-personnel error list
   */
  async recalculateAll() {
    const allPersonnel = await prisma.quanNhan.findMany({
      select: { id: true, ho_ten: true },
    });

    writeSystemLog({
      action: 'RECALCULATE',
      resource: 'profiles',
      description: `[Recalculate] Bắt đầu tính toán cho ${allPersonnel.length} quân nhân`,
    });

    let successCount = 0;
    const errors = [];

    for (const personnel of allPersonnel) {
      try {
        await this.recalculateAnnualProfile(personnel.id);
        successCount++;
      } catch (error) {
        errors.push({
          personnelId: personnel.id,
          hoTen: personnel.ho_ten,
          error: error.message,
        });
        writeSystemLog({
          action: 'ERROR',
          resource: 'profiles',
          resourceId: personnel.id,
          description: `[Recalculate] Lỗi: ${personnel.ho_ten} (${personnel.id}) — ${error.message}`,
        });
      }
    }

    writeSystemLog({
      action: 'RECALCULATE',
      resource: 'profiles',
      description: `[Recalculate] Hoàn tất: ${successCount} thành công, ${errors.length} lỗi`,
      payload: errors.length > 0 ? { errors } : null,
    });

    return {
      message: `Tính toán hoàn tất. Thành công: ${successCount}, Lỗi: ${errors.length}`,
      success: successCount,
      errors,
    };
  }

  /**
   * Admin listing of tenure profiles with nested unit + position context.
   * @returns All `ho_so_nien_han` rows with relations
   */
  async getAllTenureProfiles() {
    const profiles = await prisma.hoSoNienHan.findMany({
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
            ChucVu: true,
          },
        },
      },
      orderBy: {
        quan_nhan_id: 'asc',
      },
    });

    return profiles;
  }

  /**
   * Partially updates tenure medal statuses after admin verification.
   * @param personnelId - Personnel ID
   * @param updates - Subset of HCCSVV / HCBVTQ status fields
   * @returns Updated `ho_so_nien_han` row (status columns only; no relation includes)
   */
  async updateTenureProfile(personnelId, updates) {
    const profile = await prisma.hoSoNienHan.findUnique({
      where: { quan_nhan_id: personnelId },
    });

    if (!profile) {
      throw new NotFoundError('Hồ sơ Huy chương Chiến sĩ vẻ vang');
    }

    const validStatuses = [
      ELIGIBILITY_STATUS.CHUA_DU,
      ELIGIBILITY_STATUS.DU_DIEU_KIEN,
      ELIGIBILITY_STATUS.DA_NHAN,
    ];
    const updateData: Record<string, any> = {};

    if (updates.hccsvv_hang_ba_status && validStatuses.includes(updates.hccsvv_hang_ba_status)) {
      updateData.hccsvv_hang_ba_status = updates.hccsvv_hang_ba_status;
    }
    if (updates.hccsvv_hang_nhi_status && validStatuses.includes(updates.hccsvv_hang_nhi_status)) {
      updateData.hccsvv_hang_nhi_status = updates.hccsvv_hang_nhi_status;
    }
    if (
      updates.hccsvv_hang_nhat_status &&
      validStatuses.includes(updates.hccsvv_hang_nhat_status)
    ) {
      updateData.hccsvv_hang_nhat_status = updates.hccsvv_hang_nhat_status;
    }

    if (updates.hcbvtq_hang_ba_status && validStatuses.includes(updates.hcbvtq_hang_ba_status)) {
      updateData.hcbvtq_hang_ba_status = updates.hcbvtq_hang_ba_status;
    }
    if (updates.hcbvtq_hang_nhi_status && validStatuses.includes(updates.hcbvtq_hang_nhi_status)) {
      updateData.hcbvtq_hang_nhi_status = updates.hcbvtq_hang_nhi_status;
    }
    if (
      updates.hcbvtq_hang_nhat_status &&
      validStatuses.includes(updates.hcbvtq_hang_nhat_status)
    ) {
      updateData.hcbvtq_hang_nhat_status = updates.hcbvtq_hang_nhat_status;
    }

    const updatedProfile = await prisma.hoSoNienHan.update({
      where: { quan_nhan_id: personnelId },
      data: updateData,
    });

    return updatedProfile;
  }
}

export default new ProfileService();
