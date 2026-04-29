import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { positionRepository } from '../repositories/position.repository';
import { positionHistoryRepository } from '../repositories/positionHistory.repository';
import moment from 'moment';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import { calculateTenureMonthsWithDayPrecision } from '../helpers/serviceYearsHelper';

interface CreatePositionHistoryData {
  personnel_id: string;
  chuc_vu_id: string;
  ngay_bat_dau: string | Date;
  ngay_ket_thuc?: string | Date | null;
  he_so_chuc_vu?: number;
}

interface UpdatePositionHistoryData {
  chuc_vu_id?: string;
  ngay_bat_dau?: string | Date;
  ngay_ket_thuc?: string | Date | null;
  he_so_chuc_vu?: number;
}

interface OverlapWarning {
  message: string;
  suggestedEndDate: string;
  nextPositionStartDate: string;
}

class PositionHistoryService {
  isOverlapping(
    start1: moment.Moment | Date | string,
    end1: moment.Moment | Date | string | null,
    start2: moment.Moment | Date | string,
    end2: moment.Moment | Date | string | null
  ): boolean {
    const mStart1 = moment(start1);
    const mStart2 = moment(start2);
    const mEnd1 = end1 ? moment(end1) : null;
    const mEnd2 = end2 ? moment(end2) : null;

    if (!mEnd1 && !mEnd2) {
      return true;
    }

    if (!mEnd1) {
      if (!mEnd2) {
        return true;
      }
      // [start1, ∞) vs [start2, end2]: overlap when end2 >= start1
      return mEnd2.isSameOrAfter(mStart1);
    }

    if (!mEnd2) {
      return mStart2.isSameOrBefore(mEnd1);
    }

    return mStart1.isBefore(mEnd2) && mStart2.isBefore(mEnd1);
  }

  async getPositionHistory(personnelId: string) {
    if (!personnelId) {
      throw new ValidationError('Personnel ID is required');
    }

    const personnel = await quanNhanRepository.findIdById(personnelId);

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const history = await positionHistoryRepository.findManyRaw({
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

    const today = new Date();
    const updatedHistory = history.map(item => {
      if (!item.ngay_ket_thuc) {
        const ngayBatDau = new Date(item.ngay_bat_dau);
        const soThang = calculateTenureMonthsWithDayPrecision(ngayBatDau, today);

        return {
          ...item,
          so_thang: soThang,
        };
      }
      return item;
    });

    return updatedHistory;
  }

  async createPositionHistory(data: CreatePositionHistoryData) {
    if (!data) {
      throw new ValidationError('Dữ liệu không hợp lệ');
    }

    const { personnel_id, chuc_vu_id, ngay_bat_dau, ngay_ket_thuc, he_so_chuc_vu } = data;

    if (!personnel_id) {
      throw new ValidationError('ID quân nhân là bắt buộc');
    }

    if (!chuc_vu_id) {
      throw new ValidationError('ID chức vụ là bắt buộc');
    }

    if (!ngay_bat_dau) {
      throw new ValidationError('Ngày bắt đầu là bắt buộc');
    }

    if (ngay_ket_thuc) {
      const dateBatDau = moment(ngay_bat_dau);
      const dateKetThuc = moment(ngay_ket_thuc);

      if (dateBatDau.isAfter(dateKetThuc) || dateBatDau.isSame(dateKetThuc)) {
        throw new ValidationError('Ngày bắt đầu phải trước ngày kết thúc');
      }
    }

    const personnel = await quanNhanRepository.findIdById(personnel_id);

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const position = await positionRepository.findUniqueRaw({
      where: { id: chuc_vu_id },
      select: { he_so_chuc_vu: true },
    });

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }

    const existingHistory = await positionHistoryRepository.findManyRaw({
      where: { quan_nhan_id: personnel_id },
      select: {
        id: true,
        ngay_bat_dau: true,
        ngay_ket_thuc: true,
      },
    });

    const ngayBatDauMoment = moment(ngay_bat_dau);
    const ngayKetThucMoment = ngay_ket_thuc ? moment(ngay_ket_thuc) : null;
    for (const existing of existingHistory) {
      const existingStart = moment(existing.ngay_bat_dau);
      const existingEnd = existing.ngay_ket_thuc ? moment(existing.ngay_ket_thuc) : null;
      if (this.isOverlapping(existingStart, existingEnd, ngayBatDauMoment, ngayKetThucMoment)) {
        const existingEndStr = existingEnd ? existingEnd.format('DD/MM/YYYY') : 'hiện tại';
        throw new AppError(
          `Khoảng thời gian đảm nhiệm chức vụ trùng lặp với chức vụ khác (${existingStart.format(
            'DD/MM/YYYY'
          )} - ${existingEndStr}). Vui lòng chọn khoảng thời gian không trùng lặp.`,
          409
        );
      }
    }

    const finalHeSoChucVu =
      he_so_chuc_vu !== undefined ? he_so_chuc_vu : Number(position.he_so_chuc_vu) || 0;

    const ngayBatDauDate = new Date(ngay_bat_dau);
    let soThang: number | null = null;
    if (ngay_ket_thuc) {
      const ngayKetThucDate = new Date(ngay_ket_thuc);
      soThang = calculateTenureMonthsWithDayPrecision(ngayBatDauDate, ngayKetThucDate);
    }

    const newHistory = await positionHistoryRepository.createRaw({
      data: {
        quan_nhan_id: personnel_id,
        chuc_vu_id,
        he_so_chuc_vu: finalHeSoChucVu,
        ngay_bat_dau: ngayBatDauDate,
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
  }

  async updatePositionHistory(id: string, data: UpdatePositionHistoryData) {
    if (!id) {
      throw new ValidationError('ID lịch sử chức vụ là bắt buộc');
    }

    const { chuc_vu_id, ngay_bat_dau, ngay_ket_thuc, he_so_chuc_vu } = data || {};

    const history = await positionHistoryRepository.findUniqueRaw({
      where: { id },
    });

    if (!history) {
      throw new NotFoundError('Lịch sử chức vụ');
    }

    const isCurrentPosition = !history.ngay_ket_thuc;
    if (isCurrentPosition && chuc_vu_id && chuc_vu_id !== history.chuc_vu_id) {
      throw new ValidationError(
        'Không được phép sửa chức vụ đảm nhận của chức vụ hiện tại. Chức vụ hiện tại chỉ có thể được sửa ở mục "Cập nhật thông tin cá nhân".'
      );
    }

    let heSoChucVu = he_so_chuc_vu !== undefined ? he_so_chuc_vu : history.he_so_chuc_vu;
    if (chuc_vu_id && he_so_chuc_vu === undefined && !isCurrentPosition) {
      const position = await positionRepository.findUniqueRaw({
        where: { id: chuc_vu_id },
        select: { he_so_chuc_vu: true },
      });

      if (!position) {
        throw new NotFoundError('Chức vụ');
      }
      heSoChucVu = Number(position.he_so_chuc_vu) || 0;
    }

    const ngayBatDauFinal = ngay_bat_dau ? new Date(ngay_bat_dau) : history.ngay_bat_dau;

    const isRemovingEndDate = ngay_ket_thuc === null || ngay_ket_thuc === undefined;

    const ngayKetThucFinal: Date | null =
      ngay_ket_thuc !== undefined
        ? ngay_ket_thuc
          ? new Date(ngay_ket_thuc)
          : null
        : history.ngay_ket_thuc;

    if (ngayBatDauFinal && ngayKetThucFinal) {
      const dateBatDau = moment(ngayBatDauFinal);
      const dateKetThuc = moment(ngayKetThucFinal);

      if (dateBatDau.isAfter(dateKetThuc) || dateBatDau.isSame(dateKetThuc)) {
        throw new ValidationError('Ngày bắt đầu phải trước ngày kết thúc');
      }
    }

    const existingHistory = await positionHistoryRepository.findManyRaw({
      where: {
        quan_nhan_id: history.quan_nhan_id,
        id: { not: id },
      },
      select: {
        id: true,
        ngay_bat_dau: true,
        ngay_ket_thuc: true,
      },
    });

    const wasFinished = history.ngay_ket_thuc !== null;
    let warning: OverlapWarning | null = null;

    if (isRemovingEndDate && wasFinished) {
      const ngayBatDauMomentLocal = moment(ngayBatDauFinal);

      const laterPositions = existingHistory
        .filter(h => {
          const hStart = moment(h.ngay_bat_dau);
          return hStart.isAfter(ngayBatDauMomentLocal);
        })
        .sort((a, b) => moment(a.ngay_bat_dau).diff(moment(b.ngay_bat_dau)));

      if (laterPositions.length > 0) {
        const nextPosition = laterPositions[0];
        const nextStartDate = moment(nextPosition.ngay_bat_dau);

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

    const ngayBatDauMoment = moment(ngayBatDauFinal);
    const ngayKetThucMoment = ngayKetThucFinal ? moment(ngayKetThucFinal) : null;
    for (const existing of existingHistory) {
      const existingStart = moment(existing.ngay_bat_dau);
      const existingEnd = existing.ngay_ket_thuc ? moment(existing.ngay_ket_thuc) : null;
      if (this.isOverlapping(existingStart, existingEnd, ngayBatDauMoment, ngayKetThucMoment)) {
        const existingEndStr = existingEnd ? existingEnd.format('DD/MM/YYYY') : 'hiện tại';
        throw new AppError(
          `Khoảng thời gian đảm nhiệm chức vụ trùng lặp với chức vụ khác (${existingStart.format(
            'DD/MM/YYYY'
          )} - ${existingEndStr}). Vui lòng điều chỉnh ngày bắt đầu/kết thúc để không bị chồng lấn.`,
          409
        );
      }
    }

    let soThang = history.so_thang;
    if (ngayBatDauFinal && ngayKetThucFinal) {
      soThang = calculateTenureMonthsWithDayPrecision(ngayBatDauFinal, ngayKetThucFinal);
    } else if (!ngayKetThucFinal) {
      soThang = null;
    }

    const updateData: Record<string, unknown> = {
      he_so_chuc_vu: heSoChucVu,
      ngay_bat_dau: ngayBatDauFinal,
      ngay_ket_thuc: ngayKetThucFinal,
      so_thang: soThang,
    };

    if (!isCurrentPosition && chuc_vu_id) {
      updateData.chuc_vu_id = chuc_vu_id;
    }

    const updatedHistory = await positionHistoryRepository.updateRaw({
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

    return {
      data: updatedHistory,
      warning: warning,
    };
  }

  async deletePositionHistory(id: string) {
    const history = await positionHistoryRepository.findUniqueRaw({
      where: { id },
    });

    if (!history) {
      throw new NotFoundError('Lịch sử chức vụ');
    }

    await positionHistoryRepository.delete(id);

    return { message: 'Xóa lịch sử chức vụ thành công', quan_nhan_id: history.quan_nhan_id };
  }
}

export default new PositionHistoryService();
