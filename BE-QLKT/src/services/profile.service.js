const { prisma } = require('../models');
const positionHistoryService = require('../services/positionHistory.service');

class ProfileService {
  /**
   * Lấy hồ sơ gợi ý hằng năm
   */
  async getAnnualProfile(personnelId) {
    try {
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
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

      // Nếu chưa có hồ sơ, tạo mới với giá trị mặc định
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy hồ sơ gợi ý niên hạn (HCCSVV - Huy chương Chiến sĩ Vẻ vang)
   */
  async getTenureProfile(personnelId) {
    try {
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      let profile = await prisma.hoSoNienHan.findUnique({
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

      // Nếu chưa có hồ sơ, tạo mới với giá trị mặc định
      if (!profile) {
        profile = await prisma.hoSoNienHan.create({
          data: {
            quan_nhan_id: personnelId,
            hccsvv_hang_ba_status: 'CHUA_DU',
            hccsvv_hang_nhi_status: 'CHUA_DU',
            hccsvv_hang_nhat_status: 'CHUA_DU',
            hcbvtq_total_months: 0,
            hcbvtq_hang_ba_status: 'CHUA_DU',
            hcbvtq_hang_nhi_status: 'CHUA_DU',
            hcbvtq_hang_nhat_status: 'CHUA_DU',
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy hồ sơ gợi ý cống hiến (HCBVTQ - Huân chương Bảo vệ Tổ quốc)
   */
  async getContributionProfile(personnelId) {
    try {
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
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

      // Nếu chưa có hồ sơ, tạo mới với giá trị mặc định
      if (!profile) {
        profile = await prisma.hoSoCongHien.create({
          data: {
            quan_nhan_id: personnelId,
            hcbvtq_total_months: 0,
            hcbvtq_hang_ba_status: 'CHUA_DU',
            hcbvtq_hang_nhi_status: 'CHUA_DU',
            hcbvtq_hang_nhat_status: 'CHUA_DU',
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * ==============================================
   * HELPER FUNCTIONS - KHEN THƯỞNG HẰNG NĂM
   * ==============================================
   */

  /**
   * Tính số năm CSTDCS liên tục từ năm gần nhất
   * @param {Array} danhHieuList - Danh sách danh hiệu đã sắp xếp theo năm giảm dần
   * @returns {number} Số năm liên tục
   */
  calculateContinuousCSTDCS(danhHieuList, year) {
    let count = 0;
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const filteredRewards = sortedRewards.filter(r => r.nam <= year - 1);
    let currentYear = year - 1;
    for (const reward of filteredRewards) {
      if (reward.nam !== currentYear) break;
      if (reward.danh_hieu === 'CSTDCS') {
        count++;
        currentYear--;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Tính số năm NCKH liên tục từ năm gần nhất
   * @param {Array} thanhTichList - Danh sách danh hiệu đã sắp xếp theo năm giảm dần
   * @returns {number} Số năm liên tục
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
      if (reward.status === 'APPROVED') {
        count++;
        currentYear--;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Tính số năm liên tục nhận BKBQP (mỗi 2 năm)
   * @param {Array} danhHieuList - Danh sách danh hiệu đã sắp xếp theo năm giảm dần
   * @returns {number} Số năm liên tục
   */
  calculateContinuousBKBQP(danhHieuList, year) {
    let count = 0;
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const filteredRewards = sortedRewards.filter(r => r.nhan_bkbqp === true && r.nam <= year - 1);
    console.log('Filtered BKBQP Rewards:', filteredRewards);
    let currentYear = year - 1;

    for (const reward of filteredRewards) {
      if (reward.nam !== currentYear) break;
      count++;
      currentYear -= 2;
    }
    console.log('Continuous BKBQP count:', count);
    return count;
  }

  /**
   * Tính số năm liên tục nhận CSTDTQ (mỗi 3 năm)
   * @param {Array} danhHieuList - Danh sách danh hiệu đã sắp xếp theo năm giảm dần
   * @param {number} year - Năm hiện tại để tính toán
   * @returns {number} Số năm liên tục nhận CSTDTQ
   */
  calculateContinuousCSTDTQ(danhHieuList, year) {
    let count = 0;
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const filteredRewards = sortedRewards.filter(r => r.nhan_cstdtq === true && r.nam <= year - 1);
    console.log('Filtered CSTDTQ Rewards:', filteredRewards);
    let currentYear = year - 1;

    for (const reward of filteredRewards) {
      if (reward.nam !== currentYear) break;
      count++;
      currentYear -= 3;
    }
    console.log('Continuous CSTDTQ count:', count);
    return count;
  }

  /**
   * Kiểm tra NCKH trong khoảng năm
   * @param {Array} nckhList - Danh sách NCKH đã approved
   * @param {Array} years - Mảng các năm cần kiểm tra [2023, 2024, 2025]
   * @returns {Object} { hasNCKH: boolean, years: [2023, 2025] }
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
   * Tính toán gợi ý BKBQP (5 năm CSTDCS liên tục)
   * @param {number} CSTDCSLienTuc - Số năm CSTDCS liên tục
   * @param {Array} danhHieuList - Danh sách danh hiệu
   * @param {Array} nckhList - Danh sách NCKH đã approved
   * @returns {Object} { duDieuKien: boolean, goiY: string }
   */
  calculateBKBQP(CSTDCSLienTuc, danhHieuList, nckhList) {
    // Chưa đủ 5 năm CSTDCS liên tục
    if (CSTDCSLienTuc < 5) {
      return {
        duDieuKien: false,
        goiY: `Hiện có ${CSTDCSLienTuc} năm CSTDCS liên tục. Cần ${
          5 - CSTDCSLienTuc
        } năm CSTDCS nữa để xét BKBQP.`,
      };
    }

    // Đã có đủ 5 năm CSTDCS liên tục
    if (CSTDCSLienTuc >= 5) {
      return {
        duDieuKien: true,
        goiY: 'Đã đủ điều kiện đề nghị xét Bằng khen Bộ Quốc phòng.',
      };
    }

    // Trường hợp mặc định: chưa đủ
    return {
      duDieuKien: false,
      goiY: `Hiện có ${CSTDCSLienTuc} năm CSTDCS liên tục. Cần ${
        5 - CSTDCSLienTuc
      } năm CSTDCS nữa để xét BKBQP.`,
    };
  }

  /**
   * Tính toán gợi ý CSTDTQ (10 năm CSTDCS liên tục + 1 ĐTKH/SKKH)
   * @param {number} CSTDCSLienTuc - Số năm CSTDCS liên tục
   * @param {Object} bkbqpResult - Kết quả tính toán BKBQP
   * @param {Array} danhHieuList - Danh sách danh hiệu
   * @param {Array} nckhList - Danh sách NCKH đã approved
   * @returns {Object} { duDieuKien: boolean, goiY: string }
   */
  calculateCSTDTQ(CSTDCSLienTuc, bkbqpResult, danhHieuList, nckhList) {
    // CSTDTQ chỉ xét nếu đã đủ điều kiện BKBQP (5 năm)
    if (!bkbqpResult.duDieuKien) {
      return {
        duDieuKien: false,
        goiY: '',
      };
    }

    // Chưa đủ 10 năm CSTDCS liên tục
    if (CSTDCSLienTuc < 10) {
      return {
        duDieuKien: false,
        goiY: `Đã đủ điều kiện BKBQP. Hiện có ${CSTDCSLienTuc} năm CSTDCS liên tục. Cần ${
          10 - CSTDCSLienTuc
        } năm CSTDCS nữa để xét CSTDTQ.`,
      };
    }

    // Đã có đủ 10 năm CSTDCS liên tục
    if (CSTDCSLienTuc >= 10) {
      // Kiểm tra có ít nhất 1 ĐTKH/SKKH
      if (nckhList.length > 0) {
        return {
          duDieuKien: true,
          goiY: 'Đã đủ điều kiện đề nghị xét Chiến sĩ thi đua Toàn quân.',
        };
      } else {
        return {
          duDieuKien: false,
          goiY: `Đã có ${CSTDCSLienTuc} năm CSTDCS liên tục. Cần thêm ít nhất 1 ĐTKH/SKKH để đủ điều kiện xét CSTDTQ.`,
        };
      }
    }

    // Trường hợp mặc định
    return {
      duDieuKien: false,
      goiY: '',
    };
  }

  /**
   * Xử lý trường hợp đặc biệt (Reset, đã nhận)
   * @param {Array} danhHieuList - Danh sách danh hiệu
   * @returns {Object} { isSpecialCase: boolean, goiY: string, resetChain: boolean }
   */
  handleSpecialCases(danhHieuList) {
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
    const latestReward = sortedRewards[0];

    if (!latestReward) {
      return { isSpecialCase: false, goiY: '', resetChain: false };
    }

    // Trường hợp 1: Admin đã cập nhật nhận BKTTCP (cao nhất)
    if (latestReward.nhan_bkttcp === true) {
      return {
        isSpecialCase: true,
        goiY: `Đã nhận Bằng khen thi đua cấp phòng (Năm ${latestReward.nam}). Bắt đầu chuỗi thành tích mới.`,
        resetChain: true,
      };
    }

    // Trường hợp 2: Admin đã cập nhật nhận CSTDTQ
    if (latestReward.nhan_cstdtq === true) {
      return {
        isSpecialCase: true,
        goiY: `Đã nhận Chiến sĩ thi đua Toàn quân (Năm ${latestReward.nam}). Bắt đầu chuỗi thành tích mới.`,
        resetChain: true,
      };
    }

    // Trường hợp 3: Admin đã cập nhật nhận BKBQP (nhưng chưa đủ CSTDTQ)
    if (latestReward.nhan_bkbqp === true && !latestReward.nhan_cstdtq) {
      return {
        isSpecialCase: true,
        goiY: `Đã nhận Bằng khen Bộ Quốc phòng (Năm ${latestReward.nam}).`,
        resetChain: false,
      };
    }

    // Trường hợp 4: Năm nay không đạt CSTDCS
    if (latestReward.danh_hieu !== 'CSTDCS' && latestReward.danh_hieu !== null) {
      return {
        isSpecialCase: true,
        goiY: 'Chưa có CSTDCS liên tục. Cần đạt CSTDCS để bắt đầu tính điều kiện khen thưởng.',
        resetChain: true,
      };
    }

    return { isSpecialCase: false, goiY: '', resetChain: false };
  }

  /**
   * ==============================================
   * HELPER FUNCTIONS - KHEN THƯỞNG NIÊN HẠN
   * ==============================================
   */

  /**
   * Tính ngày đủ điều kiện xét HCCSVV
   * @param {Date} ngayNhapNgu - Ngày nhập ngũ
   * @param {number} soNam - Số năm yêu cầu (10, 15, 20)
   * @returns {Date} Ngày đủ điều kiện
   */
  calculateEligibilityDate(ngayNhapNgu, soNam) {
    if (!ngayNhapNgu) return null;
    const eligibilityDate = new Date(ngayNhapNgu);
    eligibilityDate.setFullYear(eligibilityDate.getFullYear() + soNam);
    return eligibilityDate;
  }

  /**
   * Tính toán gợi ý HCCSVV cho một hạng
   * @param {Date} ngayNhapNgu - Ngày nhập ngũ
   * @param {number} soNam - Số năm yêu cầu (10, 15, 20)
   * @param {string} currentStatus - Trạng thái hiện tại
   * @param {string} hangName - Tên hạng (Ba, Nhì, Nhất)
   * @returns {Object} { status: string, ngay: Date, goiY: string }
   */
  calculateHCCSVV(ngayNhapNgu, soNam, currentStatus, hangName) {
    if (!ngayNhapNgu) {
      return {
        status: 'CHUA_DU',
        ngay: null,
        goiY: `Chưa có ngày nhập ngũ. Không thể tính toán HCCSVV Hạng ${hangName}.`,
      };
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const eligibilityDate = this.calculateEligibilityDate(ngayNhapNgu, soNam);
    const eligibilityYear = eligibilityDate.getFullYear();

    // Trường hợp 13: Admin đã cập nhật DA_NHAN
    if (currentStatus === 'DA_NHAN') {
      return {
        status: 'DA_NHAN',
        ngay: eligibilityDate,
        goiY: `Đã nhận HCCSVV Hạng ${hangName}.`,
      };
    }

    // Trường hợp 11: Năm hiện tại BẰNG năm đủ điều kiện
    if (currentYear === eligibilityYear) {
      return {
        status: 'DU_DIEU_KIEN',
        ngay: eligibilityDate,
        goiY: `Đủ điều kiện (${soNam} năm) xét HCCSVV Hạng ${hangName} trong năm nay. Ngày xét duyệt dự kiến: ${eligibilityDate.toLocaleDateString(
          'vi-VN'
        )}.`,
      };
    }

    // Trường hợp 12: Năm hiện tại LỚN HƠN năm đủ điều kiện (đã quá hạn)
    if (currentYear > eligibilityYear) {
      return {
        status: 'DU_DIEU_KIEN',
        ngay: eligibilityDate,
        goiY: `Đã quá hạn xét HCCSVV Hạng ${hangName}. Ngày đủ điều kiện: ${eligibilityDate.toLocaleDateString(
          'vi-VN'
        )}. Chờ Quản trị viên cập nhật.`,
      };
    }

    // Trường hợp 14: Năm hiện tại NHỎ HƠN năm đủ điều kiện (chưa đến hạn)
    if (currentYear < eligibilityYear) {
      const yearsLeft = eligibilityYear - currentYear;
      return {
        status: 'CHUA_DU',
        ngay: null,
        goiY: `Chưa đủ điều kiện (${soNam} năm) xét HCCSVV Hạng ${hangName}. Dự kiến: ${eligibilityDate.toLocaleDateString(
          'vi-VN'
        )} (còn ${yearsLeft} năm).`,
      };
    }

    // Fallback
    return {
      status: 'CHUA_DU',
      ngay: null,
      goiY: `Đang tính toán HCCSVV Hạng ${hangName}...`,
    };
  }

  /**
   * ==============================================
   * HELPER FUNCTIONS - KHEN THƯỞNG CỐNG HIẾN
   * ==============================================
   */

  /**
   * Tính tổng tháng cống hiến từ lịch sử chức vụ
   * @param {Array} lichSuChucVu - Danh sách lịch sử chức vụ
   * @returns {number} Tổng tháng cống hiến (đã nhân hệ số)
   */
  calculateContributionMonths(lichSuChucVu) {
    let totalMonths = 0;
    const today = new Date();

    // Mapping nhóm cống hiến sang hệ số
    const hesoMap = {
      'Nhóm 5': 1.0,
      'Nhóm 6': 1.2,
      'Nhóm 7': 1.5,
      // Thêm các nhóm khác nếu có
    };

    for (const ls of lichSuChucVu) {
      if (ls.ChucVu?.NhomCongHien) {
        const ngayBatDau = new Date(ls.ngay_bat_dau);
        const ngayKetThuc = ls.ngay_ket_thuc ? new Date(ls.ngay_ket_thuc) : today;

        // Tính số tháng thực tế theo lịch (chính xác)
        let months = (ngayKetThuc.getFullYear() - ngayBatDau.getFullYear()) * 12;
        months += ngayKetThuc.getMonth() - ngayBatDau.getMonth();

        // Nếu ngày kết thúc < ngày bắt đầu trong tháng thì trừ 1 tháng
        if (ngayKetThuc.getDate() < ngayBatDau.getDate()) {
          months--;
        }

        const monthsWorked = Math.max(0, months); // Đảm bảo không âm

        // Lấy hệ số từ tên nhóm cống hiến
        const tenNhom = ls.ChucVu.NhomCongHien.ten_nhom;
        const heso = hesoMap[tenNhom] || 1.0;

        // Tính tháng cống hiến = tháng làm việc * hệ số
        totalMonths += Math.floor(monthsWorked * heso);
      }
    }

    return totalMonths;
  }

  /**
   * Tính toán gợi ý HCBVTQ cho một hạng
   * @param {number} totalMonths - Tổng tháng cống hiến
   * @param {number} requiredMonths - Số tháng yêu cầu (180, 240, 300)
   * @param {string} currentStatus - Trạng thái hiện tại
   * @param {string} hangName - Tên hạng (Ba, Nhì, Nhất)
   * @returns {Object} { status: string, goiY: string }
   */
  calculateHCBVTQ(isLegal, currentStatus, hangName) {
    // Trường hợp 17: Admin đã cập nhật DA_NHAN
    if (currentStatus === 'DA_NHAN') {
      return {
        status: 'DA_NHAN',
        goiY: '', // Không tạo gợi ý cho HCBVTQ
      };
    }

    // Trường hợp 16: Đã đủ điều kiện
    if (isLegal) {
      return {
        status: 'DU_DIEU_KIEN',
        goiY: '', // Không tạo gợi ý cho HCBVTQ
      };
    }

    // Trường hợp 15: Chưa đủ điều kiện
    return {
      status: 'CHUA_DU',
      goiY: '', // Không tạo gợi ý cho HCBVTQ
    };
  }

  /**
   * ==============================================
   * HÀM TÍNH TOÁN CHÍNH
   * ==============================================
   */

  /**
   * ==============================================
   * TÍNH TOÁN HỒ SƠ HẰNG NĂM - LOGIC MỚI
   * ==============================================
   */

  /**
   * Tính toán lại hồ sơ hằng năm cho 1 quân nhân
   * Logic: BKBQP (2 năm) và CSTDTQ (3 năm)
   * @param {number} personnelId - ID quân nhân
   * @param {number} [year] - Năm để tính toán gợi ý (mặc định là năm hiện tại)
   * @returns {Promise<Object>} Kết quả tính toán
   */
  async recalculateAnnualProfile(personnelId, year = new Date().getFullYear()) {
    console.log(
      `[recalculateAnnualProfile] Bắt đầu tính toán cho quân nhân ID: ${personnelId}, năm: ${
        year || 'all'
      }`
    );
    try {
      // ==============================================
      // BƯỚC 1: Thu thập Toàn bộ Dữ liệu Lịch sử (Input)
      // ==============================================
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
        include: {
          DanhHieuHangNam: {
            where: {
              nam: { lte: year },
            },
            orderBy: { nam: 'asc' },
          },
          ThanhTichKhoaHoc: {
            where: { status: 'APPROVED', nam: { lte: year } },
            orderBy: { nam: 'asc' },
          },
        },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      const danhHieuList = personnel.DanhHieuHangNam || [];
      const thanhTichList = personnel.ThanhTichKhoaHoc || [];

      console.log(
        `📋 [recalculateAnnualProfile] Quân nhân ID: ${personnelId}, Số danh hiệu: ${danhHieuList.length}, Số thành tích: ${thanhTichList.length}`
      );
      console.log(
        `📋 [recalculateAnnualProfile] Danh sách danh hiệu:`,
        danhHieuList.map(dh => `${dh.nam}: ${dh.danh_hieu}`).join(', ')
      );

      // ==============================================
      // BƯỚC 2: Định nghĩa Biến Tính toán
      // ==============================================
      let du_dieu_kien_bkbqp = false;
      let du_dieu_kien_cstdtq = false;
      let du_dieu_kien_bkttcp = false;
      // Lưu danh hiệu vào JSON - bao gồm CSTDCS và các năm có BKBQP/CSTDTQ/BKTTCP
      // Điều này đảm bảo hiển thị được các năm có CSTDTQ mà không có CSTDCS
      const tong_cstdcs_json = danhHieuList
        .filter(dh => dh.danh_hieu === 'CSTDCS' || dh.nhan_bkbqp || dh.nhan_cstdtq || dh.nhan_bkttcp)
        .map(dh => ({
          nam: dh.nam,
          danh_hieu: dh.danh_hieu,
          so_quyet_dinh: dh.so_quyet_dinh || null,
          // file_quyet_dinh: dh.file_quyet_dinh || null,
          nhan_bkbqp: dh.nhan_bkbqp || false,
          nhan_cstdtq: dh.nhan_cstdtq || false,
          nhan_bkttcp: dh.nhan_bkttcp || false,
          so_quyet_dinh_bkbqp: dh.so_quyet_dinh_bkbqp || null,
          // file_quyet_dinh_bkbqp: dh.file_quyet_dinh_bkbqp || null,
          so_quyet_dinh_cstdtq: dh.so_quyet_dinh_cstdtq || null,
          // file_quyet_dinh_cstdtq: dh.file_quyet_dinh_cstdtq || null,
          so_quyet_dinh_bkttcp: dh.so_quyet_dinh_bkttcp || null,
          // file_quyet_dinh_bkttcp: dh.file_quyet_dinh_bkttcp || null,
        }))
        .sort((a, b) => a.nam - b.nam); // Sắp xếp theo năm tăng dần
      const tong_cstdcs = tong_cstdcs_json.length;
      // Lưu danh sách NCKH dạng JSON
      const tong_nckh_json = thanhTichList
        .map(tt => ({
          nam: tt.nam,
          loai: tt.loai,
          mo_ta: tt.mo_ta,
          status: tt.status,
          so_quyet_dinh: tt.so_quyet_dinh || null,
          // file_quyet_dinh: tt.file_quyet_dinh || null,
        }))
        .sort((a, b) => a.nam - b.nam); // Sắp xếp theo năm tăng dần
      const tong_nckh = tong_nckh_json.length;
      console.log(
        `📋 [recalculateAnnualProfile] Số NCKH: ${tong_nckh}, JSON:`,
        JSON.stringify(tong_nckh_json, null, 2)
      );

      // ==============================================
      // BƯỚC 3: Logic "Bộ não" (Lặp và Kiểm tra)
      // ==============================================

      const cstdcs_lien_tuc = this.calculateContinuousCSTDCS(
        danhHieuList.filter(dh => dh.danh_hieu === 'CSTDCS'),
        year
      );

      const nckh_lien_tuc = this.calculateContinuousNCKH(thanhTichList, year);

      const bkbqp_lien_tuc = this.calculateContinuousBKBQP(danhHieuList, year);

      const cstdtq_lien_tuc = this.calculateContinuousCSTDTQ(danhHieuList, year);

      du_dieu_kien_bkbqp =
        cstdcs_lien_tuc % 2 === 0 && cstdcs_lien_tuc >= 1 && nckh_lien_tuc >= cstdcs_lien_tuc;
      du_dieu_kien_cstdtq =
        cstdcs_lien_tuc % 3 === 0 &&
        bkbqp_lien_tuc >= 1 &&
        cstdcs_lien_tuc >= 3 &&
        nckh_lien_tuc >= cstdcs_lien_tuc;
      if (cstdcs_lien_tuc % 6 === 0) {
        const bkbqp_lt = this.calculateContinuousBKBQP(danhHieuList, year - 1);
        du_dieu_kien_cstdtq =
          cstdcs_lien_tuc % 3 === 0 &&
          bkbqp_lt >= 1 &&
          cstdcs_lien_tuc >= 3 &&
          nckh_lien_tuc >= cstdcs_lien_tuc;
      }

      // BKTTCP: 7 CSTDCS liên tục + 3 BKBQP liên tục + 2 CSTDTQ liên tục
      du_dieu_kien_bkttcp =
        cstdcs_lien_tuc % 7 === 0 &&
        bkbqp_lien_tuc % 3 === 0 &&
        cstdtq_lien_tuc % 2 === 0 &&
        nckh_lien_tuc >= cstdcs_lien_tuc &&
        cstdcs_lien_tuc >= 7 &&
        bkbqp_lien_tuc >= 3 &&
        cstdtq_lien_tuc >= 2;

      // ==============================================
      // BƯỚC 4: Logic Tạo Gợi ý (Suggestion) - CHỈ GỢI Ý BKBQP, CSTDTQ VÀ BKTTCP
      // ==============================================
      let goi_y = '';

      if (du_dieu_kien_bkttcp === true) {
        // Đã đủ điều kiện BKTTCP
        goi_y = 'Đã đủ điều kiện đề nghị xét Bằng khen thi đua cấp phòng (BKTTCP).';
      } else if (du_dieu_kien_cstdtq === true) {
        // Đã đủ điều kiện CSTDTQ nhưng chưa đủ BKTTCP
        goi_y = 'Đã đủ điều kiện đề nghị xét Chiến sĩ thi đua Toàn quân.';
      } else if (du_dieu_kien_bkbqp === true) {
        // Đã đủ điều kiện BKBQP nhưng chưa đủ CSTDTQ
        goi_y = 'Đã đủ điều kiện đề nghị xét Bằng khen Bộ Quốc phòng.';
      } else {
        // Chưa đủ điều kiện
        goi_y =
          'Chưa đủ điều kiện đề nghị xét Bằng khen Bộ Quốc phòng hoặc Chiến sĩ thi đua Toàn quân.';
      }

      // ==============================================
      // BƯỚC 5: Cập nhật Kết quả (Output)
      // ==============================================
      console.log(
        `💾 [recalculateAnnualProfile] Chuẩn bị lưu vào hoSoHangNam:`,
        JSON.stringify(
          {
            tong_cstdcs: tong_cstdcs_json,
            tong_nckh: tong_nckh_json,
            cstdcs_lien_tuc: cstdcs_lien_tuc % 7,
            bkbqp_lien_tuc: bkbqp_lien_tuc % 3,
            cstdtq_lien_tuc: cstdtq_lien_tuc % 2,
            du_dieu_kien_bkbqp: du_dieu_kien_bkbqp,
            du_dieu_kien_cstdtq: du_dieu_kien_cstdtq,
            du_dieu_kien_bkttcp: du_dieu_kien_bkttcp,
            goi_y: goi_y,
          },
          null,
          2
        )
      );

      const hoSoHangNam = await prisma.hoSoHangNam.upsert({
        where: { quan_nhan_id: personnelId },
        update: {
          tong_cstdcs: tong_cstdcs, // Số lượng (Int)
          tong_nckh: tong_nckh, // Số lượng (Int)
          tong_cstdcs_json: tong_cstdcs_json, // Chi tiết dạng JSON
          tong_nckh_json: tong_nckh_json, // Chi tiết dạng JSON
          cstdcs_lien_tuc: cstdcs_lien_tuc,
          nckh_lien_tuc: nckh_lien_tuc,
          bkbqp_lien_tuc: bkbqp_lien_tuc,
          cstdtq_lien_tuc: cstdtq_lien_tuc,
          du_dieu_kien_bkbqp: du_dieu_kien_bkbqp,
          du_dieu_kien_cstdtq: du_dieu_kien_cstdtq,
          du_dieu_kien_bkttcp: du_dieu_kien_bkttcp,
          goi_y: goi_y,
        },
        create: {
          quan_nhan_id: personnelId,
          tong_cstdcs: tong_cstdcs, // Số lượng (Int)
          tong_nckh: tong_nckh, // Số lượng (Int)
          tong_cstdcs_json: tong_cstdcs_json, // Chi tiết dạng JSON
          tong_nckh_json: tong_nckh_json, // Chi tiết dạng JSON
          cstdcs_lien_tuc: cstdcs_lien_tuc,
          nckh_lien_tuc: nckh_lien_tuc,
          bkbqp_lien_tuc: bkbqp_lien_tuc,
          cstdtq_lien_tuc: cstdtq_lien_tuc,
          du_dieu_kien_bkbqp: du_dieu_kien_bkbqp,
          du_dieu_kien_cstdtq: du_dieu_kien_cstdtq,
          du_dieu_kien_bkttcp: du_dieu_kien_bkttcp,
          goi_y: goi_y,
        },
      });

      console.log(
        `✅ [recalculateAnnualProfile] Đã lưu hoSoHangNam thành công. ID: ${hoSoHangNam.id}`
      );
      console.log(
        `✅ [recalculateAnnualProfile] Dữ liệu đã lưu:`,
        JSON.stringify(
          {
            tong_cstdcs: hoSoHangNam.tong_cstdcs,
            tong_nckh: hoSoHangNam.tong_nckh,
            cstdcs_lien_tuc: hoSoHangNam.cstdcs_lien_tuc,
            nckh_lien_tuc: hoSoHangNam.nckh_lien_tuc,
            bkbqp_lien_tuc: hoSoHangNam.bkbqp_lien_tuc,
            cstdtq_lien_tuc: hoSoHangNam.cstdtq_lien_tuc,
          },
          null,
          2
        )
      );

      return {
        success: true,
        message: 'Tính toán hồ sơ hằng năm thành công',
        data: hoSoHangNam,
      };
    } catch (error) {
      console.error('Lỗi khi tính toán hồ sơ hằng năm:', error);
      throw error;
    }
  }

  /**
   * Tính toán lại hồ sơ niên hạn cho 1 quân nhân (chỉ HCCSVV - Huy chương Chiến sĩ Vẻ vang)
   * @param {string} personnelId - ID quân nhân
   */
  async recalculateTenureProfile(personnelId) {
    console.log(
      `[recalculateTenureProfile] Bắt đầu tính toán hồ sơ niên hạn cho quân nhân ID: ${personnelId}`
    );
    try {
      // Load thông tin quân nhân
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      console.log(
        `[recalculateTenureProfile] Quân nhân: ${personnel.ho_ten}, Ngày nhập ngũ: ${personnel.ngay_nhap_ngu}`
      );

      // Lấy hồ sơ niên hạn hiện tại
      const existingProfile = await prisma.hoSoNienHan.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      const khenthuonghccsvv = await prisma.khenThuongHCCSVV.findMany({
        where: { quan_nhan_id: personnelId },
      });

      //reset status huân chương nếu chưa có khen thưởng hccsvv
      let newProfile = existingProfile ?? {};
      newProfile.hccsvv_hang_ba_status = 'CHUA_DU';
      newProfile.hccsvv_hang_nhi_status = 'CHUA_DU';
      newProfile.hccsvv_hang_nhat_status = 'CHUA_DU';

      // update status huân chương từ khen thưởng hccsvv
      for (const kt of khenthuonghccsvv) {
        if (kt.danh_hieu === 'HCCSVV_HANG_BA') {
          newProfile.hccsvv_hang_ba_status = 'DA_NHAN';
        }
        if (kt.danh_hieu === 'HCCSVV_HANG_NHI') {
          newProfile.hccsvv_hang_nhi_status = 'DA_NHAN';
        }
        if (kt.danh_hieu === 'HCCSVV_HANG_NHAT') {
          newProfile.hccsvv_hang_nhat_status = 'DA_NHAN';
        }
      }

      // Tính HCCSVV (Huy chương Chiến sĩ Vẻ vang)
      // Logic thứ bậc: Phải NHẬN hạng thấp trước mới được đề xuất hạng cao
      const hccsvvBa = this.calculateHCCSVV(
        personnel.ngay_nhap_ngu,
        10,
        newProfile.hccsvv_hang_ba_status || 'CHUA_DU',
        'Ba'
      );

      // Chỉ xét Hạng Nhì nếu ĐÃ NHẬN Hạng Ba (DA_NHAN)
      let hccsvvNhi;
      if (newProfile.hccsvv_hang_ba_status === 'DA_NHAN') {
        hccsvvNhi = this.calculateHCCSVV(
          personnel.ngay_nhap_ngu,
          15,
          newProfile.hccsvv_hang_nhi_status || 'CHUA_DU',
          'Nhì'
        );
      } else {
        hccsvvNhi = {
          status: 'CHUA_DU',
          ngay: null,
          goiY: '',
        };
      }

      // Chỉ xét Hạng Nhất nếu ĐÃ NHẬN Hạng Nhì (DA_NHAN)
      let hccsvvNhat;
      if (newProfile.hccsvv_hang_nhi_status === 'DA_NHAN') {
        hccsvvNhat = this.calculateHCCSVV(
          personnel.ngay_nhap_ngu,
          20,
          newProfile.hccsvv_hang_nhat_status || 'CHUA_DU',
          'Nhất'
        );
      } else {
        hccsvvNhat = {
          status: 'CHUA_DU',
          ngay: null,
          goiY: '',
        };
      }

      // Tổng hợp gợi ý niên hạn
      const goiYList = [];
      if (hccsvvBa.goiY) goiYList.push(hccsvvBa.goiY);
      if (hccsvvNhi.goiY) goiYList.push(hccsvvNhi.goiY);
      if (hccsvvNhat.goiY) goiYList.push(hccsvvNhat.goiY);

      const finalGoiY =
        goiYList.length > 0
          ? goiYList.join('\n')
          : 'Chưa đủ điều kiện xét Huy chương Chiến sĩ Vẻ vang.';

      // Cập nhật hoặc tạo mới hồ sơ niên hạn
      await prisma.hoSoNienHan.upsert({
        where: { quan_nhan_id: personnelId },
        update: {
          hccsvv_hang_ba_status: hccsvvBa.status,
          hccsvv_hang_ba_ngay: hccsvvBa.ngay,
          hccsvv_hang_nhi_status: hccsvvNhi.status,
          hccsvv_hang_nhi_ngay: hccsvvNhi.ngay,
          hccsvv_hang_nhat_status: hccsvvNhat.status,
          hccsvv_hang_nhat_ngay: hccsvvNhat.ngay,
          goi_y: finalGoiY,
        },
        create: {
          quan_nhan_id: personnelId,
          hccsvv_hang_ba_status: hccsvvBa.status,
          hccsvv_hang_ba_ngay: hccsvvBa.ngay,
          hccsvv_hang_nhi_status: hccsvvNhi.status,
          hccsvv_hang_nhi_ngay: hccsvvNhi.ngay,
          hccsvv_hang_nhat_status: hccsvvNhat.status,
          hccsvv_hang_nhat_ngay: hccsvvNhat.ngay,
          goi_y: finalGoiY,
        },
      });
      return { message: 'Tính toán lại hồ sơ Huy chương Chiến sĩ vẻ vang thành công' };
    } catch (error) {
      console.error('Lỗi recalculateTenureProfile:', error);
      throw error;
    }
  }

  /**
   * Tính toán lại hồ sơ cống hiến cho 1 quân nhân (chỉ HCBVTQ - Huân chương Bảo vệ Tổ quốc)
   * @param {string} personnelId - ID quân nhân
   */
  async recalculateContributionProfile(personnelId) {
    console.log(
      `[recalculateContributionProfile] Bắt đầu tính toán hồ sơ cống hiến cho quân nhân ID: ${personnelId}`
    );
    const checkEligibleForRank = (personnel, rank) => {
      const months0_9_1_0 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.9-1.0');
      const months0_8 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.8');
      const months0_7 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.7');
      console.log(
        `[checkEligibleForRank] Kiểm tra điều kiện hạng ${rank} cho quân nhân ID: ${personnelId} - Tháng 0.9-1.0: ${months0_9_1_0}, Tháng 0.8: ${months0_8}, Tháng 0.7: ${months0_7}`
      );

      const baseRequiredMonths = 10 * 12;
      const femaleRequiredMonths = Math.round(baseRequiredMonths * (2 / 3));

      const requiredMonths =
        personnel?.gioi_tinh === 'NU' ? femaleRequiredMonths : baseRequiredMonths;

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
          // Nếu số tháng null thì lấy hôm này trừ ngày bắt đầu để tính số tháng
          totalMonths += history.so_thang || monthDiff(history.ngay_bat_dau, new Date());
        }
      });

      console.log(
        `[getTotalMonthsByGroup] Tổng số tháng cho nhóm ${group} của quân nhân ID: ${personnelId} là ${totalMonths}`
      );

      return totalMonths;
    };
    try {
      // Load thông tin quân nhân và lịch sử chức vụ
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
        throw new Error('Quân nhân không tồn tại');
      }

      console.log(
        `[recalculateContributionProfile] Quân nhân: ${personnel.ho_ten}, Giới tính: ${personnel.gioi_tinh}, Số lịch sử chức vụ: ${personnel.LichSuChucVu.length}`
      );
      // Lấy hồ sơ cống hiến hiện tại
      const existingProfile = await prisma.hoSoCongHien.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      const personnelHCBVTQ = await prisma.khenThuongCongHien.findMany({
        where: { quan_nhan_id: personnelId },
      });

      // Tính HCBVTQ dựa trên tổng số tháng công tác
      // Logic thứ bậc: Phải NHẬN hạng thấp trước mới được đề xuất hạng cao
      const hcbvtqBa = personnelHCBVTQ.find(kt => kt.danh_hieu === 'HCBVTQ_HANG_BA')
        ? {
            status: 'DA_NHAN',
          }
        : (await checkEligibleForRank(personnel, 'HANG_BA'))
        ? { status: 'DU_DIEU_KIEN' }
        : { status: 'CHUA_DU' };

      const hcbvtqNhi = personnelHCBVTQ.find(kt => kt.danh_hieu === 'HCBVTQ_HANG_NHI')
        ? {
            status: 'DA_NHAN',
          }
        : (await checkEligibleForRank(personnel, 'HANG_NHI'))
        ? { status: 'DU_DIEU_KIEN' }
        : { status: 'CHUA_DU' };

      const hcbvtqNhat = personnelHCBVTQ.find(kt => kt.danh_hieu === 'HCBVTQ_HANG_NHAT')
        ? {
            status: 'DA_NHAN',
          }
        : (await checkEligibleForRank(personnel, 'HANG_NHAT'))
        ? { status: 'DU_DIEU_KIEN' }
        : { status: 'CHUA_DU' };

      console.log(
        `[recalculateContributionProfile] Kết quả tính HCBVTQ - Ba: ${hcbvtqBa.status}, Nhì: ${hcbvtqNhi.status}, Nhất: ${hcbvtqNhat.status}`
      );

      const months0_7 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.7');
      const months0_8 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.8');
      const months0_9_1_0 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.9-1.0');

      // Cập nhật hoặc tạo mới hồ sơ cống hiến
      await prisma.hoSoCongHien.upsert({
        where: { quan_nhan_id: personnelId },
        update: {
          hcbvtq_total_months: months0_7 + months0_8 + months0_9_1_0,
          months_07: months0_7,
          months_08: months0_8,
          months_0910: months0_9_1_0,
          hcbvtq_hang_ba_status: hcbvtqBa.status,
          hcbvtq_hang_ba_ngay: null,
          hcbvtq_hang_nhi_status: hcbvtqNhi.status,
          hcbvtq_hang_nhi_ngay: null,
          hcbvtq_hang_nhat_status: hcbvtqNhat.status,
          hcbvtq_hang_nhat_ngay: null,
          goi_y: null,
        },
        create: {
          quan_nhan_id: personnelId,
          hcbvtq_total_months: months0_7 + months0_8 + months0_9_1_0,
          months_07: months0_7,
          months_08: months0_8,
          months_0910: months0_9_1_0,
          hcbvtq_hang_ba_status: hcbvtqBa.status,
          hcbvtq_hang_ba_ngay: null,
          hcbvtq_hang_nhi_status: hcbvtqNhi.status,
          hcbvtq_hang_nhi_ngay: null,
          hcbvtq_hang_nhat_status: hcbvtqNhat.status,
          hcbvtq_hang_nhat_ngay: null,
          goi_y: null,
        },
      });

      // ============================================
      // ĐỒNG BỘ STATUS VÀO BẢNG KhenThuongCongHien
      // Kiểm tra và cập nhật status của huân chương đã có
      // ============================================

      const existingCongHien = await prisma.khenThuongCongHien.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      if (existingCongHien) {
        // Xác định status dựa trên hạng đã nhận
        let updatedStatus = existingCongHien.danh_hieu;

        // Kiểm tra và cập nhật dữ liệu nếu cần
        // Ví dụ: Nếu đã đủ điều kiện hạng cao hơn, có thể cập nhật gợi ý
        await prisma.khenThuongCongHien.update({
          where: { id: existingCongHien.id },
          data: {
            // Cập nhật thời gian tính toán (nếu có thay đổi)
            thoi_gian_nhom_0_7: existingCongHien.thoi_gian_nhom_0_7,
            thoi_gian_nhom_0_8: existingCongHien.thoi_gian_nhom_0_8,
            thoi_gian_nhom_0_9_1_0: existingCongHien.thoi_gian_nhom_0_9_1_0,
          },
        });
      }

      return { message: 'Tính toán lại hồ sơ Huân chương Bảo vệ Tổ quốc thành công' };
    } catch (error) {
      console.error('Lỗi recalculateContributionProfile:', error);
      throw error;
    }
  }

  /**
   * Hàm helper tính toán HCBVTQ (Huân chương Bảo vệ Tổ quốc)
   * @param {number} totalMonths - Tổng số tháng công tác
   * @param {number} requiredMonths - Số tháng yêu cầu
   * @param {string} currentStatus - Trạng thái hiện tại
   * @param {string} rank - Hạng (Ba, Nhì, Nhất)
   */
  calculateHCBVTQ(totalMonths, requiredMonths, currentStatus, rank) {
    // Nếu đã nhận rồi, giữ nguyên trạng thái
    if (currentStatus === 'DA_NHAN') {
      return {
        status: 'DA_NHAN',
        ngay: null,
        goiY: '',
      };
    }

    // Kiểm tra đủ điều kiện
    if (totalMonths >= requiredMonths) {
      const years = Math.floor(totalMonths / 12);
      return {
        status: 'DU_DIEU_KIEN',
        ngay: new Date(), // Ngày đủ điều kiện
        goiY: `Đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank} (đã công tác ${years} năm).`,
      };
    }

    // Chưa đủ điều kiện
    const remainingMonths = requiredMonths - totalMonths;
    const remainingYears = Math.floor(remainingMonths / 12);
    const remainingMonthsOnly = remainingMonths % 12;

    return {
      status: 'CHUA_DU',
      ngay: null,
      goiY:
        remainingYears > 0
          ? `Còn ${remainingYears} năm ${remainingMonthsOnly} tháng nữa mới đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank}.`
          : `Còn ${remainingMonthsOnly} tháng nữa mới đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank}.`,
    };
  }

  /**
   * Tính toán lại cho toàn bộ quân nhân
   */
  async recalculateAll() {
    console.log('[recalculateAll] Bắt đầu tính toán lại cho tất cả quân nhân...');
    try {
      const allPersonnel = await prisma.quanNhan.findMany({
        select: { id: true },
      });

      console.log(`[recalculateAll] Tổng số quân nhân: ${allPersonnel.length}`);

      let successCount = 0;
      let errorCount = 0;

      for (const personnel of allPersonnel) {
        try {
          await this.recalculateAnnualProfile(personnel.id);
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`[recalculateAll] Tiến độ: ${successCount}/${allPersonnel.length}`);
          }
        } catch (error) {
          console.error(`Lỗi khi tính toán cho quân nhân ID ${personnel.id}:`, error.message);
          errorCount++;
        }
      }

      console.log(`[recalculateAll] Hoàn tất. Thành công: ${successCount}, Lỗi: ${errorCount}`);

      return {
        message: `Tính toán hoàn tất. Thành công: ${successCount}, Lỗi: ${errorCount}`,
        success: successCount,
        errors: errorCount,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách tất cả hồ sơ niên hạn (cho admin)
   */
  async getAllTenureProfiles() {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật trạng thái hồ sơ niên hạn (ADMIN duyệt huân chương)
   */
  async updateTenureProfile(personnelId, updates) {
    try {
      const profile = await prisma.hoSoNienHan.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      if (!profile) {
        throw new Error('Hồ sơ Huy chương Chiến sĩ vẻ vang không tồn tại');
      }

      // Validate và cập nhật
      const validStatuses = ['CHUA_DU', 'DU_DIEU_KIEN', 'DA_NHAN'];
      const updateData = {};

      // HCCSVV updates
      if (updates.hccsvv_hang_ba_status && validStatuses.includes(updates.hccsvv_hang_ba_status)) {
        updateData.hccsvv_hang_ba_status = updates.hccsvv_hang_ba_status;
      }
      if (
        updates.hccsvv_hang_nhi_status &&
        validStatuses.includes(updates.hccsvv_hang_nhi_status)
      ) {
        updateData.hccsvv_hang_nhi_status = updates.hccsvv_hang_nhi_status;
      }
      if (
        updates.hccsvv_hang_nhat_status &&
        validStatuses.includes(updates.hccsvv_hang_nhat_status)
      ) {
        updateData.hccsvv_hang_nhat_status = updates.hccsvv_hang_nhat_status;
      }

      // HCBVTQ updates
      if (updates.hcbvtq_hang_ba_status && validStatuses.includes(updates.hcbvtq_hang_ba_status)) {
        updateData.hcbvtq_hang_ba_status = updates.hcbvtq_hang_ba_status;
      }
      if (
        updates.hcbvtq_hang_nhi_status &&
        validStatuses.includes(updates.hcbvtq_hang_nhi_status)
      ) {
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
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new ProfileService();
