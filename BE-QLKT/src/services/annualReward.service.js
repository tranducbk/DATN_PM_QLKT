const { prisma } = require('../models');
const ExcelJS = require('exceljs');
const proposalService = require('./proposal.service');
const profileService = require('./profile.service');
const notificationHelper = require('../helpers/notificationHelper');

class AnnualRewardService {
  /**
   * Lấy nhật ký danh hiệu của 1 quân nhân
   */
  async getAnnualRewards(personnelId) {
    try {
      if (!personnelId) {
        throw new Error('personnel_id là bắt buộc');
      }

      // Kiểm tra quân nhân có tồn tại không
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      const rewards = await prisma.danhHieuHangNam.findMany({
        where: { quan_nhan_id: personnelId },
        orderBy: {
          nam: 'desc',
        },
      });

      return rewards;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm danh hiệu cho quân nhân
   */
  async createAnnualReward(data) {
    try {
      const {
        personnel_id,
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      } = data;

      // Kiểm tra quân nhân có tồn tại không
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnel_id },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      // Validate danh hiệu (cho phép null = không đạt)
      const validDanhHieu = ['CSTDCS', 'CSTT'];
      if (danh_hieu && !validDanhHieu.includes(danh_hieu)) {
        throw new Error(
          'Danh hiệu không hợp lệ. Danh hiệu hợp lệ: ' +
            validDanhHieu.join(', ') +
            ' (hoặc null = không đạt)'
        );
      }

      // Kiểm tra đã có bản ghi cho năm này chưa
      const existingReward = await prisma.danhHieuHangNam.findFirst({
        where: {
          quan_nhan_id: personnel_id,
          nam,
        },
      });

      if (existingReward) {
        throw new Error(`Quân nhân đã có danh hiệu cho năm ${nam}`);
      }

      // Tạo bản ghi mới
      const newReward = await prisma.danhHieuHangNam.create({
        data: {
          quan_nhan_id: personnel_id,
          nam,
          danh_hieu,
          cap_bac: cap_bac || null,
          chuc_vu: chuc_vu || null,
          ghi_chu: ghi_chu || null,
          nhan_bkbqp: nhan_bkbqp || false,
          so_quyet_dinh_bkbqp: so_quyet_dinh_bkbqp || null,
          nhan_cstdtq: nhan_cstdtq || false,
          so_quyet_dinh_cstdtq: so_quyet_dinh_cstdtq || null,
          nhan_bkttcp: nhan_bkttcp || false,
          so_quyet_dinh_bkttcp: so_quyet_dinh_bkttcp || null,
        },
      });

      // Tự động cập nhật lại hồ sơ hằng năm
      try {
        await profileService.recalculateAnnualProfile(personnel_id);
      } catch (recalcError) {
        console.error(
          `⚠️ Failed to auto-recalculate annual profile for personnel ${personnel_id}:`,
          recalcError.message
        );
        // Không throw error, chỉ log để không ảnh hưởng đến việc tạo danh hiệu
      }

      return newReward;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sửa một bản ghi danh hiệu
   */
  async updateAnnualReward(id, data) {
    try {
      const {
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      } = data;

      // Kiểm tra bản ghi có tồn tại không
      const reward = await prisma.danhHieuHangNam.findUnique({
        where: { id },
      });

      if (!reward) {
        throw new Error('Bản ghi danh hiệu không tồn tại');
      }

      // Validate danh hiệu nếu có (cho phép null = không đạt)
      if (danh_hieu) {
        const validDanhHieu = ['CSTDCS', 'CSTT'];
        if (!validDanhHieu.includes(danh_hieu)) {
          throw new Error(
            'Danh hiệu không hợp lệ. Danh hiệu hợp lệ: ' +
              validDanhHieu.join(', ') +
              ' (hoặc null = không đạt)'
          );
        }
      }

      // Cập nhật
      const updatedReward = await prisma.danhHieuHangNam.update({
        where: { id },
        data: {
          nam: nam || reward.nam,
          danh_hieu: danh_hieu || reward.danh_hieu,
          cap_bac: cap_bac !== undefined ? cap_bac : reward.cap_bac,
          chuc_vu: chuc_vu !== undefined ? chuc_vu : reward.chuc_vu,
          ghi_chu: ghi_chu !== undefined ? ghi_chu : reward.ghi_chu,
          nhan_bkbqp: nhan_bkbqp !== undefined ? nhan_bkbqp : reward.nhan_bkbqp,
          so_quyet_dinh_bkbqp:
            so_quyet_dinh_bkbqp !== undefined ? so_quyet_dinh_bkbqp : reward.so_quyet_dinh_bkbqp,
          nhan_cstdtq: nhan_cstdtq !== undefined ? nhan_cstdtq : reward.nhan_cstdtq,
          so_quyet_dinh_cstdtq:
            so_quyet_dinh_cstdtq !== undefined ? so_quyet_dinh_cstdtq : reward.so_quyet_dinh_cstdtq,
          nhan_bkttcp: nhan_bkttcp !== undefined ? nhan_bkttcp : reward.nhan_bkttcp,
          so_quyet_dinh_bkttcp:
            so_quyet_dinh_bkttcp !== undefined ? so_quyet_dinh_bkttcp : reward.so_quyet_dinh_bkttcp,
        },
      });

      // Tự động cập nhật lại hồ sơ hằng năm
      try {
        await profileService.recalculateAnnualProfile(reward.quan_nhan_id);
      } catch (recalcError) {
        console.error(
          `⚠️ Failed to auto-recalculate annual profile for personnel ${reward.quan_nhan_id}:`,
          recalcError.message
        );
        // Không throw error, chỉ log để không ảnh hưởng đến việc cập nhật danh hiệu
      }

      return updatedReward;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa một bản ghi danh hiệu
   * @param {string} id - ID của bản ghi danh hiệu
   * @param {string} adminUsername - Username của admin thực hiện xóa
   */
  async deleteAnnualReward(id, adminUsername = 'Admin') {
    try {
      // Kiểm tra bản ghi có tồn tại không và lấy thông tin quân nhân
      const reward = await prisma.danhHieuHangNam.findUnique({
        where: { id },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: true,
            },
          },
        },
      });

      if (!reward) {
        throw new Error('Bản ghi danh hiệu không tồn tại');
      }

      const personnelId = reward.quan_nhan_id;
      const personnel = reward.QuanNhan;

      // Xóa
      await prisma.danhHieuHangNam.delete({
        where: { id },
      });

      // Tự động cập nhật lại hồ sơ hằng năm
      try {
        await profileService.recalculateAnnualProfile(personnelId);
      } catch (recalcError) {
        console.error(
          `⚠️ Failed to auto-recalculate annual profile for personnel ${personnelId}:`,
          recalcError.message
        );
      }

      // Gửi thông báo cho Manager và quân nhân
      try {
        await notificationHelper.notifyOnAwardDeleted(
          reward,
          personnel,
          'CA_NHAN_HANG_NAM',
          adminUsername
        );
        console.log(`✅ Sent notification for deleted annual reward`);
      } catch (notifyError) {
        console.error(`⚠️ Failed to send notification:`, notifyError.message);
      }

      return {
        message: 'Xóa bản ghi danh hiệu thành công',
        personnelId,
        personnel,
        reward,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Import danh hiệu hằng năm từ Excel buffer
   * Cột: CCCD (bắt buộc), nam (bắt buộc), danh_hieu (CSTDCS, CSTT)
   * Nếu danh_hieu rỗng hoặc KHONG_DAT → lưu là null (= không đạt)
   * Khóa: CCCD + nam (nếu đã có sẽ cập nhật danh_hieu; nếu chưa có sẽ tạo mới)
   */
  async importFromExcelBuffer(buffer) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error('File Excel không hợp lệ');
      }

      // Header map
      const headerRow = worksheet.getRow(1);
      const headerMap = {};

      // Function to remove Vietnamese accents
      const removeVietnameseAccents = str => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D');
      };

      headerRow.eachCell((cell, colNumber) => {
        const rawValue = String(cell.value || '')
          .trim()
          .toLowerCase();
        // Normalize header: remove accents, special chars, and extra spaces
        const key = removeVietnameseAccents(rawValue)
          .replace(/\s+/g, '_') // Replace spaces with underscore
          .replace(/[^a-z0-9_]/g, '') // Remove special characters
          .replace(/_+/g, '_') // Replace multiple underscores with single
          .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
        if (key) headerMap[key] = colNumber;
      });

      console.log('=== DEBUG: Header Map ===');
      console.log('Available headers:', Object.keys(headerMap));
      console.log('Full headerMap:', headerMap);

      // Try multiple variations of headers
      const getHeaderCol = variations => {
        for (const v of variations) {
          if (headerMap[v]) return headerMap[v];
        }
        return null;
      };

      const hoTenCol = getHeaderCol(['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
      const namCol = getHeaderCol(['nam', 'year']);
      const danhHieuCol = getHeaderCol(['danh_hieu', 'danhhieu', 'danh_hiu']);
      const ngaySinhCol = getHeaderCol(['ngay_sinh', 'ngaysinh', 'date_of_birth']);
      const capBacCol = getHeaderCol(['cap_bac', 'capbac', 'cap_bc']);
      const chucVuCol = getHeaderCol(['chuc_vu', 'chucvu', 'chc_vu']);
      const ghiChuCol = getHeaderCol(['ghi_chu', 'ghichu', 'ghi_ch']);

      console.log('=== DEBUG: Column Detection ===');
      console.log('hoTenCol:', hoTenCol);
      console.log('namCol:', namCol);
      console.log('danhHieuCol:', danhHieuCol);

      if (!hoTenCol || !namCol || !danhHieuCol) {
        throw new Error(
          `Thiếu cột bắt buộc: Họ và tên, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(
            headerMap
          ).join(', ')}`
        );
      }

      const validDanhHieu = ['CSTDCS', 'CSTT'];
      const created = [];
      const updated = [];
      const errors = [];
      const selectedPersonnelIds = [];
      const titleData = [];
      const importedData = [];
      let total = 0;

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const ho_ten = String(row.getCell(hoTenCol).value || '').trim();
        const namVal = row.getCell(namCol).value;
        const danh_hieu_raw = String(row.getCell(danhHieuCol).value || '').trim();
        const ngay_sinh_raw = ngaySinhCol ? row.getCell(ngaySinhCol).value : null;
        const cap_bac = capBacCol ? String(row.getCell(capBacCol).value || '').trim() : null;
        const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value || '').trim() : null;
        const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : null;

        if (!ho_ten && !namVal && !danh_hieu_raw) continue; // dòng trống

        total++; // Đếm tổng số dòng có data

        if (!ho_ten || !namVal) {
          errors.push(`Dòng ${rowNumber}: Thiếu họ tên hoặc năm`);
          continue;
        }

        const nam = parseInt(namVal);
        if (!Number.isInteger(nam)) {
          errors.push(`Dòng ${rowNumber}: Giá trị năm không hợp lệ`);
          continue;
        }

        // Xử lý danh_hieu: rỗng hoặc KHONG_DAT → null (không đạt)
        let danh_hieu = null;
        if (danh_hieu_raw) {
          const danhHieuUpper = danh_hieu_raw.toUpperCase();
          if (danhHieuUpper !== 'KHONG_DAT') {
            if (!validDanhHieu.includes(danhHieuUpper)) {
              errors.push(`Dòng ${rowNumber}: Danh hiệu không hợp lệ: ${danh_hieu_raw}`);
              continue;
            }
            danh_hieu = danhHieuUpper;
          }
          // Nếu là KHONG_DAT → để null
        }

        // Tìm quân nhân theo tên
        const personnelList = await prisma.quanNhan.findMany({ where: { ho_ten } });
        if (personnelList.length === 0) {
          errors.push(`Dòng ${rowNumber}: Không tìm thấy quân nhân với tên ${ho_ten}`);
          continue;
        }

        let personnel;
        if (personnelList.length === 1) {
          personnel = personnelList[0];
        } else {
          // Nhiều người trùng tên, dùng ngày sinh
          if (!ngay_sinh_raw) {
            errors.push(
              `Dòng ${rowNumber}: Có ${personnelList.length} người trùng tên "${ho_ten}". Vui lòng cung cấp ngày sinh`
            );
            continue;
          }

          let ngay_sinh;
          if (ngay_sinh_raw instanceof Date) {
            ngay_sinh = ngay_sinh_raw;
          } else {
            const dateStr = String(ngay_sinh_raw).trim();
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2]);
              ngay_sinh = new Date(year, month, day);
            } else {
              errors.push(`Dòng ${rowNumber}: Ngày sinh không đúng định dạng (DD/MM/YYYY)`);
              continue;
            }
          }

          personnel = personnelList.find(p => {
            if (!p.ngay_sinh) return false;
            const pDate = new Date(p.ngay_sinh);
            return (
              pDate.getDate() === ngay_sinh.getDate() &&
              pDate.getMonth() === ngay_sinh.getMonth() &&
              pDate.getFullYear() === ngay_sinh.getFullYear()
            );
          });

          if (!personnel) {
            errors.push(
              `Dòng ${rowNumber}: Không tìm thấy quân nhân tên "${ho_ten}" với ngày sinh đã cung cấp`
            );
            continue;
          }
        }

        // Check for duplicate awards in proposals
        if (danh_hieu) {
          try {
            const duplicateCheck = await proposalService.checkDuplicateAward(
              personnel.id,
              nam,
              danh_hieu,
              'CA_NHAN_HANG_NAM',
              'APPROVED'
            );
            if (duplicateCheck.isDuplicate) {
              const { getDanhHieuName } = require('../constants/danhHieu.constants');
              errors.push(
                `Dòng ${rowNumber}: ${
                  duplicateCheck.message
                } (Quân nhân: ${ho_ten}, Năm: ${nam}, Danh hiệu: ${getDanhHieuName(danh_hieu)})`
              );
              continue;
            }
          } catch (checkError) {
            console.error('Error checking duplicates:', checkError);
            // Continue processing but log the error
          }
        }

        // Tìm bản ghi danh hiệu theo khóa (quan_nhan_id + nam)
        const existing = await prisma.danhHieuHangNam.findFirst({
          where: { quan_nhan_id: personnel.id, nam },
        });

        if (!existing) {
          const createdReward = await prisma.danhHieuHangNam.create({
            data: {
              quan_nhan_id: personnel.id,
              nam,
              danh_hieu,
              cap_bac: cap_bac || null,
              chuc_vu: chuc_vu || null,
              ghi_chu: ghi_chu || null,
              nhan_bkbqp: false,
              nhan_cstdtq: false,
              nhan_bkttcp: false,
            },
          });
          created.push(createdReward.id);
        } else {
          await prisma.danhHieuHangNam.update({
            where: { id: existing.id },
            data: {
              danh_hieu,
              cap_bac: cap_bac !== undefined ? cap_bac : existing.cap_bac,
              chuc_vu: chuc_vu !== undefined ? chuc_vu : existing.chuc_vu,
              ghi_chu: ghi_chu !== undefined ? ghi_chu : existing.ghi_chu,
            },
          });
          updated.push(existing.id);
        }

        // Add to selectedPersonnelIds if not already added
        if (!selectedPersonnelIds.includes(personnel.id)) {
          selectedPersonnelIds.push(personnel.id);
        }

        // Add to titleData with full information from Excel
        titleData.push({
          personnelId: personnel.id,
          quan_nhan_id: personnel.id,
          danh_hieu: danh_hieu,
          nam: nam,
          cap_bac: cap_bac || null,
          chuc_vu: chuc_vu || null,
          ghi_chu: ghi_chu || null,
          so_quyet_dinh: null, // Annual rewards don't have decision number
        });

        // Tự động cập nhật lại hồ sơ hằng năm cho quân nhân này
        try {
          await profileService.recalculateAnnualProfile(personnel.id);
        } catch (recalcError) {
          console.error(
            `⚠️ Failed to auto-recalculate annual profile for personnel ${personnel.id}:`,
            recalcError.message
          );
          // Không throw error, chỉ log
        }
      }

      return {
        imported: created.length + updated.length,
        total,
        errors,
        selectedPersonnelIds,
        titleData,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kiểm tra quân nhân đã có khen thưởng hoặc đề xuất cho năm đó chưa
   */
  async checkAnnualRewards(personnelIds, nam, danhHieu) {
    try {
      console.log('🔍 [checkAnnualRewards] Service called with:');
      console.log('  - personnelIds:', personnelIds);
      console.log('  - personnelIds type:', typeof personnelIds);
      console.log('  - Is array:', Array.isArray(personnelIds));
      console.log('  - nam:', nam);
      console.log('  - danhHieu:', danhHieu);

      const results = [];

      for (const personnelId of personnelIds) {
        console.log(
          `🔍 [checkAnnualRewards] Processing personnelId: ${personnelId} (${typeof personnelId})`
        );
        // Chuyển đổi personnelId sang string nếu cần
        const personnelIdStr = String(personnelId);

        if (!personnelIdStr) {
          continue;
        }

        const result = {
          personnel_id: personnelId,
          has_reward: false,
          has_proposal: false,
          reward: null,
          proposal: null,
        };

        // Kiểm tra đã có khen thưởng cho năm này chưa
        const existingReward = await prisma.danhHieuHangNam.findFirst({
          where: {
            quan_nhan_id: personnelIdStr,
            nam: parseInt(nam),
          },
        });

        if (existingReward) {
          result.has_reward = true;
          result.reward = {
            id: existingReward.id,
            nam: existingReward.nam,
            danh_hieu: existingReward.danh_hieu,
            nhan_bkbqp: existingReward.nhan_bkbqp,
            nhan_cstdtq: existingReward.nhan_cstdtq,
            nhan_bkttcp: existingReward.nhan_bkttcp,
          };
        }

        // Kiểm tra có đề xuất đang chờ hoặc đã duyệt cho năm này không
        const proposals = await prisma.bangDeXuat.findMany({
          where: {
            loai_de_xuat: 'CA_NHAN_HANG_NAM',
            nam: parseInt(nam),
            status: {
              in: ['PENDING', 'APPROVED'],
            },
          },
          select: {
            id: true,
            nam: true,
            status: true,
            data_danh_hieu: true,
          },
        });

        // Kiểm tra xem quân nhân có trong đề xuất nào không
        for (const proposal of proposals) {
          if (proposal.data_danh_hieu) {
            const dataList = Array.isArray(proposal.data_danh_hieu) ? proposal.data_danh_hieu : [];

            const found = dataList.some(
              item => String(item.personnel_id) === personnelIdStr && item.danh_hieu === danhHieu
            );

            if (found) {
              result.has_proposal = true;
              result.proposal = {
                id: proposal.id,
                nam: proposal.nam,
                status: proposal.status,
              };
              break;
            }
          }
        }

        results.push(result);
      }

      return {
        results,
        summary: {
          total: personnelIds.length,
          has_reward: results.filter(r => r.has_reward).length,
          has_proposal: results.filter(r => r.has_proposal).length,
          can_add: results.filter(r => !r.has_reward && !r.has_proposal).length,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm danh hiệu đồng loạt cho nhiều quân nhân
   */
  async bulkCreateAnnualRewards(data) {
    try {
      const {
        personnel_ids,
        personnel_rewards_data, // Mảng chứa thông tin riêng cho từng quân nhân
        nam,
        danh_hieu,
        ghi_chu,
        so_quyet_dinh, // Giữ lại để tương thích ngược
        cap_bac, // Giữ lại để tương thích ngược
        chuc_vu, // Giữ lại để tương thích ngược
      } = data;

      // Validate danh hiệu - mở rộng để hỗ trợ tất cả các loại
      const validDanhHieu = ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'];
      if (!validDanhHieu.includes(danh_hieu)) {
        throw new Error('Danh hiệu không hợp lệ. Danh hiệu hợp lệ: ' + validDanhHieu.join(', '));
      }

      const created = [];
      const errors = [];
      const skipped = [];

      // Tạo map từ personnel_rewards_data để tra cứu nhanh
      const personnelDataMap = {};
      if (personnel_rewards_data && Array.isArray(personnel_rewards_data)) {
        personnel_rewards_data.forEach(item => {
          if (item.personnel_id) {
            personnelDataMap[item.personnel_id] = item;
          }
        });
      }

      for (const personnelId of personnel_ids) {
        try {
          // Chuyển đổi personnelId sang string nếu cần
          const personnelIdStr = String(personnelId);

          if (!personnelIdStr) {
            errors.push({
              personnelId,
              error: 'ID quân nhân không hợp lệ',
            });
            continue;
          }

          // Lấy thông tin riêng cho quân nhân này (ưu tiên personnel_rewards_data)
          const personnelData = personnelDataMap[personnelIdStr] || {};
          const individualSoQuyetDinh = personnelData.so_quyet_dinh || so_quyet_dinh;
          const individualCapBac = personnelData.cap_bac || cap_bac;
          const individualChucVu = personnelData.chuc_vu || chuc_vu;

          // Kiểm tra quân nhân có tồn tại không
          const personnel = await prisma.quanNhan.findUnique({
            where: { id: personnelIdStr },
          });

          if (!personnel) {
            errors.push({
              personnelId,
              error: 'Quân nhân không tồn tại',
            });
            continue;
          }

          // Kiểm tra đã có danh hiệu cho năm này chưa
          const existingReward = await prisma.danhHieuHangNam.findFirst({
            where: {
              quan_nhan_id: personnelIdStr,
              nam: parseInt(nam),
            },
          });

          // Xử lý danh hiệu: CSTDCS/CSTT lưu vào trường danh_hieu, BKBQP/CSTDTQ/BKTTCP lưu vào boolean fields
          let finalDanhHieu = null;
          let nhanBKBQP = false;
          let nhanCSTDTQ = false;
          let nhanBKTTCP = false;

          if (danh_hieu === 'CSTDCS' || danh_hieu === 'CSTT') {
            finalDanhHieu = danh_hieu;
          } else if (danh_hieu === 'BKBQP') {
            nhanBKBQP = true;
          } else if (danh_hieu === 'CSTDTQ') {
            nhanCSTDTQ = true;
          } else if (danh_hieu === 'BKTTCP') {
            nhanBKTTCP = true;
          }

          let rewardRecord;

          if (existingReward) {
            // Nếu đã có bản ghi, cập nhật thêm các trường boolean nếu chọn BKBQP/CSTDTQ/BKTTCP
            if (danh_hieu === 'BKBQP' || danh_hieu === 'CSTDTQ' || danh_hieu === 'BKTTCP') {
              // Cập nhật các trường boolean
              const updateData = {};
              if (danh_hieu === 'BKBQP') {
                updateData.nhan_bkbqp = true;
              } else if (danh_hieu === 'CSTDTQ') {
                updateData.nhan_cstdtq = true;
              } else if (danh_hieu === 'BKTTCP') {
                updateData.nhan_bkttcp = true;
              }

              // Cập nhật các trường khác nếu có
              if (individualCapBac) updateData.cap_bac = individualCapBac;
              if (individualChucVu) updateData.chuc_vu = individualChucVu;
              if (individualSoQuyetDinh) updateData.so_quyet_dinh = individualSoQuyetDinh;
              if (ghi_chu) updateData.ghi_chu = ghi_chu;

              rewardRecord = await prisma.danhHieuHangNam.update({
                where: { id: existingReward.id },
                data: updateData,
              });
            } else {
              // Nếu chọn CSTDCS/CSTT mà đã có bản ghi thì bỏ qua
              skipped.push({
                personnelId,
                reason: `Đã có danh hiệu cho năm ${nam}`,
              });
              continue;
            }
          } else {
            // Tạo bản ghi mới
            console.log(
              `✅ [bulkCreateAnnualRewards] Tạo bản ghi mới cho quân nhân ${personnelIdStr}:`,
              {
                nam: parseInt(nam),
                danh_hieu: finalDanhHieu,
                cap_bac: individualCapBac,
                chuc_vu: individualChucVu,
                so_quyet_dinh: individualSoQuyetDinh,
              }
            );

            rewardRecord = await prisma.danhHieuHangNam.create({
              data: {
                quan_nhan_id: personnelIdStr,
                nam: parseInt(nam),
                danh_hieu: finalDanhHieu,
                cap_bac: individualCapBac || null,
                chuc_vu: individualChucVu || null,
                so_quyet_dinh: individualSoQuyetDinh || null,
                ghi_chu: ghi_chu || null,
                nhan_bkbqp: nhanBKBQP,
                nhan_cstdtq: nhanCSTDTQ,
                nhan_bkttcp: nhanBKTTCP,
              },
            });

            console.log(
              `✅ [bulkCreateAnnualRewards] Đã tạo thành công bản ghi ID: ${rewardRecord.id}`
            );
          }

          created.push(rewardRecord);
          console.log(
            `✅ [bulkCreateAnnualRewards] Đã thêm vào danh sách created. Tổng: ${created.length}`
          );

          // Tự động cập nhật lại hồ sơ hằng năm
          try {
            console.log(
              `🔄 [bulkCreateAnnualRewards] Bắt đầu tính toán lại hồ sơ cho quân nhân ${personnelIdStr}`
            );
            await profileService.recalculateAnnualProfile(personnelIdStr);
            console.log(
              `✅ [bulkCreateAnnualRewards] Đã tính toán lại hồ sơ thành công cho quân nhân ${personnelIdStr}`
            );
          } catch (recalcError) {
            console.error(
              `⚠️ [bulkCreateAnnualRewards] Failed to auto-recalculate annual profile for personnel ${personnelIdStr}:`,
              recalcError.message
            );
          }
        } catch (error) {
          errors.push({
            personnelId: personnelId || 'Chưa có ID quân nhân',
            error: error.message,
          });
        }
      }

      console.log(`📊 [bulkCreateAnnualRewards] Kết quả tổng hợp:`, {
        success: created.length,
        skipped: skipped.length,
        errors: errors.length,
        total: personnel_ids.length,
        createdIds: created.map(r => r.id),
      });

      return {
        success: created.length,
        skipped: skipped.length,
        errors: errors.length,
        details: {
          created,
          skipped,
          errors,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xuất file mẫu Excel để import
   */
  async exportTemplate(userRole = 'MANAGER') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh hiệu hằng năm');

    // Định nghĩa các cột - MANAGER chỉ có các trường cơ bản
    const columns = [
      { header: 'Họ và tên (*)', key: 'ho_ten', width: 25 },
      { header: 'Ngày sinh', key: 'ngay_sinh', width: 15 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 20 },
    ];

    // ADMIN có thêm các cột chi tiết
    if (userRole === 'ADMIN') {
      columns.push(
        { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
        { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 }
      );
    }

    worksheet.columns = columns;

    // Style cho header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Thêm hàng mẫu
    const sampleRow = {
      ho_ten: 'Nguyễn Văn A',
      ngay_sinh: '15/05/1990',
      nam: 2024,
      danh_hieu: 'CSTDCS',
    };

    if (userRole === 'ADMIN') {
      sampleRow.cap_bac = 'Thượng tá';
      sampleRow.chuc_vu = 'Phó Trưởng phòng';
      sampleRow.ghi_chu = 'Ghi chú mẫu';
      sampleRow.so_quyet_dinh = '123/QĐ-BQP';
    }

    worksheet.addRow(sampleRow);

    // Thêm ghi chú
    worksheet.addRow([]);
    worksheet.addRow(['Ghi chú:']);
    worksheet.addRow(['- Các cột có dấu (*) là bắt buộc']);
    worksheet.addRow(['- Danh hiệu hợp lệ: CSTDCS, CSTT, BKBQP, CSTDTQ']);
    worksheet.addRow(['- Năm phải là số nguyên dương']);
    worksheet.addRow([
      '- Ngày sinh dùng để phân biệt khi có nhiều người trùng tên (định dạng: DD/MM/YYYY)',
    ]);
    if (userRole === 'ADMIN') {
      worksheet.addRow(['- Số quyết định: Chỉ ADMIN mới có thể nhập']);
    }

    return workbook;
  }

  /**
   * Xuất danh sách khen thưởng ra Excel
   */
  async exportToExcel(filters = {}) {
    const { nam, danh_hieu, don_vi_id } = filters;

    const where = {};
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;

    // Lấy dữ liệu với quan hệ
    const awards = await prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
          },
        },
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: 10000,
    });

    // Filter theo đơn vị nếu có
    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        award =>
          award.QuanNhan?.co_quan_don_vi_id === don_vi_id ||
          award.QuanNhan?.don_vi_truc_thuoc_id === don_vi_id
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách khen thưởng');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 25 },
      { header: 'Số QĐ danh hiệu', key: 'so_quyet_dinh', width: 20 },
      { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'CSTĐTQ', key: 'nhan_cstdtq', width: 10 },
      { header: 'Số QĐ CSTĐTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
      { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
      { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Thêm dữ liệu
    filteredAwards.forEach((award, index) => {
      const donVi =
        award.QuanNhan?.DonViTrucThuoc?.ten_don_vi ||
        award.QuanNhan?.CoQuanDonVi?.ten_don_vi ||
        '';

      worksheet.addRow({
        stt: index + 1,
        cccd: award.QuanNhan?.cccd || '',
        ho_ten: award.QuanNhan?.ho_ten || '',
        don_vi: donVi,
        cap_bac: award.cap_bac || '',
        chuc_vu: award.chuc_vu || '',
        nam: award.nam,
        danh_hieu: award.danh_hieu || '',
        so_quyet_dinh: award.so_quyet_dinh || '',
        nhan_bkbqp: award.nhan_bkbqp ? 'Có' : '',
        so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp || '',
        nhan_cstdtq: award.nhan_cstdtq ? 'Có' : '',
        so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq || '',
        nhan_bkttcp: award.nhan_bkttcp ? 'Có' : '',
        so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp || '',
        ghi_chu: award.ghi_chu || '',
      });
    });

    return workbook;
  }

  /**
   * Thống kê khen thưởng theo danh hiệu và năm
   */
  async getStatistics(filters = {}) {
    const { nam, don_vi_id } = filters;

    const where = {};
    if (nam) where.nam = nam;

    const awards = await prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: {
          select: {
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });

    // Filter theo đơn vị nếu có
    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        award =>
          award.QuanNhan?.co_quan_don_vi_id === don_vi_id ||
          award.QuanNhan?.don_vi_truc_thuoc_id === don_vi_id
      );
    }

    // Thống kê theo danh hiệu
    const byDanhHieu = filteredAwards.reduce((acc, award) => {
      const key = award.danh_hieu;
      if (!acc[key]) {
        acc[key] = { danh_hieu: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    // Thống kê theo năm
    const byNam = filteredAwards.reduce((acc, award) => {
      const key = award.nam;
      if (!acc[key]) {
        acc[key] = { nam: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    return {
      total: filteredAwards.length,
      byDanhHieu: Object.values(byDanhHieu),
      byNam: Object.values(byNam).sort((a, b) => b.nam - a.nam),
    };
  }
}

module.exports = new AnnualRewardService();
