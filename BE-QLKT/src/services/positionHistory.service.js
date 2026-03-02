const { prisma } = require('../models');
const moment = require('moment');

class PositionHistoryService {
  /**
   * Kiểm tra xem hai khoảng thời gian có chồng chéo không
   * @param {Date|string} start1 - Ngày bắt đầu khoảng 1 (chức vụ cũ)
   * @param {Date|string|null} end1 - Ngày kết thúc khoảng 1 (null = chưa kết thúc, kéo dài đến vô cùng)
   * @param {Date|string} start2 - Ngày bắt đầu khoảng 2 (chức vụ mới)
   * @param {Date|string|null} end2 - Ngày kết thúc khoảng 2 (null = chưa kết thúc, kéo dài đến vô cùng)
   * @returns {boolean} true nếu chồng chéo, false nếu không
   */
  isOverlapping(start1, end1, start2, end2) {
    const mStart1 = moment(start1);
    const mStart2 = moment(start2);
    const mEnd1 = end1 ? moment(end1) : null;
    const mEnd2 = end2 ? moment(end2) : null;

    // Nếu cả hai đều chưa kết thúc, thì chồng chéo (cả hai đều kéo dài đến vô cùng)
    if (!mEnd1 && !mEnd2) {
      return true;
    }

    // Nếu khoảng 1 chưa kết thúc (kéo dài đến vô cùng: [start1, +∞))
    if (!mEnd1) {
      // Nếu khoảng 2 cũng chưa kết thúc, thì chồng chéo
      if (!mEnd2) {
        return true;
      }
      // Khoảng 1: [start1, +∞), Khoảng 2: [start2, end2]
      // Chồng chéo nếu khoảng 2 bắt đầu trong khoảng 1 (start2 >= start1)
      return mStart2.isSameOrAfter(mStart1);
    }

    // Nếu khoảng 2 chưa kết thúc (kéo dài đến vô cùng: [start2, +∞))
    if (!mEnd2) {
      // Khoảng 1: [start1, end1], Khoảng 2: [start2, +∞)
      // Chồng chéo nếu khoảng 2 bắt đầu trước hoặc cùng lúc với khi khoảng 1 kết thúc
      // Tức là: start2 <= end1
      return mStart2.isSameOrBefore(mEnd1);
    }

    // Cả hai đều có ngày kết thúc - kiểm tra overlap chuẩn
    // Hai khoảng [start1, end1] và [start2, end2] chồng chéo khi:
    // start1 < end2 && start2 < end1
    // (không cho phép tiếp nối ngay, phải có khoảng cách)
    return mStart1.isBefore(mEnd2) && mStart2.isBefore(mEnd1);
  }
  async getPositionHistory(personnelId) {
    try {
      if (!personnelId) {
        throw new Error('personnel_id là bắt buộc');
      }

      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      const history = await prisma.lichSuChucVu.findMany({
        where: { quan_nhan_id: personnelId },
        include: {
          ChucVu: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
            },
          },
        },
        orderBy: { ngay_bat_dau: 'desc' },
      });

      // Tính số tháng tự động cho chức vụ hiện tại (chưa có ngày kết thúc)
      const today = new Date();
      const updatedHistory = history.map(item => {
        if (!item.ngay_ket_thuc) {
          // Chức vụ hiện tại - tính số tháng từ ngày bắt đầu đến hôm nay
          const ngayBatDau = new Date(item.ngay_bat_dau);
          let months = (today.getFullYear() - ngayBatDau.getFullYear()) * 12;
          months += today.getMonth() - ngayBatDau.getMonth();
          // Nếu ngày hôm nay < ngày bắt đầu trong tháng thì trừ 1 tháng
          if (today.getDate() < ngayBatDau.getDate()) {
            months--;
          }
          const soThang = Math.max(0, months);

          return {
            ...item,
            so_thang: soThang, // Cập nhật số tháng tính tự động
          };
        }
        return item;
      });

      return updatedHistory;
    } catch (error) {
      throw error;
    }
  }

  async createPositionHistory(data) {
    try {
      if (!data) {
        throw new Error('Dữ liệu không hợp lệ');
      }

      const { personnel_id, chuc_vu_id, ngay_bat_dau, ngay_ket_thuc, he_so_chuc_vu } = data || {};

      // Validate các trường bắt buộc
      if (!personnel_id) {
        throw new Error('ID quân nhân là bắt buộc');
      }

      if (!chuc_vu_id) {
        throw new Error('ID chức vụ là bắt buộc');
      }

      // Validate ngày bắt đầu
      if (!ngay_bat_dau) {
        throw new Error('Ngày bắt đầu là bắt buộc');
      }

      // Validate ngày bắt đầu và ngày kết thúc
      if (ngay_ket_thuc) {
        const dateBatDau = moment(ngay_bat_dau);
        const dateKetThuc = moment(ngay_ket_thuc);

        // So sánh ngày bắt đầu phải trước ngày kết thúc
        if (dateBatDau.isAfter(dateKetThuc) || dateBatDau.isSame(dateKetThuc)) {
          throw new Error('Ngày bắt đầu phải trước ngày kết thúc');
        }
      }

      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnel_id },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      const position = await prisma.chucVu.findUnique({
        where: { id: chuc_vu_id },
        select: { he_so_chuc_vu: true },
      });

      if (!position) {
        throw new Error('Chức vụ không tồn tại');
      }

      // Lấy tất cả lịch sử chức vụ của quân nhân để kiểm tra validation
      const existingHistory = await prisma.lichSuChucVu.findMany({
        where: { quan_nhan_id: personnel_id },
        select: {
          id: true,
          ngay_bat_dau: true,
          ngay_ket_thuc: true,
        },
      });

      // Kiểm tra: Chỉ chặn tạo chức vụ mới chưa kết thúc nếu đã có chức vụ chưa kết thúc
      // Cho phép tạo chức vụ cũ (có ngày kết thúc) ngay cả khi có chức vụ chưa kết thúc
      const hasUnfinishedPosition = existingHistory.some(h => !h.ngay_ket_thuc);
      if (hasUnfinishedPosition && !ngay_ket_thuc) {
        const unfinishedPosition = existingHistory.find(h => !h.ngay_ket_thuc);
        const unfinishedStart = moment(unfinishedPosition.ngay_bat_dau).format('DD/MM/YYYY');
        throw new Error(
          `Đã có chức vụ chưa kết thúc (bắt đầu từ ${unfinishedStart}). Vui lòng kết thúc chức vụ hiện tại trước khi tạo chức vụ mới chưa kết thúc.`
        );
      }

      // Kiểm tra: Không cho phép thời gian chồng chéo
      const ngayBatDauMoment = moment(ngay_bat_dau);
      const ngayKetThucMoment = ngay_ket_thuc ? moment(ngay_ket_thuc) : null;

      for (const existing of existingHistory) {
        const existingStart = moment(existing.ngay_bat_dau);
        const existingEnd = existing.ngay_ket_thuc ? moment(existing.ngay_ket_thuc) : null;

        if (this.isOverlapping(existingStart, existingEnd, ngayBatDauMoment, ngayKetThucMoment)) {
          const existingEndStr = existingEnd ? existingEnd.format('DD/MM/YYYY') : 'hiện tại';
          const newEndStr = ngayKetThucMoment
            ? ngayKetThucMoment.format('DD/MM/YYYY')
            : 'chưa kết thúc';
          throw new Error(
            `Khoảng thời gian đảm nhiệm chức vụ trùng lặp với chức vụ khác (${existingStart.format(
              'DD/MM/YYYY'
            )} - ${existingEndStr}). Vui lòng chọn khoảng thời gian không trùng lặp.`
          );
        }
      }

      // Sử dụng he_so_chuc_vu từ request nếu có, nếu không thì lấy từ chức vụ (hệ số chức vụ)
      const finalHeSoChucVu =
        he_so_chuc_vu !== undefined ? he_so_chuc_vu : position.he_so_chuc_vu || 0;

      // Tính số tháng từ ngày bắt đầu và ngày kết thúc
      const ngayBatDau = new Date(ngay_bat_dau);
      let soThang = null;
      if (ngay_ket_thuc) {
        const ngayKetThuc = new Date(ngay_ket_thuc);
        // Tính số tháng giữ chức vụ (tính tới tháng)
        let months = (ngayKetThuc.getFullYear() - ngayBatDau.getFullYear()) * 12;
        months += ngayKetThuc.getMonth() - ngayBatDau.getMonth();
        // Nếu ngày kết thúc < ngày bắt đầu trong tháng thì trừ 1 tháng
        if (ngayKetThuc.getDate() < ngayBatDau.getDate()) {
          months--;
        }
        soThang = Math.max(0, months); // Đảm bảo không âm
      }

      const newHistory = await prisma.lichSuChucVu.create({
        data: {
          quan_nhan_id: personnel_id,
          chuc_vu_id,
          he_so_chuc_vu: finalHeSoChucVu,
          ngay_bat_dau: ngayBatDau,
          ngay_ket_thuc: ngay_ket_thuc ? new Date(ngay_ket_thuc) : null,
          so_thang: soThang,
        },
        include: {
          QuanNhan: {
            select: {
              ho_ten: true,
            },
          },
          ChucVu: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
            },
          },
        },
      });

      return newHistory;
    } catch (error) {
      throw error;
    }
  }

  async updatePositionHistory(id, data) {
    try {
      if (!id) {
        throw new Error('ID lịch sử chức vụ là bắt buộc');
      }

      const { chuc_vu_id, ngay_bat_dau, ngay_ket_thuc, he_so_chuc_vu } = data || {};

      const history = await prisma.lichSuChucVu.findUnique({
        where: { id },
      });

      if (!history) {
        throw new Error('Lịch sử chức vụ không tồn tại');
      }

      // Kiểm tra: Nếu là chức vụ hiện tại (chưa có ngày kết thúc), không cho phép sửa chức vụ đảm nhận
      const isCurrentPosition = !history.ngay_ket_thuc;
      if (isCurrentPosition && chuc_vu_id && chuc_vu_id !== history.chuc_vu_id) {
        throw new Error(
          'Không được phép sửa chức vụ đảm nhận của chức vụ hiện tại. Chức vụ hiện tại chỉ có thể được sửa ở mục "Cập nhật thông tin cá nhân".'
        );
      }

      // Ưu tiên he_so_chuc_vu từ request, nếu không có thì lấy từ chức vụ hoặc giữ nguyên (hệ số chức vụ)
      let heSoChucVu = he_so_chuc_vu !== undefined ? he_so_chuc_vu : history.he_so_chuc_vu;
      // Chỉ cập nhật hệ số chức vụ từ chức vụ mới nếu đang sửa chức vụ cũ (có ngày kết thúc)
      if (chuc_vu_id && he_so_chuc_vu === undefined && !isCurrentPosition) {
        const position = await prisma.chucVu.findUnique({
          where: { id: chuc_vu_id },
          select: { he_so_chuc_vu: true },
        });

        if (!position) {
          throw new Error('Chức vụ không tồn tại');
        }
        // Cập nhật hệ số chức vụ nếu đổi chức vụ và không có he_so_chuc_vu từ request
        heSoChucVu = position.he_so_chuc_vu || 0;
      }

      // Tính số tháng từ ngày bắt đầu và ngày kết thúc
      const ngayBatDauFinal = ngay_bat_dau ? new Date(ngay_bat_dau) : history.ngay_bat_dau;

      // Kiểm tra xem có đang xóa ngày kết thúc không
      // ngay_ket_thuc === null hoặc undefined nghĩa là người dùng đã xóa (clear) ngày kết thúc
      const isRemovingEndDate = ngay_ket_thuc === null || ngay_ket_thuc === undefined;

      const ngayKetThucFinal =
        ngay_ket_thuc !== undefined
          ? ngay_ket_thuc
            ? new Date(ngay_ket_thuc)
            : null
          : history.ngay_ket_thuc;

      // Validate ngày bắt đầu và ngày kết thúc
      if (ngayBatDauFinal && ngayKetThucFinal) {
        const dateBatDau = moment(ngayBatDauFinal);
        const dateKetThuc = moment(ngayKetThucFinal);

        // So sánh ngày bắt đầu phải trước ngày kết thúc
        if (dateBatDau.isAfter(dateKetThuc) || dateBatDau.isSame(dateKetThuc)) {
          throw new Error('Ngày bắt đầu phải trước ngày kết thúc');
        }
      }

      // Lấy tất cả lịch sử chức vụ khác (trừ chức vụ đang cập nhật) để kiểm tra validation
      const existingHistory = await prisma.lichSuChucVu.findMany({
        where: {
          quan_nhan_id: history.quan_nhan_id,
          id: { not: id }, // Loại trừ chức vụ đang cập nhật
        },
        select: {
          id: true,
          ngay_bat_dau: true,
          ngay_ket_thuc: true,
        },
      });

      // Cho phép chỉnh sửa tất cả chức vụ (kể cả chức vụ chưa kết thúc)
      // Validation chồng chéo thời gian sẽ được kiểm tra ở phần dưới

      // Kiểm tra: Nếu xóa ngày kết thúc (cập nhật thành chưa kết thúc)
      // và có chức vụ khác bắt đầu sau đó, đề xuất set ngày kết thúc
      const wasFinished = history.ngay_ket_thuc !== null;
      let warning = null;

      if (isRemovingEndDate && wasFinished) {
        const ngayBatDauMoment = moment(ngayBatDauFinal);

        // Tìm chức vụ bắt đầu sớm nhất sau ngày bắt đầu của chức vụ này
        const laterPositions = existingHistory
          .filter(h => {
            const hStart = moment(h.ngay_bat_dau);
            return hStart.isAfter(ngayBatDauMoment);
          })
          .sort((a, b) => moment(a.ngay_bat_dau).diff(moment(b.ngay_bat_dau)));

        if (laterPositions.length > 0) {
          const nextPosition = laterPositions[0];
          const nextStartDate = moment(nextPosition.ngay_bat_dau);

          // Đề xuất set ngày kết thúc = ngày bắt đầu của chức vụ tiếp theo
          // Trừ đi 1 ngày để không chồng chéo
          const suggestedEndDate = nextStartDate.clone().subtract(1, 'day');

          warning = {
            message: `Có chức vụ khác bắt đầu từ ${nextStartDate.format(
              'DD/MM/YYYY'
            )}. Bạn có muốn đặt ngày kết thúc là ${suggestedEndDate.format('DD/MM/YYYY')} không?`,
            suggestedEndDate: suggestedEndDate.format('YYYY-MM-DD'),
            nextPositionStartDate: nextStartDate.format('YYYY-MM-DD'),
          };
        }
      }

      // Kiểm tra: Không cho phép thời gian chồng chéo
      const ngayBatDauMoment = moment(ngayBatDauFinal);
      const ngayKetThucMoment = ngayKetThucFinal ? moment(ngayKetThucFinal) : null;

      for (const existing of existingHistory) {
        const existingStart = moment(existing.ngay_bat_dau);
        const existingEnd = existing.ngay_ket_thuc ? moment(existing.ngay_ket_thuc) : null;

        if (this.isOverlapping(existingStart, existingEnd, ngayBatDauMoment, ngayKetThucMoment)) {
          const existingEndStr = existingEnd ? existingEnd.format('DD/MM/YYYY') : 'hiện tại';
          const newEndStr = ngayKetThucMoment
            ? ngayKetThucMoment.format('DD/MM/YYYY')
            : 'chưa kết thúc';
          throw new Error(
            `Khoảng thời gian đảm nhiệm chức vụ trùng lặp với chức vụ khác (${existingStart.format(
              'DD/MM/YYYY'
            )} - ${existingEndStr}). Vui lòng chọn khoảng thời gian không trùng lặp.`
          );
        }
      }

      // Tính số tháng giữ chức vụ (chỉ tính khi có đầy đủ ngày bắt đầu và ngày kết thúc)
      let soThang = history.so_thang; // Giữ nguyên số tháng cũ nếu không có đủ thông tin
      if (ngayBatDauFinal && ngayKetThucFinal) {
        let months = (ngayKetThucFinal.getFullYear() - ngayBatDauFinal.getFullYear()) * 12;
        months += ngayKetThucFinal.getMonth() - ngayBatDauFinal.getMonth();
        // Nếu ngày kết thúc < ngày bắt đầu trong tháng thì trừ 1 tháng
        if (ngayKetThucFinal.getDate() < ngayBatDauFinal.getDate()) {
          months--;
        }
        soThang = Math.max(0, months); // Đảm bảo không âm
      } else if (!ngayKetThucFinal) {
        // Nếu không có ngày kết thúc (chức vụ đang giữ), số tháng = null
        soThang = null;
      }

      // Chỉ cập nhật chuc_vu_id nếu không phải là chức vụ hiện tại
      const updateData = {
        he_so_chuc_vu: heSoChucVu,
        ngay_bat_dau: ngayBatDauFinal,
        ngay_ket_thuc: ngayKetThucFinal,
        so_thang: soThang,
      };

      // Chỉ cập nhật chuc_vu_id nếu không phải là chức vụ hiện tại
      if (!isCurrentPosition && chuc_vu_id) {
        updateData.chuc_vu_id = chuc_vu_id;
      }

      const updatedHistory = await prisma.lichSuChucVu.update({
        where: { id },
        data: updateData,
        include: {
          QuanNhan: {
            select: {
              ho_ten: true,
            },
          },
          ChucVu: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
            },
          },
        },
      });

      // Trả về kết quả kèm warning nếu có
      return {
        data: updatedHistory,
        warning: warning,
      };
    } catch (error) {
      throw error;
    }
  }

  async deletePositionHistory(id) {
    try {
      const history = await prisma.lichSuChucVu.findUnique({
        where: { id },
      });

      if (!history) {
        throw new Error('Lịch sử chức vụ không tồn tại');
      }

      await prisma.lichSuChucVu.delete({
        where: { id },
      });

      return { message: 'Xóa lịch sử chức vụ thành công' };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new PositionHistoryService();
