const { prisma } = require('../models');
const proposalService = require('./proposal.service');
const { getDanhHieuName } = require('../constants/danhHieu.constants');

class UnitAnnualAwardService {
  /**
   * Lấy danh sách khen thưởng đơn vị hằng năm với phân trang
   */
  async list({ page = 1, limit = 10, year, donViId, danhHieu, userRole, userQuanNhanId }) {
    const skip = (page - 1) * limit;
    const where = { status: 'APPROVED' };

    if (year) {
      where.nam = parseInt(year);
    }

    if (danhHieu) {
      where.danh_hieu = danhHieu;
    }

    // Role-based filtering - ưu tiên filter manager trước
    if (userRole === 'MANAGER' && userQuanNhanId) {
      const managerPersonnel = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (managerPersonnel?.co_quan_don_vi_id) {
        // Manager thuộc cơ quan đơn vị - lấy tất cả đơn vị trực thuộc của cơ quan đó
        const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
          select: { id: true },
        });
        const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);
        where.OR = [
          { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
          { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
        ];
      } else if (managerPersonnel?.don_vi_truc_thuoc_id) {
        // Manager thuộc đơn vị trực thuộc - chỉ lấy đơn vị đó
        where.don_vi_truc_thuoc_id = managerPersonnel.don_vi_truc_thuoc_id;
      }
    } else if (donViId) {
      // Chỉ áp dụng filter donViId nếu không phải manager (manager đã được filter ở trên)
      where.OR = [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }];
    }

    const [awards, total] = await Promise.all([
      prisma.danhHieuDonViHangNam.findMany({
        where,
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: true,
        },
        orderBy: [{ nam: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.danhHieuDonViHangNam.count({ where }),
    ]);

    return {
      awards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy chi tiết một khen thưởng đơn vị theo ID
   */
  async getById(id, userRole, userQuanNhanId) {
    const award = await prisma.danhHieuDonViHangNam.findUnique({
      where: { id: String(id) },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: true,
      },
    });

    if (!award) {
      return null;
    }

    // Role-based access check
    if (userRole === 'MANAGER' && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      const hasAccess =
        (user?.co_quan_don_vi_id && award.co_quan_don_vi_id === user.co_quan_don_vi_id) ||
        (user?.don_vi_truc_thuoc_id && award.don_vi_truc_thuoc_id === user.don_vi_truc_thuoc_id);

      if (!hasAccess) {
        return null;
      }
    }

    return award;
  }

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
        status: 'APPROVED',
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
        status: 'PENDING',
      },
      create: {
        co_quan_don_vi_id: isCoQuanDonVi ? unitId : null,
        don_vi_truc_thuoc_id: isCoQuanDonVi ? null : unitId,
        nam: year,
        danh_hieu: danh_hieu || null,
        ghi_chu: ghi_chu || null,
        nguoi_tao_id: nguoi_tao_id,
        status: 'PENDING',
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
    // Chuẩn bị dữ liệu update
    const updateData = {
      status: 'APPROVED',
      nguoi_duyet_id: nguoi_duyet_id,
      ngay_duyet: new Date(),
      so_quyet_dinh: so_quyet_dinh || null,
      file_quyet_dinh: file_quyet_dinh || null,
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
        status: 'REJECTED',
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

  async list({ page = 1, limit = 10, year, donViId, status, userRole, userQuanNhanId }) {
    const where = {};
    if (year) where.nam = Number(year);
    if (status) where.status = status;

    // Phân quyền: USER và MANAGER chỉ xem được đơn vị của mình
    if ((userRole === 'USER' || userRole === 'MANAGER') && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (user) {
        if (userRole === 'MANAGER' && user.co_quan_don_vi_id) {
          // Manager xem tất cả đơn vị thuộc cơ quan đơn vị
          where.OR = [
            { co_quan_don_vi_id: user.co_quan_don_vi_id },
            { don_vi_truc_thuoc_id: { in: await this.getSubUnits(user.co_quan_don_vi_id) } },
          ];
        } else if (userRole === 'USER' && user.don_vi_truc_thuoc_id) {
          // User chỉ xem đơn vị trực thuộc của mình
          where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
        }
      } else {
        return {
          items: [],
          pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
        };
      }
    }

    if (donViId) {
      where.OR = [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }];
    }

    const [total, items] = await Promise.all([
      prisma.danhHieuDonViHangNam.count({ where }),
      prisma.danhHieuDonViHangNam.findMany({
        where,
        orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { CoQuanDonVi: true, DonViTrucThuoc: true },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
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
    if ((userRole === 'USER' || userRole === 'MANAGER') && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (!user) return null;

      const recordDonViId = record.co_quan_don_vi_id || record.don_vi_truc_thuoc_id;

      if (userRole === 'MANAGER') {
        // Manager kiểm tra xem đơn vị có thuộc cơ quan đơn vị của mình không
        if (
          user.co_quan_don_vi_id !== record.co_quan_don_vi_id &&
          user.co_quan_don_vi_id !== recordDonViId
        ) {
          return null;
        }
      } else if (userRole === 'USER') {
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
  async upsert({ don_vi_id, nam, danh_hieu, so_quyet_dinh, ghi_chu, nguoi_tao_id }) {
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
      status: 'APPROVED',
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
    try {
      // Kiểm tra đơn vị tồn tại
      const donVi =
        (await prisma.coQuanDonVi.findUnique({ where: { id: donViId } })) ||
        (await prisma.donViTrucThuoc.findUnique({ where: { id: donViId } }));

      if (!donVi) {
        throw new Error('Đơn vị không tồn tại');
      }

      const isCoQuanDonVi = !!donVi.ma_don_vi && !donVi.co_quan_don_vi_id;

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
    } catch (error) {
      throw error;
    }
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

      const isCoQuanDonVi = !!donVi.ma_don_vi && !donVi.co_quan_don_vi_id;
      const targetYear = year || new Date().getFullYear();

      console.log(
        `📋 [recalculateAnnualUnit] Đơn vị ID: ${donViId}, Năm: ${targetYear}, IsCoQuanDonVi: ${isCoQuanDonVi}`
      );

      // Lấy tất cả danh hiệu của đơn vị đến năm hiện tại
      const danhHieuList = await prisma.danhHieuDonViHangNam.findMany({
        where: {
          OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
          nam: { lte: targetYear },
          status: 'APPROVED',
        },
        orderBy: { nam: 'asc' },
      });

      console.log(
        `📋 [recalculateAnnualUnit] Số danh hiệu: ${danhHieuList.length}`,
        danhHieuList.map(dh => `${dh.nam}: ${dh.danh_hieu}`).join(', ')
      );

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

      console.log(
        `📋 [recalculateAnnualUnit] Kết quả tính toán:`,
        JSON.stringify(
          {
            tong_dvqt: dvqtResult.total,
            dvqt_lien_tuc: dvqtLienTuc,
            du_dieu_kien_bk_tong_cuc,
            du_dieu_kien_bk_thu_tuong,
            goi_y,
          },
          null,
          2
        )
      );

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

      console.log(`✅ [recalculateAnnualUnit] Đã lưu hoSoDonViHangNam thành công. ID: ${hoSo.id}`);

      return hoSo;
    } catch (error) {
      console.error(`❌ [recalculateAnnualUnit] Lỗi:`, error);
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
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      // admin xem được tất cả
    } else if ((userRole === 'MANAGER' || userRole === 'USER') && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (!user) throw new Error('Không tìm thấy thông tin người dùng');

      if (userRole === 'MANAGER') {
        // Manager được xem tất cả đơn vị thuộc cùng co_quan_don_vi_id
        let targetCoQuanId = donVi.co_quan_don_vi_id || donVi.id;
        if (!user.co_quan_don_vi_id || user.co_quan_don_vi_id !== targetCoQuanId) {
          throw new Error('Không có quyền xem lịch sử khen thưởng của đơn vị này');
        }
      } else if (userRole === 'USER') {
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
        status: 'APPROVED',
      },
      orderBy: { nam: 'desc' },
    });

    return danhHieuRecords;
  }

  /**
   * Xuất file mẫu Excel để import
   */
  async exportTemplate(userRole = 'MANAGER') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Khen thưởng đơn vị');

    // Define columns - MANAGER chỉ có các trường cơ bản
    const columns = [
      { header: 'Mã đơn vị (*)', key: 'ma_don_vi', width: 15 },
      { header: 'Tên đơn vị (*)', key: 'ten_don_vi', width: 30 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
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

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    const sampleRow = {
      ma_don_vi: 'DV001',
      ten_don_vi: 'Đơn vị mẫu',
      nam: 2024,
      danh_hieu: 'ĐVQT',
    };

    // ADMIN có thêm các trường chi tiết trong sample
    if (userRole === 'ADMIN') {
      sampleRow.ghi_chu = 'Ghi chú mẫu';
      sampleRow.so_quyet_dinh = '123/QĐ-BQP';
    }

    worksheet.addRow(sampleRow);

    worksheet.addRow([]);
    worksheet.addRow(['Ghi chú:']);
    worksheet.addRow(['- Các cột có dấu (*) là bắt buộc']);
    worksheet.addRow(['- Danh hiệu hợp lệ: ĐVQT, ĐVTT, BKTTCP']);
    worksheet.addRow(['- Năm phải là số nguyên dương']);

    return workbook;
  }

  /**
   * Import khen thưởng đơn vị từ Excel
   */
  async importFromExcel(buffer, adminId) {
    const ExcelJS = require('exceljs');
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
      const rawValue = String(cell.value || '').trim();
      const rawLower = rawValue.toLowerCase();
      // Normalize header: remove accents, special chars, and extra spaces
      const normalized = removeVietnameseAccents(rawLower)
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/[^a-z0-9_]/g, '') // Remove special characters
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

      console.log(`=== DEBUG: Header Processing ===`);
      console.log(`Column ${colNumber}: raw="${rawValue}" -> normalized="${normalized}"`);

      if (normalized) headerMap[normalized] = colNumber;
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

    const maDonViCol = getHeaderCol(['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']);
    const tenDonViCol = getHeaderCol(['ten_don_vi', 'ten_donvi', 'ten', 'tendovi']);
    const namCol = getHeaderCol(['nam', 'year', 'năm']);
    const danhHieuCol = getHeaderCol(['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']);
    const soQuyetDinhCol = getHeaderCol(['so_quyet_dinh', 'soquyetdinh', 'so_qd', 'soqd']);
    const ghiChuCol = getHeaderCol(['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']);

    console.log('=== DEBUG: Column Detection ===');
    console.log('maDonViCol:', maDonViCol);
    console.log('tenDonViCol:', tenDonViCol);
    console.log('namCol:', namCol);
    console.log('danhHieuCol:', danhHieuCol);
    console.log('soQuyetDinhCol:', soQuyetDinhCol);
    console.log('ghiChuCol:', ghiChuCol);

    console.log('=== DEBUG: Column Detection ===');
    console.log('maDonViCol:', maDonViCol);
    console.log('tenDonViCol:', tenDonViCol);
    console.log('namCol:', namCol);
    console.log('danhHieuCol:', danhHieuCol);
    console.log('soQuyetDinhCol:', soQuyetDinhCol);
    console.log('ghiChuCol:', ghiChuCol);

    if (!maDonViCol || !namCol || !danhHieuCol) {
      throw new Error(
        `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(
          headerMap
        ).join(', ')}`
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

      console.log(`=== DEBUG: Row ${i} Data ===`);
      console.log('maDonVi:', maDonVi);
      console.log('namVal:', namVal);
      console.log('danhHieu:', danhHieu);
      console.log('soQuyetDinh:', soQuyetDinh);
      console.log('ghiChu:', ghiChu);

      if (!maDonVi && !namVal && !danhHieu) continue; // dòng trống

      total++; // Đếm tổng số dòng có data

      try {
        if (!maDonVi || !namVal || !danhHieu) {
          throw new Error(
            `Thiếu thông tin bắt buộc: Mã đơn vị=${maDonVi}, Năm=${namVal}, Danh hiệu=${danhHieu}`
          );
        }

        console.log(`=== DEBUG: Processing row ${i} ===`);
        console.log(`maDonVi: "${maDonVi}", namVal: ${namVal}, danhHieu: "${danhHieu}"`);

        const nam = parseInt(namVal);
        if (!Number.isInteger(nam)) {
          throw new Error(`Giá trị năm không hợp lệ: ${namVal}`);
        }

        if (!['ĐVQT', 'ĐVTT', 'BKTTCP'].includes(danhHieu)) {
          throw new Error(
            `Danh hiệu không hợp lệ: ${danhHieu}. Danh hiệu hợp lệ: ĐVQT, ĐVTT, BKTTCP`
          );
        }

        console.log(`=== DEBUG: Looking up unit with ma_don_vi: "${maDonVi}" ===`);
        const donVi = await prisma.coQuanDonVi.findFirst({
          where: { ma_don_vi: maDonVi },
        });

        console.log(
          `=== DEBUG: CoQuanDonVi lookup result:`,
          donVi ? `Found ID: ${donVi.id}` : 'Not found'
        );

        if (!donVi) {
          const donViTrucThuoc = await prisma.donViTrucThuoc.findFirst({
            where: { ma_don_vi: maDonVi },
          });

          console.log(
            `=== DEBUG: DonViTrucThuoc lookup result:`,
            donViTrucThuoc ? `Found ID: ${donViTrucThuoc.id}` : 'Not found'
          );

          if (!donViTrucThuoc) {
            throw new Error(`Không tìm thấy đơn vị với mã ${maDonVi}`);
          }

          console.log(`=== DEBUG: Processing DonViTrucThuoc ID: ${donViTrucThuoc.id} ===`);

          // Check for duplicate unit awards in proposals
          try {
            const duplicateCheck = await proposalService.checkDuplicateUnitAward(
              donViTrucThuoc.id,
              nam,
              danhHieu,
              'DON_VI_HANG_NAM'
            );
            if (duplicateCheck.exists) {
              throw new Error(duplicateCheck.message);
            }
          } catch (checkError) {
            if (checkError.message.includes('duplicate') || checkError.message.includes('đã có')) {
              throw checkError;
            }
            console.error('Error checking unit duplicates:', checkError);
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
              status: 'APPROVED',
              nguoi_tao_id: adminId,
            },
            update: {
              danh_hieu: danhHieu,
              so_quyet_dinh: soQuyetDinh || null,
              ghi_chu: ghiChu || null,
            },
          });
          imported.push(award);
          if (!selectedUnitIds.includes(donViTrucThuoc.id)) {
            selectedUnitIds.push(donViTrucThuoc.id);
            console.log(
              `=== DEBUG: Added DonViTrucThuoc ID ${donViTrucThuoc.id} to selectedUnitIds ===`
            );
          }
        } else {
          console.log(`=== DEBUG: Processing CoQuanDonVi ID: ${donVi.id} ===`);

          // Check for duplicate unit awards in proposals
          try {
            const duplicateCheck = await proposalService.checkDuplicateUnitAward(
              donVi.id,
              nam,
              danhHieu,
              'DON_VI_HANG_NAM'
            );
            if (duplicateCheck.exists) {
              throw new Error(duplicateCheck.message);
            }
          } catch (checkError) {
            if (checkError.message.includes('duplicate')) {
              throw checkError;
            }
            console.error('Error checking unit duplicates:', checkError);
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
              status: 'APPROVED',
              nguoi_tao_id: adminId,
            },
            update: {
              danh_hieu: danhHieu,
              so_quyet_dinh: soQuyetDinh || null,
              ghi_chu: ghiChu || null,
            },
          });
          imported.push(award);
          if (!selectedUnitIds.includes(donVi.id)) {
            selectedUnitIds.push(donVi.id);
            console.log(`=== DEBUG: Added CoQuanDonVi ID ${donVi.id} to selectedUnitIds ===`);
          }
        }
      } catch (error) {
        errors.push(`Dòng ${i}: ${error.message}`);
      }
    }

    console.log(`=== DEBUG: Import Summary ===`);
    console.log(`Total rows processed: ${total}`);
    console.log(`Imported records: ${imported.length}`);
    console.log(`Errors: ${errors.length}`, errors);
    console.log(`Selected Unit IDs:`, selectedUnitIds);

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
    const ExcelJS = require('exceljs');
    const { nam, danh_hieu } = filters;

    const where = { status: 'APPROVED' };
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;

    // Filter theo role
    if (userRole === 'MANAGER' && userQuanNhanId) {
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
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

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
    const { nam } = filters;

    const where = { status: 'APPROVED' };
    if (nam) where.nam = nam;

    // Filter theo role
    if (userRole === 'MANAGER' && userQuanNhanId) {
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
      byNam: Object.values(byNam).sort((a, b) => b.nam - a.nam),
    };
  }
}

module.exports = new UnitAnnualAwardService();
