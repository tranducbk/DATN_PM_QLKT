const { prisma } = require('../models');
const proposalService = require('./proposal.service');
const notificationHelper = require('../helpers/notificationHelper');

class AwardBulkService {
  /**
   * Tính số năm phục vụ từ ngày nhập ngũ
   */
  calculateServiceYears(ngayNhapNgu, ngayXuatNgu = null) {
    if (!ngayNhapNgu) return null;

    const startDate = new Date(ngayNhapNgu);
    const endDate = ngayXuatNgu ? new Date(ngayXuatNgu) : new Date();

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months += endDate.getMonth() - startDate.getMonth();
    if (endDate.getDate() < startDate.getDate()) {
      months--;
    }
    months = Math.max(0, months);

    return {
      years: Math.floor(months / 12),
      months: months % 12,
      totalMonths: months,
    };
  }

  /**
   * Kiểm tra duplicate awards - tối ưu batch query
   */
  async checkDuplicateAwards(type, nam, titleData) {
    const duplicateErrors = [];
    if (!titleData || titleData.length === 0) return duplicateErrors;

    // Lấy tất cả personnel_id để batch query
    const personnelIds = titleData
      .map(item => item.personnel_id)
      .filter(Boolean)
      .filter((id, index, self) => self.indexOf(id) === index); // Unique

    // Batch query để lấy tên quân nhân một lần
    const personnelMap = {};
    if (personnelIds.length > 0) {
      const personnelList = await prisma.quanNhan.findMany({
        where: { id: { in: personnelIds } },
        select: { id: true, ho_ten: true },
      });
      personnelList.forEach(p => {
        personnelMap[p.id] = p.ho_ten;
      });
    }

    // Kiểm tra duplicate cho từng item (parallel)
    const duplicateChecks = titleData
      .filter(item => item.personnel_id && item.danh_hieu)
      .map(async item => {
        const checkResult = await proposalService.checkDuplicateAward(
          item.personnel_id,
          nam,
          item.danh_hieu,
          type,
          type === 'CONG_HIEN' ? null : 'APPROVED'
        );
        if (checkResult.exists) {
          return {
            personnelId: item.personnel_id,
            hoTen: personnelMap[item.personnel_id] || item.personnel_id,
            message: checkResult.message,
          };
        }
        return null;
      });

    const results = await Promise.all(duplicateChecks);
    results.forEach(result => {
      if (result) {
        duplicateErrors.push(`${result.hoTen}: ${result.message}`);
      }
    });

    return duplicateErrors;
  }

  /**
   * Kiểm tra duplicate unit awards
   */
  async checkDuplicateUnitAwards(nam, titleData) {
    const duplicateErrors = [];
    if (!titleData || titleData.length === 0) return duplicateErrors;

    for (const item of titleData) {
      if (item.don_vi_id && item.danh_hieu) {
        const checkResult = await proposalService.checkDuplicateUnitAward(
          item.don_vi_id,
          nam,
          item.danh_hieu,
          'DON_VI_HANG_NAM'
        );
        if (checkResult.exists) {
          duplicateErrors.push(`Đơn vị ${item.don_vi_id}: ${checkResult.message}`);
        }
      }
    }

    return duplicateErrors;
  }

  /**
   * Kiểm tra điều kiện đủ cho quân nhân - tối ưu batch query
   */
  async validatePersonnelConditions(type, selectedPersonnel) {
    const errors = [];
    if (!selectedPersonnel || selectedPersonnel.length === 0) return errors;

    // Batch query để lấy thông tin quân nhân một lần
    const personnelList = await prisma.quanNhan.findMany({
      where: { id: { in: selectedPersonnel } },
      select: {
        id: true,
        ho_ten: true,
        gioi_tinh: true,
        ngay_nhap_ngu: true,
        ngay_xuat_ngu: true,
      },
    });

    const personnelMap = {};
    personnelList.forEach(p => {
      personnelMap[p.id] = p;
    });

    // Kiểm tra từng quân nhân
    for (const personnelId of selectedPersonnel) {
      const quanNhan = personnelMap[personnelId];

      if (!quanNhan) {
        errors.push(`Không tìm thấy quân nhân với ID: ${personnelId}`);
        continue;
      }

      // KNC_VSNXD_QDNDVN: Cần giới tính và ngày nhập ngũ
      if (type === 'KNC_VSNXD_QDNDVN') {
        if (!quanNhan.gioi_tinh || (quanNhan.gioi_tinh !== 'NAM' && quanNhan.gioi_tinh !== 'NU')) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật giới tính`);
        }
        if (!quanNhan.ngay_nhap_ngu) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật ngày nhập ngũ`);
        }
      }

      // NIEN_HAN: Cần ngày nhập ngũ
      if (type === 'NIEN_HAN') {
        if (!quanNhan.ngay_nhap_ngu) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật ngày nhập ngũ`);
        }
      }

      // HC_QKQT: Cần ngày nhập ngũ và >= 25 năm phục vụ
      if (type === 'HC_QKQT') {
        if (!quanNhan.ngay_nhap_ngu) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật ngày nhập ngũ`);
        } else {
          const serviceTime = this.calculateServiceYears(
            quanNhan.ngay_nhap_ngu,
            quanNhan.ngay_xuat_ngu
          );
          if (serviceTime && serviceTime.years < 25) {
            errors.push(
              `Quân nhân "${quanNhan.ho_ten}" chưa đủ 25 năm phục vụ (hiện tại: ${serviceTime.years} năm)`
            );
          }
        }
      }
    }

    return errors;
  }

  /**
   * Thêm khen thưởng đồng loạt với validation đầy đủ
   * Sử dụng logic tương tự như approveProposal
   */
  async bulkCreateAwards({
    type,
    nam,
    selectedPersonnel,
    selectedUnits,
    titleData,
    ghiChu,
    attachedFiles,
    adminId,
  }) {
    try {
      const errors = [];
      const affectedPersonnelIds = new Set();
      let importedCount = 0;

      // ============================================
      // VALIDATION 1: Kiểm tra duplicate (cùng năm và cùng danh hiệu)
      // ============================================
      const duplicateErrors = [];

      // Kiểm tra duplicate cho cá nhân
      if (
        ['CA_NHAN_HANG_NAM', 'NIEN_HAN', 'HC_QKQT', 'KNC_VSNXD_QDNDVN', 'CONG_HIEN'].includes(type)
      ) {
        const personnelDuplicates = await this.checkDuplicateAwards(type, nam, titleData);
        duplicateErrors.push(...personnelDuplicates);
      }

      // Kiểm tra duplicate cho đơn vị
      if (type === 'DON_VI_HANG_NAM') {
        const unitDuplicates = await this.checkDuplicateUnitAwards(nam, titleData);
        duplicateErrors.push(...unitDuplicates);
      }

      if (duplicateErrors.length > 0) {
        throw new Error(
          `Phát hiện khen thưởng trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
        );
      }

      // ============================================
      // VALIDATION 2: Kiểm tra điều kiện đủ (ngày nhập ngũ, giới tính, thời gian phục vụ)
      // ============================================
      if (['KNC_VSNXD_QDNDVN', 'NIEN_HAN', 'HC_QKQT'].includes(type)) {
        const validationErrors = await this.validatePersonnelConditions(type, selectedPersonnel);
        errors.push(...validationErrors);
      }

      // Validation cho NCKH: Kiểm tra loại và mô tả
      if (type === 'NCKH') {
        for (const item of titleData) {
          if (!item.loai || !['DTKH', 'SKKH'].includes(item.loai)) {
            errors.push(
              `Thành tích khoa học phải có loại là "DTKH" hoặc "SKKH" (quân nhân: ${item.personnel_id})`
            );
          }
          if (!item.mo_ta || item.mo_ta.trim() === '') {
            errors.push(`Thành tích khoa học phải có mô tả (quân nhân: ${item.personnel_id})`);
          }
        }
      }

      // Validation cho DON_VI_HANG_NAM: Kiểm tra danh hiệu hợp lệ
      if (type === 'DON_VI_HANG_NAM') {
        const validDanhHieus = ['ĐVQT', 'ĐVTT', 'BKBQP', 'BKTTCP'];
        for (const item of titleData) {
          if (!item.danh_hieu || !validDanhHieus.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu đơn vị không hợp lệ: ${
                item.danh_hieu
              }. Chỉ chấp nhận: ${validDanhHieus.join(', ')}`
            );
          }
        }
      }

      // Validation cho CA_NHAN_HANG_NAM: Kiểm tra danh hiệu hợp lệ
      if (type === 'CA_NHAN_HANG_NAM') {
        const validDanhHieus = ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'];
        for (const item of titleData) {
          if (!item.danh_hieu || !validDanhHieus.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu không hợp lệ: ${item.danh_hieu}. Chỉ chấp nhận: ${validDanhHieus.join(
                ', '
              )}`
            );
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(`Phát hiện lỗi validation:\n${errors.join('\n')}`);
      }

      // ============================================
      // LƯU VÀO DATABASE - Sử dụng logic từ approveProposal
      // ============================================
      // Tạo một proposal giả để tái sử dụng logic approveProposal
      // Hoặc gọi trực tiếp các service tương ứng

      // Với CA_NHAN_HANG_NAM: Gọi annualRewardService.bulkCreateAnnualRewards
      if (type === 'CA_NHAN_HANG_NAM') {
        const annualRewardService = require('./annualReward.service');
        const personnelRewardsData = titleData.map(item => ({
          personnel_id: item.personnel_id,
          so_quyet_dinh: item.so_quyet_dinh || null,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
        }));

        const firstItem = titleData[0];
        const result = await annualRewardService.bulkCreateAnnualRewards({
          personnel_ids: selectedPersonnel,
          personnel_rewards_data: personnelRewardsData,
          nam: nam,
          danh_hieu: firstItem.danh_hieu,
          ghi_chu: ghiChu,
        });

        importedCount = result.created?.length || selectedPersonnel.length;
        selectedPersonnel.forEach(id => affectedPersonnelIds.add(id));
      }

      // Với DON_VI_HANG_NAM: Gọi unitAnnualAwardService.upsert cho từng đơn vị
      else if (type === 'DON_VI_HANG_NAM') {
        const unitAnnualAwardService = require('./unitAnnualAward.service');
        for (const item of titleData) {
          try {
            await unitAnnualAwardService.upsert({
              don_vi_id: item.don_vi_id,
              nam: nam,
              danh_hieu: item.danh_hieu,
              so_quyet_dinh: item.so_quyet_dinh || null,
              ghi_chu: ghiChu || null,
              nguoi_tao_id: adminId,
            });
            importedCount++;
          } catch (error) {
            errors.push(`Lỗi khi thêm khen thưởng cho đơn vị ${item.don_vi_id}: ${error.message}`);
          }
        }
      }

      // Với NCKH: Gọi scientificAchievementService.createAchievement
      else if (type === 'NCKH') {
        const scientificAchievementService = require('./scientificAchievement.service');
        for (const item of titleData) {
          try {
            await scientificAchievementService.createAchievement({
              personnel_id: item.personnel_id,
              nam: nam,
              loai: item.loai,
              mo_ta: item.mo_ta,
              cap_bac: item.cap_bac || null,
              chuc_vu: item.chuc_vu || null,
              so_quyet_dinh: item.so_quyet_dinh || null,
              ghi_chu: ghiChu || null,
              status: 'APPROVED', // Tự động approve khi admin thêm trực tiếp
            });
            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          } catch (error) {
            errors.push(
              `Lỗi khi thêm thành tích cho quân nhân ${item.personnel_id}: ${error.message}`
            );
          }
        }
      }

      // Với HC_QKQT: Tạo/cập nhật HuanChuongQuanKyQuyetThang
      else if (type === 'HC_QKQT') {
        for (const item of titleData) {
          try {
            // Lấy thông tin quân nhân để tính thời gian
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            // Tính thời gian từ ngày nhập ngũ
            let thoiGian = null;
            if (quanNhan.ngay_nhap_ngu) {
              const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
              const ngayKetThuc = quanNhan.ngay_xuat_ngu
                ? new Date(quanNhan.ngay_xuat_ngu)
                : new Date();

              let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
              months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
              if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                months--;
              }
              months = Math.max(0, months);

              const years = Math.floor(months / 12);
              const remainingMonths = months % 12;
              thoiGian = {
                total_months: months,
                years: years,
                months: remainingMonths,
                display:
                  months === 0
                    ? '-'
                    : years > 0 && remainingMonths > 0
                    ? `${years} năm ${remainingMonths} tháng`
                    : years > 0
                    ? `${years} năm`
                    : `${remainingMonths} tháng`,
              };
            }

            // Upsert (mỗi quân nhân chỉ có 1 bản ghi)
            await prisma.huanChuongQuanKyQuyetThang.upsert({
              where: { quan_nhan_id: item.personnel_id },
              create: {
                quan_nhan_id: item.personnel_id,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
              update: {
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          } catch (error) {
            errors.push(
              `Lỗi khi thêm HC_QKQT cho quân nhân ${item.personnel_id}: ${error.message}`
            );
          }
        }
      }

      // Với NIEN_HAN: Tạo/cập nhật KhenThuongHCCSVV
      else if (type === 'NIEN_HAN') {
        for (const item of titleData) {
          try {
            if (!item.danh_hieu) {
              errors.push(`Huy chương Chiến sĩ vẻ vang thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
              continue;
            }

            // Chỉ xử lý các hạng HCCSVV
            const allowedDanhHieus = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
            if (!allowedDanhHieus.includes(item.danh_hieu)) {
              errors.push(
                `Danh hiệu "${
                  item.danh_hieu
                }" không hợp lệ cho Huy chương Chiến sĩ vẻ vang. Chỉ cho phép: ${allowedDanhHieus.join(', ')}`
              );
              continue;
            }

            // Lấy thông tin quân nhân để tính thời gian
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            // Tính thời gian từ ngày nhập ngũ
            let thoiGian = null;
            if (quanNhan.ngay_nhap_ngu) {
              const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
              const ngayKetThuc = quanNhan.ngay_xuat_ngu
                ? new Date(quanNhan.ngay_xuat_ngu)
                : new Date();

              let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
              months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
              if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                months--;
              }
              months = Math.max(0, months);

              const years = Math.floor(months / 12);
              const remainingMonths = months % 12;
              thoiGian = {
                total_months: months,
                years: years,
                months: remainingMonths,
                display:
                  months === 0
                    ? '-'
                    : years > 0 && remainingMonths > 0
                    ? `${years} năm ${remainingMonths} tháng`
                    : years > 0
                    ? `${years} năm`
                    : `${remainingMonths} tháng`,
              };
            }

            // Upsert (mỗi người có thể có tối đa 3 bản ghi: Hạng Ba, Nhì, Nhất)
            await prisma.khenThuongHCCSVV.upsert({
              where: {
                quan_nhan_id_danh_hieu: {
                  quan_nhan_id: item.personnel_id,
                  danh_hieu: item.danh_hieu,
                },
              },
              create: {
                quan_nhan_id: item.personnel_id,
                danh_hieu: item.danh_hieu,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
              update: {
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          } catch (error) {
            errors.push(
              `Lỗi khi thêm Huy chương Chiến sĩ vẻ vang cho quân nhân ${item.personnel_id}: ${error.message}`
            );
          }
        }
      }

      // Với KNC_VSNXD_QDNDVN: Tạo/cập nhật KyNiemChuongVSNXDQDNDVN
      else if (type === 'KNC_VSNXD_QDNDVN') {
        for (const item of titleData) {
          try {
            // Lấy thông tin quân nhân để tính thời gian
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            // Tính thời gian từ ngày nhập ngũ
            let thoiGian = null;
            if (quanNhan.ngay_nhap_ngu) {
              const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
              const ngayKetThuc = quanNhan.ngay_xuat_ngu
                ? new Date(quanNhan.ngay_xuat_ngu)
                : new Date();

              let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
              months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
              if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                months--;
              }
              months = Math.max(0, months);

              const years = Math.floor(months / 12);
              const remainingMonths = months % 12;
              thoiGian = {
                total_months: months,
                years: years,
                months: remainingMonths,
                display:
                  months === 0
                    ? '-'
                    : years > 0 && remainingMonths > 0
                    ? `${years} năm ${remainingMonths} tháng`
                    : years > 0
                    ? `${years} năm`
                    : `${remainingMonths} tháng`,
              };
            }

            // Upsert (mỗi quân nhân chỉ có 1 bản ghi)
            await prisma.kyNiemChuongVSNXDQDNDVN.upsert({
              where: { quan_nhan_id: item.personnel_id },
              create: {
                quan_nhan_id: item.personnel_id,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
              update: {
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          } catch (error) {
            errors.push(
              `Lỗi khi thêm KNC_VSNXD_QDNDVN cho quân nhân ${item.personnel_id}: ${error.message}`
            );
          }
        }
      }

      // Với CONG_HIEN: Tạo/cập nhật KhenThuongCongHien
      else if (type === 'CONG_HIEN') {
        for (const item of titleData) {
          try {
            if (!item.danh_hieu) {
              errors.push(`Huân chương Bảo vệ Tổ quốc thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
              continue;
            }

            // Chỉ xử lý các hạng HCBVTQ
            const allowedDanhHieus = ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'];
            if (!allowedDanhHieus.includes(item.danh_hieu)) {
              errors.push(
                `Danh hiệu "${
                  item.danh_hieu
                }" không hợp lệ cho Huân chương Bảo vệ Tổ quốc. Chỉ cho phép: ${allowedDanhHieus.join(', ')}`
              );
              continue;
            }

            // Upsert (mỗi quân nhân chỉ có 1 bản ghi)
            await prisma.khenThuongCongHien.upsert({
              where: { quan_nhan_id: item.personnel_id },
              create: {
                quan_nhan_id: item.personnel_id,
                danh_hieu: item.danh_hieu,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian_nhom_0_7: item.thoi_gian_nhom_0_7 || null,
                thoi_gian_nhom_0_8: item.thoi_gian_nhom_0_8 || null,
                thoi_gian_nhom_0_9_1_0: item.thoi_gian_nhom_0_9_1_0 || null,
              },
              update: {
                danh_hieu: item.danh_hieu,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian_nhom_0_7: item.thoi_gian_nhom_0_7 || null,
                thoi_gian_nhom_0_8: item.thoi_gian_nhom_0_8 || null,
                thoi_gian_nhom_0_9_1_0: item.thoi_gian_nhom_0_9_1_0 || null,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          } catch (error) {
            errors.push(
              `Lỗi khi thêm Huân chương Bảo vệ Tổ quốc cho quân nhân ${item.personnel_id}: ${error.message}`
            );
          }
        }
      }

      // Các loại khác chưa được hỗ trợ
      else {
        throw new Error(
          `Loại khen thưởng "${type}" chưa được hỗ trợ trong chức năng thêm đồng loạt.`
        );
      }

      if (errors.length > 0 && importedCount === 0) {
        throw new Error(`Thêm khen thưởng thất bại:\n${errors.join('\n')}`);
      }

      // Gửi thông báo cho quân nhân và Manager
      try {
        // Lấy username của admin
        const admin = await prisma.taiKhoan.findUnique({
          where: { id: adminId },
          select: { username: true },
        });

        if (admin) {
          await notificationHelper.notifyOnBulkAwardAdded(
            Array.from(affectedPersonnelIds),
            selectedUnits || [],
            type,
            nam,
            titleData,
            admin.username
          );
        }
      } catch (notifError) {
        console.error('Failed to send bulk award notifications:', notifError);
        // Không throw error để không ảnh hưởng đến quá trình thêm khen thưởng
      }

      return {
        message:
          importedCount > 0
            ? `Đã thêm thành công ${importedCount} ${
                type === 'DON_VI_HANG_NAM' ? 'đơn vị' : 'quân nhân'
              }${errors.length > 0 ? `, ${errors.length} lỗi` : ''}`
            : 'Thêm khen thưởng thành công!',
        data: {
          importedCount,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined,
          affectedPersonnelIds: Array.from(affectedPersonnelIds),
        },
      };
    } catch (error) {
      console.error('Bulk create awards service error:', error);
      throw error;
    }
  }
}

module.exports = new AwardBulkService();
