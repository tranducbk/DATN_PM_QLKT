import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { checkDuplicateUnitAward } from '../helpers/awardValidation';
import { getDanhHieuName } from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { parseHeaderMap, getHeaderCol, parseBooleanValue } from '../helpers/excelHelper';

class UnitAnnualAwardService {
  /**
   * Tính số năm liên tục được danh hiệu DVQT (Đơn vị Quyết thắng)
   * Quy ước: có bản ghi DanhHieuDonViHangNam năm X với danh_hieu = "ĐVQT" thì được tính là đạt danh hiệu năm đó
   */
  async calculateContinuousYears(donViId, year) {
    // Check awarded records (danh hieu) in DanhHieuDonViHangNam table
    const records = await prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: { lte: year - 1 },
        danh_hieu: 'ĐVQT',
      },
      orderBy: { nam: 'desc' },
      select: { nam: true, danh_hieu: true },
    });

    let continuous = 0;
    let current = year - 1;
    for (const r of records) {
      if (r.nam !== current) break;
      continuous += 1;
      current -= 1;
    }
    return continuous;
  }

  async calculateBKBQPContinuous(donViId, year) {
    // Check awarded records (nhan_bkbqp) in DanhHieuDonViHangNam table
    const records = await prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: { lte: year - 1 },
        nhan_bkbqp: true,
      },
      orderBy: { nam: 'desc' },
      select: { nam: true, danh_hieu: true },
    });
    let continuous = 0;
    let current = year - 1;
    for (const r of records) {
      if (r.nam !== current) break;
      continuous += 1;
      current -= 2;
    }
    return continuous;
  }

  /**
   * Tính tổng số lần đơn vị đạt danh hiệu DVQT
   */
  async calculateTotalDVQT(donViId, year) {
    const records = await prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: { lte: year },
        status: PROPOSAL_STATUS.APPROVED,
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

    // Chỉ lưu ĐVQT và ĐVTT trong JSON, BKBQP và BKTTCP là trường đánh dấu boolean
    // Tương tự như cá nhân: chỉ lưu CSTDCS và CSTT, BKBQP và CSTDTQ là boolean
    const validRecords = records.filter(
      r => r.danh_hieu && (r.danh_hieu === 'ĐVQT' || r.danh_hieu === 'ĐVTT')
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

  buildSuggestion(dvqtLienTuc, hasDecision) {
    if (hasDecision) return null;
    if (dvqtLienTuc >= 5) {
      return 'Đủ điều kiện đề xuất Bằng khen Thủ tướng Chính phủ (5 năm liên tục DVQT).';
    }
    if (dvqtLienTuc >= 3) {
      return 'Đủ điều kiện đề xuất Bằng khen Tổng cục (3 năm liên tục DVQT).';
    }
    return null;
  }

  /**
   * Kiểm tra điều kiện khen thưởng chuỗi cho đơn vị
   * @param {string} donViId - ID đơn vị
   * @param {number} year - Năm cần kiểm tra
   * @param {string} danhHieu - BKBQP hoặc BKTTCP
   * @returns {Object} { eligible: boolean, reason: string }
   */
  async checkUnitAwardEligibility(donViId, year, danhHieu) {
    if (!['BKBQP', 'BKTTCP'].includes(danhHieu)) {
      return { eligible: true, reason: '' };
    }

    const dvqtLienTuc = await this.calculateContinuousYears(donViId, year);
    const bkbqpLienTuc = await this.calculateBKBQPContinuous(donViId, year);

    if (danhHieu === 'BKBQP') {
      const eligible = dvqtLienTuc % 2 === 0 && dvqtLienTuc >= 1;
      if (!eligible) {
        return {
          eligible: false,
          reason: `Chưa đủ điều kiện BKBQP: cần 2 năm ĐVQT liên tục (hiện có ${dvqtLienTuc} năm ĐVQT liên tục)`,
        };
      }
      return { eligible: true, reason: 'Đủ điều kiện BKBQP' };
    }

    if (danhHieu === 'BKTTCP') {
      const eligible =
        dvqtLienTuc % 7 === 0 && bkbqpLienTuc % 3 === 0 && dvqtLienTuc >= 7 && bkbqpLienTuc >= 3;
      if (!eligible) {
        return {
          eligible: false,
          reason: `Chưa đủ điều kiện BKTTCP: cần 7 năm ĐVQT + 3 lần BKBQP liên tục (hiện có ${dvqtLienTuc} năm ĐVQT, ${bkbqpLienTuc} lần BKBQP)`,
        };
      }
      return { eligible: true, reason: 'Đủ điều kiện BKTTCP' };
    }

    return { eligible: true, reason: '' };
  }

  /** Manager đề xuất (status=PENDING) - Tạo bản ghi DanhHieuDonViHangNam */
  async propose({ don_vi_id, nam, danh_hieu, ghi_chu, nguoi_tao_id }) {
    const year = Number(nam);
    const unitId = don_vi_id;

    // Xác định xem đơn vị là CoQuanDonVi hay DonViTrucThuoc
    const coQuanDonVi = await prisma.coQuanDonVi.findUnique({ where: { id: unitId } });
    const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({ where: { id: unitId } });

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new Error('Không tìm thấy đơn vị');
    }

    const isCoQuanDonVi = !!coQuanDonVi;

    // Tạo bản ghi DanhHieuDonViHangNam với status PENDING
    const whereCondition = isCoQuanDonVi
      ? { co_quan_don_vi_id: unitId, nam: year }
      : { don_vi_truc_thuoc_id: unitId, nam: year };

    const record = await prisma.danhHieuDonViHangNam.upsert({
      where: isCoQuanDonVi
        ? { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } }
        : { unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: unitId, nam: year } },
      update: {
        danh_hieu: danh_hieu || null,
        ghi_chu: ghi_chu || null,
        status: PROPOSAL_STATUS.PENDING,
      },
      create: {
        co_quan_don_vi_id: isCoQuanDonVi ? unitId : null,
        don_vi_truc_thuoc_id: isCoQuanDonVi ? null : unitId,
        nam: year,
        danh_hieu: danh_hieu || null,
        ghi_chu: ghi_chu || null,
        nguoi_tao_id: nguoi_tao_id,
        status: PROPOSAL_STATUS.PENDING,
      },
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    // Cập nhật hoặc tạo HoSoDonViHangNam để theo dõi thống kê
    await this.recalculateAnnualUnit(unitId, year);

    return record;
  }

  /** Admin duyệt danh hiệu */
  async approve(
    id,
    {
      so_quyet_dinh,
      file_quyet_dinh,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      file_quyet_dinh_bkbqp,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
      file_quyet_dinh_bkttcp,
      nguoi_duyet_id,
    }
  ) {
    const updateData: Record<string, any> = {
      status: PROPOSAL_STATUS.APPROVED,
      nguoi_duyet_id: nguoi_duyet_id,
      ngay_duyet: new Date(),
      so_quyet_dinh: so_quyet_dinh || null,
    };

    // Xử lý BKBQP nếu có
    if (nhan_bkbqp !== undefined) {
      updateData.nhan_bkbqp = nhan_bkbqp;
    }
    if (so_quyet_dinh_bkbqp !== undefined) {
      updateData.so_quyet_dinh_bkbqp = so_quyet_dinh_bkbqp || null;
    }
    if (file_quyet_dinh_bkbqp !== undefined) {
      updateData.file_quyet_dinh_bkbqp = file_quyet_dinh_bkbqp || null;
    }

    // Xử lý BKTTCP nếu có
    if (nhan_bkttcp !== undefined) {
      updateData.nhan_bkttcp = nhan_bkttcp;
    }
    if (so_quyet_dinh_bkttcp !== undefined) {
      updateData.so_quyet_dinh_bkttcp = so_quyet_dinh_bkttcp || null;
    }
    if (file_quyet_dinh_bkttcp !== undefined) {
      updateData.file_quyet_dinh_bkttcp = file_quyet_dinh_bkttcp || null;
    }

    // Update DanhHieuDonViHangNam status to APPROVED
    const updatedDanhHieu = await prisma.danhHieuDonViHangNam.update({
      where: { id: String(id) },
      data: updateData,
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    // Tự động recalculate toàn bộ hồ sơ hằng năm của đơn vị (giống profileService)
    const donViId = updatedDanhHieu.co_quan_don_vi_id || updatedDanhHieu.don_vi_truc_thuoc_id;
    await this.recalculateAnnualUnit(donViId, updatedDanhHieu.nam);

    return updatedDanhHieu;
  }

  /** Admin từ chối danh hiệu */
  async reject(id, { ghi_chu, nguoi_duyet_id }) {
    const rejectedDanhHieu = await prisma.danhHieuDonViHangNam.update({
      where: { id: String(id) },
      data: {
        status: PROPOSAL_STATUS.REJECTED,
        ghi_chu: ghi_chu ?? null,
        nguoi_duyet_id: nguoi_duyet_id,
        ngay_duyet: new Date(),
      },
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    // Tự động recalculate sau khi từ chối
    const donViId = rejectedDanhHieu.co_quan_don_vi_id || rejectedDanhHieu.don_vi_truc_thuoc_id;
    await this.recalculateAnnualUnit(donViId, rejectedDanhHieu.nam);

    return rejectedDanhHieu;
  }

  async list({
    page = 1,
    limit = 10,
    year,
    donViId,
    danhHieu,
    status,
    userRole,
    userQuanNhanId,
  }: Record<string, any> = {}) {
    const where: Record<string, any> = {};
    if (year) where.nam = Number(year);
    if (danhHieu) where.danh_hieu = danhHieu;
    where.status = status != null && status !== '' ? status : PROPOSAL_STATUS.APPROVED;

    // Phân quyền: USER và MANAGER chỉ xem được đơn vị của mình
    if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (user) {
        if (userRole === ROLES.MANAGER && user.co_quan_don_vi_id) {
          where.OR = [
            { co_quan_don_vi_id: user.co_quan_don_vi_id },
            { don_vi_truc_thuoc_id: { in: await this.getSubUnits(user.co_quan_don_vi_id) } },
          ];
        } else if (userRole === ROLES.MANAGER && user.don_vi_truc_thuoc_id) {
          where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
        } else if (userRole === ROLES.USER && user.don_vi_truc_thuoc_id) {
          where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
        }
      } else {
        return {
          data: [],
          pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
        };
      }
    }

    if (donViId) {
      where.OR = [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }];
    }

    const [total, awards] = await Promise.all([
      prisma.danhHieuDonViHangNam.count({ where }),
      prisma.danhHieuDonViHangNam.findMany({
        where,
        orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { CoQuanDonVi: true, DonViTrucThuoc: true },
      }),
    ]);

    return {
      data: awards,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getSubUnits(coQuanDonViId) {
    const subUnits = await prisma.donViTrucThuoc.findMany({
      where: { co_quan_don_vi_id: coQuanDonViId },
      select: { id: true },
    });
    return subUnits.map(u => u.id);
  }

  async getById(id, userRole, userQuanNhanId) {
    const record = await prisma.danhHieuDonViHangNam.findUnique({
      where: { id: String(id) },
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    if (!record) return null;

    // Phân quyền: USER và MANAGER chỉ xem được đơn vị của mình
    if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (!user) return null;

      const recordDonViId = record.co_quan_don_vi_id || record.don_vi_truc_thuoc_id;

      if (userRole === ROLES.MANAGER) {
        // Manager kiểm tra xem đơn vị có thuộc cơ quan đơn vị của mình không
        if (
          user.co_quan_don_vi_id !== record.co_quan_don_vi_id &&
          user.co_quan_don_vi_id !== recordDonViId
        ) {
          return null;
        }
      } else if (userRole === ROLES.USER) {
        // User chỉ xem được đơn vị trực thuộc của mình
        if (user.don_vi_truc_thuoc_id !== recordDonViId) {
          return null;
        }
      }
    }

    return record;
  }

  /**
   * Upsert bản ghi DanhHieuDonViHangNam và tự động cập nhật HoSoDonViHangNam
   * @param {Object} params - Tham số
   * @param {string} params.don_vi_id - ID đơn vị (có thể là CoQuanDonVi hoặc DonViTrucThuoc)
   * @param {number} params.nam - Năm
   * @param {string} params.danh_hieu - Danh hiệu
   * @param {string} [params.so_quyet_dinh] - Số quyết định
   * @param {string} [params.ghi_chu] - Ghi chú
   * @param {string} params.nguoi_tao_id - ID người tạo
   * @returns {Promise<Object>} Bản ghi đã tạo/cập nhật
   */
  async upsert({
    don_vi_id,
    nam,
    danh_hieu,
    so_quyet_dinh,
    file_quyet_dinh,
    ghi_chu,
    nguoi_tao_id,
  }: {
    don_vi_id: string;
    nam: number | string;
    danh_hieu?: string | null;
    so_quyet_dinh?: string | null;
    file_quyet_dinh?: string | null;
    ghi_chu?: string | null;
    nguoi_tao_id: string;
  }) {
    const year = Number(nam);
    const unitId = don_vi_id;

    // Xác định loại đơn vị (query song song để tối ưu)
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { id: unitId } }),
      prisma.donViTrucThuoc.findUnique({ where: { id: unitId } }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new Error('Không tìm thấy đơn vị');
    }

    const isCoQuanDonVi = !!coQuanDonVi;

    // Xây dựng where condition và create data
    const whereCondition = isCoQuanDonVi
      ? { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } }
      : { unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: unitId, nam: year } };

    const createData = {
      nam: year,
      danh_hieu: danh_hieu || null,
      so_quyet_dinh: so_quyet_dinh || null,
      ghi_chu: ghi_chu || null,
      nguoi_tao_id: nguoi_tao_id,
      status: PROPOSAL_STATUS.APPROVED,
      // Set foreign key: nếu là cơ quan đơn vị thì lưu vào co_quan_don_vi_id, ngược lại lưu vào don_vi_truc_thuoc_id
      ...(isCoQuanDonVi ? { co_quan_don_vi_id: unitId } : { don_vi_truc_thuoc_id: unitId }),
    };

    const record = await prisma.danhHieuDonViHangNam.upsert({
      where: whereCondition,
      update: {
        danh_hieu: danh_hieu || null,
        so_quyet_dinh: so_quyet_dinh || null,
        ghi_chu: ghi_chu || null,
      },
      create: createData,
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    // Tự động recalculate hồ sơ đơn vị
    await this.recalculateAnnualUnit(unitId, year);

    return record;
  }

  /**
   * Recalculate theo đơn vị và năm (hoặc toàn bộ)
   */
  async recalculate({ don_vi_id, nam }) {
    if (don_vi_id && nam) {
      // Recalculate cho một đơn vị và một năm cụ thể
      await this.recalculateAnnualUnit(don_vi_id, Number(nam));
      return 1;
    } else if (don_vi_id) {
      // Recalculate tất cả các năm của một đơn vị
      const records = await prisma.hoSoDonViHangNam.findMany({
        where: {
          OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
        },
        select: { nam: true },
        distinct: ['nam'],
      });

      for (const r of records) {
        await this.recalculateAnnualUnit(don_vi_id, r.nam);
      }

      return records.length;
    } else {
      // Recalculate tất cả đơn vị và tất cả năm
      const records = await prisma.hoSoDonViHangNam.findMany({
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
          await this.recalculateAnnualUnit(unitId, year);
          count++;
        }
      }

      return count;
    }
  }

  async remove(id) {
    // Xóa DanhHieuDonViHangNam
    const danhHieu = await prisma.danhHieuDonViHangNam.findUnique({
      where: { id: String(id) },
    });

    if (!danhHieu) {
      throw new Error('Không tìm thấy bản ghi');
    }

    await prisma.danhHieuDonViHangNam.delete({ where: { id: String(id) } });

    // Tự động recalculate sau khi xóa (giống profileService)
    const donViId = danhHieu.co_quan_don_vi_id || danhHieu.don_vi_truc_thuoc_id;
    await this.recalculateAnnualUnit(donViId, danhHieu.nam);

    return true;
  }

  /**
   * Lấy hồ sơ gợi ý hằng năm của đơn vị (tương tự getAnnualProfile)
   */
  async getAnnualUnit(donViId, year) {
    // Kiểm tra đơn vị tồn tại
    const donVi =
      (await prisma.coQuanDonVi.findUnique({ where: { id: donViId } })) ||
      (await prisma.donViTrucThuoc.findUnique({ where: { id: donViId } }));

    if (!donVi) {
      throw new Error('Đơn vị không tồn tại');
    }

    const isCoQuanDonVi = !('co_quan_don_vi_id' in donVi);

    // Lấy hồ sơ năm gần nhất
    let profile = await prisma.hoSoDonViHangNam.findFirst({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: year,
      },
      orderBy: { nam: 'desc' },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: true,
      },
    });

    // Nếu chưa có hồ sơ, tạo mới với giá trị mặc định
    if (!profile) {
      const currentYear = new Date().getFullYear();
      profile = await prisma.hoSoDonViHangNam.create({
        data: {
          co_quan_don_vi_id: isCoQuanDonVi ? donViId : null,
          don_vi_truc_thuoc_id: isCoQuanDonVi ? null : donViId,
          nam: currentYear,
          tong_dvqt: 0,
          tong_dvqt_json: [],
          dvqt_lien_tuc: 0,
          du_dieu_kien_bk_tong_cuc: false,
          du_dieu_kien_bk_thu_tuong: false,
          goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập danh hiệu đơn vị.',
        },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: true,
        },
      });
    }

    return profile;
  }

  /**
   * Tính toán lại hồ sơ hằng năm của đơn vị (tương tự recalculateAnnualProfile)
   */
  async recalculateAnnualUnit(donViId, year = null) {
    try {
      // Kiểm tra đơn vị tồn tại
      const donVi =
        (await prisma.coQuanDonVi.findUnique({ where: { id: donViId } })) ||
        (await prisma.donViTrucThuoc.findUnique({ where: { id: donViId } }));

      if (!donVi) {
        throw new Error('Đơn vị không tồn tại');
      }

      const isCoQuanDonVi = !('co_quan_don_vi_id' in donVi);
      const targetYear = year || new Date().getFullYear();

      // Lấy tất cả danh hiệu của đơn vị đến năm hiện tại
      const danhHieuList = await prisma.danhHieuDonViHangNam.findMany({
        where: {
          OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
          nam: { lte: targetYear },
          status: PROPOSAL_STATUS.APPROVED,
        },
        orderBy: { nam: 'asc' },
      });

      // Tính toán các chỉ số
      const dvqtResult = await this.calculateTotalDVQT(donViId, targetYear);
      const dvqtLienTuc = await this.calculateContinuousYears(donViId, targetYear);
      const bkbqpLienTuc = await this.calculateBKBQPContinuous(donViId, targetYear);

      const du_dieu_kien_bk_tong_cuc = dvqtLienTuc % 2 === 0 && dvqtLienTuc >= 1;
      const du_dieu_kien_bk_thu_tuong =
        dvqtLienTuc % 7 === 0 && bkbqpLienTuc % 3 === 0 && dvqtLienTuc >= 7 && bkbqpLienTuc >= 3;

      // Kiểm tra xem có bằng khen chưa
      const currentYearAward = danhHieuList.find(dh => dh.nam === targetYear);
      const hasDecision = !!currentYearAward?.so_quyet_dinh;

      const goi_y = this.buildSuggestion(dvqtLienTuc, hasDecision);

      // Upsert HoSoDonViHangNam
      const whereCondition = isCoQuanDonVi
        ? { unique_co_quan_don_vi_nam: { co_quan_don_vi_id: donViId, nam: targetYear } }
        : { unique_don_vi_truc_thuoc_nam: { don_vi_truc_thuoc_id: donViId, nam: targetYear } };

      const hoSoData = {
        tong_dvqt: dvqtResult.total,
        tong_dvqt_json: dvqtResult.details,
        dvqt_lien_tuc: dvqtLienTuc % 7,
        du_dieu_kien_bk_tong_cuc,
        du_dieu_kien_bk_thu_tuong,
        goi_y,
      };

      const hoSo = await prisma.hoSoDonViHangNam.upsert({
        where: whereCondition,
        update: hoSoData,
        create: {
          ...hoSoData,
          co_quan_don_vi_id: isCoQuanDonVi ? donViId : null,
          don_vi_truc_thuoc_id: isCoQuanDonVi ? null : donViId,
          nam: targetYear,
        },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: true,
        },
      });

      return hoSo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy lịch sử khen thưởng hằng năm cho 1 đơn vị (danh sách DanhHieuDonViHangNam)
   */
  async getUnitAnnualAwards(donViId, userRole = 'ADMIN', userQuanNhanId = null) {
    if (!donViId) throw new Error('don_vi_id là bắt buộc');

    // Kiểm tra đơn vị tồn tại
    const donVi =
      (await prisma.coQuanDonVi.findUnique({ where: { id: donViId } })) ||
      (await prisma.donViTrucThuoc.findUnique({ where: { id: donViId } }));

    if (!donVi) throw new Error('Đơn vị không tồn tại');

    // Phân quyền
    if (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN) {
      // admin xem được tất cả
    } else if ((userRole === ROLES.MANAGER || userRole === ROLES.USER) && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (!user) throw new Error('Không tìm thấy thông tin người dùng');

      if (userRole === ROLES.MANAGER) {
        // Manager được xem tất cả đơn vị thuộc cùng co_quan_don_vi_id
        const targetCoQuanId =
          'co_quan_don_vi_id' in donVi && donVi.co_quan_don_vi_id
            ? donVi.co_quan_don_vi_id
            : donVi.id;
        if (!user.co_quan_don_vi_id || user.co_quan_don_vi_id !== targetCoQuanId) {
          throw new Error('Không có quyền xem lịch sử khen thưởng của đơn vị này');
        }
      } else if (userRole === ROLES.USER) {
        // User chỉ được xem đơn vị trực thuộc của chính họ
        if (!user.don_vi_truc_thuoc_id || user.don_vi_truc_thuoc_id !== donViId) {
          throw new Error('Không có quyền xem lịch sử khen thưởng của đơn vị này');
        }
      }
    } else {
      throw new Error('Không có quyền truy cập');
    }

    // Trả về danh sách danh hiệu và thống kê
    const danhHieuRecords = await prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        status: PROPOSAL_STATUS.APPROVED,
      },
      orderBy: { nam: 'desc' },
    });

    return danhHieuRecords;
  }

  /**
   * Xuất file mẫu Excel để import
   */
  /**
   * Preview import: parse + validate Excel, trả về danh sách hợp lệ / lỗi — KHÔNG lưu DB
   */
  async previewImport(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('File Excel không hợp lệ');
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'unit_id']);
    const maDonViCol = getHeaderCol(headerMap, ['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']);
    const tenDonViCol = getHeaderCol(headerMap, ['ten_don_vi', 'ten_donvi', 'ten', 'tendonvi']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']);
    const soQuyetDinhCol = getHeaderCol(headerMap, [
      'so_quyet_dinh',
      'soquyetdinh',
      'so_qd',
      'soqd',
    ]);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']);
    const bkbqpCol = getHeaderCol(headerMap, ['bkbqp', 'nhan_bkbqp', 'bkbqp_khong_dien']);
    const bkttcpCol = getHeaderCol(headerMap, ['bkttcp', 'nhan_bkttcp', 'bkttcp_khong_dien']);

    if (!maDonViCol || !namCol || !danhHieuCol) {
      throw new Error(
        `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
      );
    }

    // Verify đúng loại file bằng tên sheet
    if (worksheet.name === 'Danh hiệu hằng năm') {
      throw new Error(
        'File Excel không đúng loại. Đây là file khen thưởng cá nhân, không phải đơn vị hằng năm.'
      );
    }

    const validDanhHieu = ['ĐVQT', 'ĐVTT'];
    const errors = [];
    const valid = [];
    let total = 0;
    const seenInFile = new Set();
    const currentYear = new Date().getFullYear();

    // Query danh sách số quyết định hợp lệ trên hệ thống
    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
    });
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
      const tenDonVi = tenDonViCol ? String(row.getCell(tenDonViCol).value || '').trim() : '';
      const namVal = namCol ? row.getCell(namCol).value : null;
      const danhHieuRaw = danhHieuCol ? String(row.getCell(danhHieuCol).value || '').trim() : '';
      const soQuyetDinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : '';
      const ghiChu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : '';
      const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value ?? '').trim() : '';
      const bkttcpRaw = bkttcpCol ? String(row.getCell(bkttcpCol).value ?? '').trim() : '';

      // Skip empty rows
      if (!maDonVi && !namVal && !danhHieuRaw && !idValue) continue;

      // Dòng có ID nhưng không có danh hiệu → bỏ qua, báo lý do
      if (idValue && !danhHieuRaw) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: '',
          message: 'Bỏ qua — không có danh hiệu nào được điền',
        });
        continue;
      }

      total++;

      // Chặn nếu điền BKBQP/BKTTCP qua Excel
      if (parseBooleanValue(bkbqpRaw)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: 'BKBQP không được import qua Excel. Vui lòng chỉ thêm trên giao diện.',
        });
        continue;
      }
      if (parseBooleanValue(bkttcpRaw)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: 'BKTTCP không được import qua Excel. Vui lòng chỉ thêm trên giao diện.',
        });
        continue;
      }

      // Validate required fields
      const missingFields = [];
      if (!maDonVi) missingFields.push('Mã đơn vị');
      if (!namVal) missingFields.push('Năm');
      if (!danhHieuRaw) missingFields.push('Danh hiệu');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: `Thiếu ${missingFields.join(', ')}`,
        });
        continue;
      }

      // Validate year
      const nam = parseInt(String(namVal), 10);
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieuRaw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      // Validate danh_hieu
      const danhHieu = danhHieuRaw.toUpperCase();
      if (!validDanhHieu.includes(danhHieu)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieuRaw,
          message: `Danh hiệu "${danhHieuRaw}" không hợp lệ. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`,
        });
        continue;
      }

      // Validate số quyết định — bắt buộc + phải có trên hệ thống
      if (!soQuyetDinh) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: 'Thiếu số quyết định',
        });
        continue;
      }
      if (!validDecisionNumbers.has(soQuyetDinh)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: `Số quyết định "${soQuyetDinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      // Find unit by ma_don_vi
      let donVi = await prisma.coQuanDonVi.findFirst({ where: { ma_don_vi: maDonVi } });
      let isCoQuanDonVi = !!donVi;
      let donViTrucThuoc = null;

      if (!donVi) {
        donViTrucThuoc = await prisma.donViTrucThuoc.findFirst({ where: { ma_don_vi: maDonVi } });
        if (!donViTrucThuoc) {
          errors.push({
            row: rowNumber,
            ten_don_vi: tenDonVi,
            ma_don_vi: maDonVi,
            nam,
            danh_hieu: danhHieu,
            message: `Không tìm thấy đơn vị với mã ${maDonVi}`,
          });
          continue;
        }
      }

      const unitId = isCoQuanDonVi ? donVi.id : donViTrucThuoc.id;
      const unitName = isCoQuanDonVi ? donVi.ten_don_vi : donViTrucThuoc.ten_don_vi;

      // Check duplicate in file
      const fileKey = `${unitId}_${nam}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: unitName,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: `Trùng lặp trong file — cùng đơn vị, năm ${nam}`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      // Check duplicate in DB
      const existingAward = await prisma.danhHieuDonViHangNam.findFirst({
        where: {
          OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: unitId }],
          nam,
        },
      });
      if (existingAward && existingAward.danh_hieu) {
        errors.push({
          row: rowNumber,
          ten_don_vi: unitName,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: `Đã có danh hiệu ${existingAward.danh_hieu} năm ${nam} trên hệ thống`,
        });
        continue;
      }

      // Check chain eligibility for BKTTCP
      if (danhHieu === 'BKTTCP') {
        const eligibility = await this.checkUnitAwardEligibility(unitId, nam, 'BKTTCP');
        if (!eligibility.eligible) {
          errors.push({
            row: rowNumber,
            ten_don_vi: unitName,
            ma_don_vi: maDonVi,
            nam,
            danh_hieu: danhHieu,
            message: eligibility.reason,
          });
          continue;
        }
      }

      // Query history: last 5 records
      const history = await prisma.danhHieuDonViHangNam.findMany({
        where: {
          OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: unitId }],
        },
        orderBy: { nam: 'desc' },
        take: 5,
        select: {
          nam: true,
          danh_hieu: true,
          nhan_bkbqp: true,
          nhan_bkttcp: true,
          so_quyet_dinh: true,
        },
      });

      valid.push({
        row: rowNumber,
        unit_id: unitId,
        is_co_quan_don_vi: isCoQuanDonVi,
        ma_don_vi: maDonVi,
        ten_don_vi: unitName,
        nam,
        danh_hieu: danhHieu,
        so_quyet_dinh: soQuyetDinh,
        ghi_chu: ghiChu || null,
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Confirm import: lưu dữ liệu đã validate vào DB
   */
  async confirmImport(validItems, adminId) {
    return await prisma.$transaction(
      async tx => {
        const results = [];
        for (const item of validItems) {
          const upsertWhere = item.is_co_quan_don_vi
            ? {
                unique_co_quan_don_vi_nam_dh: {
                  co_quan_don_vi_id: item.unit_id,
                  nam: item.nam,
                },
              }
            : {
                unique_don_vi_truc_thuoc_nam_dh: {
                  don_vi_truc_thuoc_id: item.unit_id,
                  nam: item.nam,
                },
              };

          const createData: Record<string, any> = {
            nam: item.nam,
            danh_hieu: item.danh_hieu,
            so_quyet_dinh: item.so_quyet_dinh ?? null,
            ghi_chu: item.ghi_chu ?? null,
            status: PROPOSAL_STATUS.APPROVED,
            nguoi_tao_id: adminId,
          };

          if (item.is_co_quan_don_vi) {
            createData.co_quan_don_vi_id = item.unit_id;
          } else {
            createData.don_vi_truc_thuoc_id = item.unit_id;
          }

          const result = await tx.danhHieuDonViHangNam.upsert({
            where: upsertWhere,
            update: {
              danh_hieu: item.danh_hieu,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: createData as Prisma.DanhHieuDonViHangNamUncheckedCreateInput,
          });
          results.push(result);
        }
        return { imported: results.length };
      },
      { timeout: 30000 }
    );
  }

  async exportTemplate(unitIds: string[] = [], userRole: string = ROLES.MANAGER) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Khen thưởng đơn vị');

    // Define columns
    const columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'ID', key: 'id', width: 30 },
      { header: 'Mã đơn vị', key: 'ma_don_vi', width: 15 },
      { header: 'Tên đơn vị', key: 'ten_don_vi', width: 30 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 20 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
      { header: 'BKBQP (không điền)', key: 'bkbqp', width: 20 },
      { header: 'BKTTCP (không điền)', key: 'bkttcp', width: 20 },
    ];

    worksheet.columns = columns;

    // Style header row
    const headerRowObj = worksheet.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Readonly yellow background for STT, ID, Mã đơn vị, Tên đơn vị (columns 1-4)
    const readonlyFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFFFF00' },
    };
    for (let col = 1; col <= 4; col++) {
      headerRowObj.getCell(col).fill = readonlyFill;
    }

    // Red background for BKBQP, BKTTCP columns (columns 9-10)
    const redFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFF0000' },
    };
    headerRowObj.getCell(9).fill = redFill;
    headerRowObj.getCell(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRowObj.getCell(10).fill = redFill;
    headerRowObj.getCell(10).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add dropdown for Danh hiệu column (column 6)
    const danhHieuValidation = {
      type: 'list' as const,
      allowBlank: true,
      formulae: ['"ĐVQT,ĐVTT"'],
    };

    // Add dropdown for Số quyết định from DB (column 7)
    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
    });
    const decisionList = existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean);
    let soQdValidation = null;
    if (decisionList.length > 0) {
      const formulaStr = decisionList.join(',');
      // Excel formula limit: use direct list if short enough
      if (formulaStr.length < 255) {
        soQdValidation = {
          type: 'list' as const,
          allowBlank: true,
          formulae: [`"${formulaStr}"`],
        };
      }
    }

    // Pre-fill rows if unitIds provided
    if (unitIds && unitIds.length > 0) {
      // Query units from both tables
      const coQuanDonVis = await prisma.coQuanDonVi.findMany({
        where: { id: { in: unitIds } },
      });
      const donViTrucThuocs = await prisma.donViTrucThuoc.findMany({
        where: { id: { in: unitIds } },
      });

      const unitMap = new Map();
      coQuanDonVis.forEach(u => unitMap.set(u.id, { ...u, _type: 'cqDv' }));
      donViTrucThuocs.forEach(u => unitMap.set(u.id, { ...u, _type: 'dvtt' }));

      let stt = 1;
      for (const uid of unitIds) {
        const unit = unitMap.get(uid);
        if (!unit) continue;

        const dataRow = worksheet.addRow({
          stt,
          id: unit.id,
          ma_don_vi: unit.ma_don_vi || '',
          ten_don_vi: unit.ten_don_vi || '',
          nam: '',
          danh_hieu: '',
          so_quyet_dinh: '',
          ghi_chu: '',
          bkbqp: '',
          bkttcp: '',
        });

        // Readonly yellow background for STT, ID, Mã đơn vị, Tên đơn vị
        for (let col = 1; col <= 4; col++) {
          dataRow.getCell(col).fill = readonlyFill;
        }

        // Red background for BKBQP, BKTTCP
        dataRow.getCell(9).fill = redFill;
        dataRow.getCell(10).fill = redFill;

        stt++;
      }
    } else {
      // Add sample row
      const sampleRow = worksheet.addRow({
        stt: 1,
        id: '',
        ma_don_vi: 'DV001',
        ten_don_vi: 'Đơn vị mẫu',
        nam: 2024,
        danh_hieu: 'ĐVQT',
        so_quyet_dinh: '',
        ghi_chu: '',
        bkbqp: '',
        bkttcp: '',
      });
      sampleRow.getCell(9).fill = redFill;
      sampleRow.getCell(10).fill = redFill;
    }

    // Apply data validations to data rows (rows 2 to 1000)
    for (let r = 2; r <= 1000; r++) {
      worksheet.getCell(`F${r}`).dataValidation = danhHieuValidation;
      if (soQdValidation) {
        worksheet.getCell(`G${r}`).dataValidation = soQdValidation;
      }
    }

    // Conditional formatting: nền vàng khi ô có giá trị
    const maxDataRow = Math.max(unitIds.length + 1, 50);
    const editableColumns = ['F', 'G'];
    editableColumns.forEach(col => {
      worksheet.addConditionalFormatting({
        ref: `${col}2:${col}${maxDataRow}`,
        rules: [
          {
            type: 'expression',
            formulae: [`LEN(TRIM(${col}2))>0`],
            style: {
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } },
            },
            priority: 1,
          },
        ],
      });
    });

    return workbook;
  }

  /**
   * Import khen thưởng đơn vị từ Excel
   */
  async importFromExcel(buffer, adminId) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Try to find worksheet by name first, fallback to first worksheet
    let worksheet = workbook.getWorksheet('Khen thưởng đơn vị');
    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new Error('File Excel không hợp lệ hoặc không tìm thấy sheet dữ liệu');
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const maDonViCol = getHeaderCol(headerMap, ['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']);
    const tenDonViCol = getHeaderCol(headerMap, ['ten_don_vi', 'ten_donvi', 'ten', 'tendovi']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year', 'năm']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']);
    const soQuyetDinhCol = getHeaderCol(headerMap, [
      'so_quyet_dinh',
      'soquyetdinh',
      'so_qd',
      'soqd',
    ]);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']);
    const bkbqpCol = getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']);
    const soQdBkbqpCol = getHeaderCol(headerMap, [
      'so_quyet_dinh_bkbqp',
      'so_qd_bkbqp',
      'soqdbkbqp',
    ]);

    if (!maDonViCol || !namCol || !danhHieuCol) {
      throw new Error(
        `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(
          headerMap
        ).join(', ')}`
      );
    }

    // Verify đúng loại file
    const hoTenCheck = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten']);
    const capBacCheck = getHeaderCol(headerMap, ['cap_bac', 'capbac']);
    if (hoTenCheck || capBacCheck) {
      throw new Error(
        'File Excel không đúng loại. Đây là file khen thưởng cá nhân, không phải đơn vị hằng năm.'
      );
    }

    const errors = [];
    const imported = [];
    let total = 0;
    const selectedUnitIds = [];

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
      const namVal = namCol ? row.getCell(namCol).value : null;
      const danhHieu = danhHieuCol ? String(row.getCell(danhHieuCol).value || '').trim() : '';
      const soQuyetDinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value || '').trim()
        : '';
      const ghiChu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : '';
      const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value || '').trim() : '';
      const nhanBkbqp = ['có', 'co', 'true', '1', 'x'].includes(bkbqpRaw.toLowerCase());
      const soQdBkbqp = soQdBkbqpCol ? String(row.getCell(soQdBkbqpCol).value || '').trim() : '';

      if (!maDonVi && !namVal && !danhHieu) continue; // dòng trống

      total++; // Đếm tổng số dòng có data

      try {
        if (!maDonVi || !namVal || !danhHieu) {
          throw new Error(
            `Thiếu thông tin bắt buộc: Mã đơn vị=${maDonVi}, Năm=${namVal}, Danh hiệu=${danhHieu}`
          );
        }

        const nam = parseInt(String(namVal), 10);
        if (!Number.isInteger(nam)) {
          throw new Error(`Giá trị năm không hợp lệ: ${namVal}`);
        }

        if (!['ĐVQT', 'ĐVTT', 'BKTTCP'].includes(danhHieu)) {
          throw new Error(
            `Danh hiệu không hợp lệ: ${danhHieu}. Danh hiệu hợp lệ: ĐVQT, ĐVTT, BKTTCP`
          );
        }

        // Check chuỗi khen thưởng cho BKTTCP và BKBQP
        const checkDanhHieu = danhHieu === 'BKTTCP' ? 'BKTTCP' : null;
        const checkBkbqp = bkbqpRaw ? 'BKBQP' : null;

        const donVi = await prisma.coQuanDonVi.findFirst({
          where: { ma_don_vi: maDonVi },
        });

        if (!donVi) {
          const donViTrucThuoc = await prisma.donViTrucThuoc.findFirst({
            where: { ma_don_vi: maDonVi },
          });

          if (!donViTrucThuoc) {
            throw new Error(`Không tìm thấy đơn vị với mã ${maDonVi}`);
          }

          // Check chuỗi khen thưởng
          if (checkDanhHieu) {
            const eligibility = await this.checkUnitAwardEligibility(
              donViTrucThuoc.id,
              nam,
              checkDanhHieu
            );
            if (!eligibility.eligible) throw new Error(eligibility.reason);
          }
          if (checkBkbqp) {
            const eligibility = await this.checkUnitAwardEligibility(
              donViTrucThuoc.id,
              nam,
              'BKBQP'
            );
            if (!eligibility.eligible) throw new Error(eligibility.reason);
          }

          // Check for duplicate unit awards in proposals
          try {
            const duplicateCheck = await checkDuplicateUnitAward(
              donViTrucThuoc.id,
              nam,
              danhHieu,
              PROPOSAL_TYPES.DON_VI_HANG_NAM
            );
            if (duplicateCheck.exists) {
              throw new Error(duplicateCheck.message);
            }
          } catch (checkError) {
            if (checkError.message.includes('duplicate') || checkError.message.includes('đã có')) {
              throw checkError;
            }
            // Continue processing but log the error
          }

          const award = await prisma.danhHieuDonViHangNam.upsert({
            where: {
              unique_don_vi_truc_thuoc_nam_dh: {
                don_vi_truc_thuoc_id: donViTrucThuoc.id,
                nam,
              },
            },
            create: {
              don_vi_truc_thuoc_id: donViTrucThuoc.id,
              nam,
              danh_hieu: danhHieu,
              so_quyet_dinh: soQuyetDinh || null,
              ghi_chu: ghiChu || null,
              nhan_bkbqp: nhanBkbqp,
              so_quyet_dinh_bkbqp: soQdBkbqp || null,
              status: PROPOSAL_STATUS.APPROVED,
              nguoi_tao_id: adminId,
            },
            update: {
              danh_hieu: danhHieu,
              so_quyet_dinh: soQuyetDinh || null,
              ghi_chu: ghiChu || null,
              nhan_bkbqp: nhanBkbqp,
              so_quyet_dinh_bkbqp: soQdBkbqp || null,
            },
          });
          imported.push(award);
          if (!selectedUnitIds.includes(donViTrucThuoc.id)) {
            selectedUnitIds.push(donViTrucThuoc.id);
          }
        } else {
          // Check chuỗi khen thưởng
          if (checkDanhHieu) {
            const eligibility = await this.checkUnitAwardEligibility(donVi.id, nam, checkDanhHieu);
            if (!eligibility.eligible) throw new Error(eligibility.reason);
          }
          if (checkBkbqp) {
            const eligibility = await this.checkUnitAwardEligibility(donVi.id, nam, 'BKBQP');
            if (!eligibility.eligible) throw new Error(eligibility.reason);
          }

          // Check for duplicate unit awards in proposals
          try {
            const duplicateCheck = await checkDuplicateUnitAward(
              donVi.id,
              nam,
              danhHieu,
              PROPOSAL_TYPES.DON_VI_HANG_NAM
            );
            if (duplicateCheck.exists) {
              throw new Error(duplicateCheck.message);
            }
          } catch (checkError) {
            if (checkError.message.includes('duplicate')) {
              throw checkError;
            }
            // Continue processing but log the error
          }

          const award = await prisma.danhHieuDonViHangNam.upsert({
            where: {
              unique_co_quan_don_vi_nam_dh: {
                co_quan_don_vi_id: donVi.id,
                nam,
              },
            },
            create: {
              co_quan_don_vi_id: donVi.id,
              nam,
              danh_hieu: danhHieu,
              so_quyet_dinh: soQuyetDinh || null,
              ghi_chu: ghiChu || null,
              nhan_bkbqp: nhanBkbqp,
              so_quyet_dinh_bkbqp: soQdBkbqp || null,
              status: PROPOSAL_STATUS.APPROVED,
              nguoi_tao_id: adminId,
            },
            update: {
              danh_hieu: danhHieu,
              so_quyet_dinh: soQuyetDinh || null,
              ghi_chu: ghiChu || null,
              nhan_bkbqp: nhanBkbqp,
              so_quyet_dinh_bkbqp: soQdBkbqp || null,
            },
          });
          imported.push(award);
          if (!selectedUnitIds.includes(donVi.id)) {
            selectedUnitIds.push(donVi.id);
          }
        }
      } catch (error) {
        errors.push(`Dòng ${i}: ${error.message}`);
      }
    }

    return {
      total,
      imported: imported.length,
      errors,
      selectedUnitIds,
    };
  }

  /**
   * Xuất danh sách khen thưởng đơn vị ra Excel
   */
  async exportToExcel(filters = {}, userRole, userQuanNhanId) {
    const { nam, danh_hieu } = filters as Record<string, any>;

    const where: Record<string, any> = { status: PROPOSAL_STATUS.APPROVED };
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;

    // Filter theo role
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (user?.co_quan_don_vi_id) {
        where.co_quan_don_vi_id = user.co_quan_don_vi_id;
      } else if (user?.don_vi_truc_thuoc_id) {
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      }
    }

    const awards = await prisma.danhHieuDonViHangNam.findMany({
      where,
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: true,
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: 10000,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Khen thưởng đơn vị');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã đơn vị', key: 'ma_don_vi', width: 15 },
      { header: 'Tên đơn vị', key: 'ten_don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 20 },
      { header: 'Số QĐ danh hiệu', key: 'so_quyet_dinh', width: 20 },
      { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
      { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFD3D3D3' },
    };

    awards.forEach((award, index) => {
      const donVi = award.CoQuanDonVi || award.DonViTrucThuoc;
      worksheet.addRow({
        stt: index + 1,
        ma_don_vi: donVi?.ma_don_vi || '',
        ten_don_vi: donVi?.ten_don_vi || '',
        nam: award.nam,
        danh_hieu: getDanhHieuName(award.danh_hieu),
        so_quyet_dinh: award.so_quyet_dinh || '',
        nhan_bkbqp: award.nhan_bkbqp ? 'Có' : '',
        so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp || '',
        nhan_bkttcp: award.nhan_bkttcp ? 'Có' : '',
        so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp || '',
        ghi_chu: award.ghi_chu || '',
      });
    });

    return workbook;
  }

  /**
   * Thống kê khen thưởng đơn vị
   */
  async getStatistics(filters = {}, userRole, userQuanNhanId) {
    const { nam } = filters as Record<string, any>;

    const where: Record<string, any> = { status: PROPOSAL_STATUS.APPROVED };
    if (nam) where.nam = nam;

    // Filter theo role
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (user?.co_quan_don_vi_id) {
        where.co_quan_don_vi_id = user.co_quan_don_vi_id;
      } else if (user?.don_vi_truc_thuoc_id) {
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      }
    }

    const awards = await prisma.danhHieuDonViHangNam.findMany({
      where,
    });

    const byDanhHieu = awards.reduce((acc, award) => {
      const key = award.danh_hieu;
      if (!acc[key]) {
        acc[key] = { danh_hieu: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    const byNam = awards.reduce((acc, award) => {
      const key = award.nam;
      if (!acc[key]) {
        acc[key] = { nam: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    return {
      total: awards.length,
      byDanhHieu: Object.values(byDanhHieu),
      byNam: Object.values(byNam).sort(
        (a, b) => (b as { nam: number }).nam - (a as { nam: number }).nam
      ),
    };
  }
}

export default new UnitAnnualAwardService();
