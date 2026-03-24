import { prisma } from '../../models';
import { ROLES } from '../../constants/roles';
import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';

/**
 * Lấy thông tin user với đơn vị (helper method)
 * @param {number} userId - ID của tài khoản
 * @returns {Promise<Object>} - User object với QuanNhan
 */
async function getUserWithUnit(userId: string) {
  return await prisma.taiKhoan.findUnique({
    where: { id: userId },
    include: {
      QuanNhan: {
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
}

/**
 * Lấy danh sách đề xuất
 * @param {number} userId - ID của tài khoản
 * @param {string} userRole - Role của user (ADMIN, MANAGER)
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số bản ghi mỗi trang
 * @returns {Promise<Object>} - Danh sách đề xuất
 */
async function getProposals(
  userId: string,
  userRole: string,
  page: string | number = 1,
  limit: string | number = 10
) {
  try {
    const pageNum = typeof page === 'string' ? parseInt(page) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit) : limit;
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    // Xây dựng điều kiện where
    let whereCondition: Record<string, any> = {};

    if (userRole === ROLES.MANAGER) {
      // Manager chỉ xem đề xuất của đơn vị mình
      const user = await prisma.taiKhoan.findUnique({
        where: { id: userId },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: true,
            },
          },
        },
      });

      if (!user || !user.QuanNhan) {
        throw new NotFoundError('Thông tin quân nhân');
      }

      const donViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;
      if (user.QuanNhan.co_quan_don_vi_id) {
        whereCondition.co_quan_don_vi_id = donViId;
      } else {
        whereCondition.don_vi_truc_thuoc_id = donViId;
      }
    }
    // ADMIN xem tất cả

    // Lấy danh sách và tổng số
    const [proposals, total] = await Promise.all([
      prisma.bangDeXuat.findMany({
        where: whereCondition,
        skip,
        take,
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          NguoiDeXuat: {
            include: {
              QuanNhan: true,
            },
          },
          NguoiDuyet: {
            include: {
              QuanNhan: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bangDeXuat.count({ where: whereCondition }),
    ]);

    return {
      proposals: proposals.map(p => ({
        id: p.id,
        loai_de_xuat: p.loai_de_xuat,
        nam: p.nam,
        don_vi: (p.DonViTrucThuoc || p.CoQuanDonVi)?.ten_don_vi || '-',
        nguoi_de_xuat: p.NguoiDeXuat.QuanNhan?.ho_ten || p.NguoiDeXuat.username,
        status: p.status,
        so_danh_hieu: Array.isArray(p.data_danh_hieu) ? p.data_danh_hieu.length : 0,
        so_thanh_tich: Array.isArray(p.data_thanh_tich) ? p.data_thanh_tich.length : 0,
        so_nien_han: Array.isArray(p.data_nien_han) ? p.data_nien_han.length : 0,
        so_cong_hien: Array.isArray(p.data_cong_hien) ? p.data_cong_hien.length : 0,
        nguoi_duyet: p.NguoiDuyet?.QuanNhan?.ho_ten || null,
        ngay_duyet: p.ngay_duyet,
        ghi_chu: p.ghi_chu,
        createdAt: p.createdAt,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / take),
      },
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Lấy chi tiết 1 đề xuất
 * @param {number} proposalId - ID của đề xuất
 * @param {number} userId - ID của tài khoản
 * @param {string} userRole - Role của user
 * @returns {Promise<Object>} - Chi tiết đề xuất
 */
async function getProposalById(proposalId: string, userId: string, userRole: string) {
  try {
    const proposal = await prisma.bangDeXuat.findUnique({
      where: { id: proposalId },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        NguoiDeXuat: {
          include: {
            QuanNhan: {
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
        },
        NguoiDuyet: {
          include: {
            QuanNhan: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('Đề xuất');
    }

    // Kiểm tra quyền truy cập
    if (userRole === ROLES.MANAGER) {
      const user = await prisma.taiKhoan.findUnique({
        where: { id: userId },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: true,
            },
          },
        },
      });

      if (user && user.QuanNhan) {
        const userDonViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;
        const proposalDonViId = proposal.co_quan_don_vi_id || proposal.don_vi_truc_thuoc_id;

        if (userDonViId !== proposalDonViId) {
          throw new ForbiddenError('Bạn không có quyền xem đề xuất này');
        }
      }
    }

    // Đảm bảo data_danh_hieu, data_thanh_tich và data_nien_han luôn là array
    let dataDanhHieu = (
      Array.isArray(proposal.data_danh_hieu)
        ? proposal.data_danh_hieu
        : proposal.data_danh_hieu
          ? [proposal.data_danh_hieu]
          : []
    ) as Record<string, any>[];

    let dataThanhTich = (
      Array.isArray(proposal.data_thanh_tich)
        ? proposal.data_thanh_tich
        : proposal.data_thanh_tich
          ? [proposal.data_thanh_tich]
          : []
    ) as Record<string, any>[];

    let dataNienHan = (
      Array.isArray(proposal.data_nien_han)
        ? proposal.data_nien_han
        : proposal.data_nien_han
          ? [proposal.data_nien_han]
          : []
    ) as Record<string, any>[];

    let dataCongHien = (
      Array.isArray(proposal.data_cong_hien)
        ? proposal.data_cong_hien
        : proposal.data_cong_hien
          ? [proposal.data_cong_hien]
          : []
    ) as Record<string, any>[];

    // Enrich thông tin quân nhân/đơn vị nếu thiếu (dữ liệu cũ)
    // Xử lý riêng cho DON_VI_HANG_NAM (khen thưởng tập thể)
    if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      // Enrich dataDanhHieu cho khen thưởng tập thể
      dataDanhHieu = await Promise.all(
        dataDanhHieu.map(async item => {
          // Nếu đã có đầy đủ thông tin, không cần enrich
          if (item.ten_don_vi && item.ma_don_vi) {
            return {
              ...item,
              nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
            };
          }

          // Enrich thông tin đơn vị nếu thiếu
          let donViInfo = null;
          let coQuanDonViCha = null;

          if (item.don_vi_type === 'CO_QUAN_DON_VI' && item.don_vi_id) {
            const donVi = await prisma.coQuanDonVi.findUnique({
              where: { id: item.don_vi_id },
              select: {
                id: true,
                ten_don_vi: true,
                ma_don_vi: true,
              },
            });
            donViInfo = donVi;
          } else if (item.don_vi_type === 'DON_VI_TRUC_THUOC' && item.don_vi_id) {
            const donVi = await prisma.donViTrucThuoc.findUnique({
              where: { id: item.don_vi_id },
              include: {
                CoQuanDonVi: {
                  select: {
                    id: true,
                    ten_don_vi: true,
                    ma_don_vi: true,
                  },
                },
              },
            });
            donViInfo = {
              id: donVi.id,
              ten_don_vi: donVi.ten_don_vi,
              ma_don_vi: donVi.ma_don_vi,
            };
            coQuanDonViCha = donVi.CoQuanDonVi;
          }

          return {
            ...item,
            ten_don_vi: item.ten_don_vi || donViInfo?.ten_don_vi || '',
            ma_don_vi: item.ma_don_vi || donViInfo?.ma_don_vi || '',
            nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
            co_quan_don_vi_cha: item.co_quan_don_vi_cha || coQuanDonViCha,
          };
        })
      );
    } else {
      // Xử lý cho các loại khen thưởng cá nhân
      const allPersonnelIds = [
        ...dataDanhHieu.map(d => d.personnel_id).filter(Boolean),
        ...dataThanhTich.map(d => d.personnel_id).filter(Boolean),
        ...dataNienHan.map(d => d.personnel_id).filter(Boolean),
        ...dataCongHien.map(d => d.personnel_id).filter(Boolean),
      ];

      // Khởi tạo personnelMap trước để tránh lỗi undefined
      const personnelMap = {};

      if (allPersonnelIds.length > 0) {
        // Fetch thông tin quân nhân và đơn vị
        const personnelList = await prisma.quanNhan.findMany({
          where: {
            id: {
              in: allPersonnelIds,
            },
          },
          select: {
            id: true,
            ho_ten: true,
            cap_bac: true,
            CoQuanDonVi: {
              select: {
                id: true,
                ten_don_vi: true,
                ma_don_vi: true,
              },
            },
            DonViTrucThuoc: {
              select: {
                id: true,
                ten_don_vi: true,
                ma_don_vi: true,
                co_quan_don_vi_id: true,
                CoQuanDonVi: {
                  select: {
                    id: true,
                    ten_don_vi: true,
                    ma_don_vi: true,
                  },
                },
              },
            },
            ChucVu: {
              select: {
                id: true,
                ten_chuc_vu: true,
              },
            },
          },
        });

        personnelList.forEach(p => {
          personnelMap[p.id] = p;
        });

        // Helper to enrich a data item with personnel info
        const enrichItem = item => {
          const personnel = personnelMap[item.personnel_id];
          const enrichedItem = {
            ...item,
            ho_ten: item.ho_ten || personnel?.ho_ten || '',
            nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
            cap_bac: item.cap_bac !== undefined && item.cap_bac !== null ? item.cap_bac : null,
            chuc_vu: item.chuc_vu !== undefined && item.chuc_vu !== null ? item.chuc_vu : null,
          };

          if (!item.co_quan_don_vi && personnel?.CoQuanDonVi) {
            enrichedItem.co_quan_don_vi = {
              id: personnel.CoQuanDonVi.id,
              ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
              ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
            };
          }
          if (!item.don_vi_truc_thuoc && personnel?.DonViTrucThuoc) {
            enrichedItem.don_vi_truc_thuoc = {
              id: personnel.DonViTrucThuoc.id,
              ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
              ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
              co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                ? {
                    id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                    ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                    ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                  }
                : null,
            };
          }

          return enrichedItem;
        };

        // Enrich all data arrays
        dataDanhHieu = dataDanhHieu.map(enrichItem);
        dataThanhTich = dataThanhTich.map(enrichItem);
        dataNienHan = dataNienHan.map(enrichItem);
        dataCongHien = dataCongHien.map(enrichItem);
      }
    }

    // Nếu proposal đã được approve, enrich với thông tin file PDF từ database
    // Xử lý cho dataDanhHieu (CA_NHAN_HANG_NAM, DOT_XUAT)
    // CONG_HIEN sẽ được xử lý riêng ở phần data_cong_hien
    if (
      proposal.status === PROPOSAL_STATUS.APPROVED &&
      dataDanhHieu.length > 0 &&
      proposal.loai_de_xuat !== PROPOSAL_TYPES.CONG_HIEN
    ) {
      if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        // Với khen thưởng tập thể, file PDF đã được lưu trong data đề xuất khi approve
        // Không cần enrich từ database khác vì không có bảng riêng cho khen thưởng tập thể
        // File PDF đã được lưu trong item.file_quyet_dinh khi approve
      } else {
        // Lấy danh hiệu từ database dựa trên personnel_id (cho khen thưởng cá nhân)
        const personnelIds = dataDanhHieu.map(d => d.personnel_id).filter(Boolean);
        if (personnelIds.length > 0) {
          const danhHieuFromDB = await prisma.danhHieuHangNam.findMany({
            where: {
              quan_nhan_id: { in: personnelIds },
              nam: proposal.nam,
            },
            include: {
              QuanNhan: {
                select: { id: true },
              },
            },
          });

          const danhHieuMap = {};
          danhHieuFromDB.forEach(dh => {
            const personnelId = dh.quan_nhan_id;
            if (!danhHieuMap[personnelId]) {
              danhHieuMap[personnelId] = [];
            }
            danhHieuMap[personnelId].push(dh);
          });

          // Enrich dataDanhHieu với file PDF và số quyết định
          dataDanhHieu = dataDanhHieu.map(item => {
            const dbRecords = danhHieuMap[item.personnel_id] || [];
            const matchingRecord = dbRecords.find(
              r => r.danh_hieu === item.danh_hieu && r.nam === item.nam
            );
            if (matchingRecord) {
              return {
                ...item,
                so_quyet_dinh: matchingRecord.so_quyet_dinh || item.so_quyet_dinh,
                file_quyet_dinh: matchingRecord.file_quyet_dinh,
                file_quyet_dinh_bkbqp: matchingRecord.file_quyet_dinh_bkbqp,
                file_quyet_dinh_cstdtq: matchingRecord.file_quyet_dinh_cstdtq,
              };
            }
            return item;
          });
        }
      }
    }

    // Nếu proposal đã được approve, enrich với thông tin file PDF từ database cho dataNienHan
    if (proposal.status === PROPOSAL_STATUS.APPROVED && dataNienHan.length > 0) {
      const nienHanTypes: ProposalType[] = [
        PROPOSAL_TYPES.NIEN_HAN,
        PROPOSAL_TYPES.HC_QKQT,
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      ];
      if (nienHanTypes.includes(proposal.loai_de_xuat as ProposalType)) {
        const personnelIds = dataNienHan.map(d => d.personnel_id).filter(Boolean);
        if (personnelIds.length > 0) {
          // Lấy dữ liệu từ bảng KhenThuongHCCSVV, HuanChuongQuanKyQuyetThang, KyNiemChuongVSNXDQDNDVN
          if (proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN) {
            const hccsvvFromDB = await prisma.khenThuongHCCSVV.findMany({
              where: {
                quan_nhan_id: { in: personnelIds },
                nam: proposal.nam,
              },
            });

            const hccsvvMap = {};
            hccsvvFromDB.forEach(dh => {
              const key = `${dh.quan_nhan_id}_${dh.danh_hieu}`;
              hccsvvMap[key] = dh;
            });

            // Enrich dataNienHan với file PDF và số quyết định
            dataNienHan = dataNienHan.map(item => {
              const key = `${item.personnel_id}_${item.danh_hieu}`;
              const dbRecord = hccsvvMap[key];
              if (dbRecord) {
                return {
                  ...item,
                  so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
                  file_quyet_dinh: dbRecord.file_quyet_dinh,
                  thoi_gian: dbRecord.thoi_gian || item.thoi_gian,
                };
              }
              return item;
            });
          } else if (proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT) {
            const hcqkqtFromDB = await prisma.huanChuongQuanKyQuyetThang.findMany({
              where: {
                quan_nhan_id: { in: personnelIds },
                nam: proposal.nam,
              },
            });

            const hcqkqtMap = {};
            hcqkqtFromDB.forEach(dh => {
              hcqkqtMap[dh.quan_nhan_id] = dh;
            });

            // Enrich dataNienHan với file PDF và số quyết định
            dataNienHan = dataNienHan.map(item => {
              const dbRecord = hcqkqtMap[item.personnel_id];
              if (dbRecord) {
                return {
                  ...item,
                  so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
                  file_quyet_dinh: dbRecord.file_quyet_dinh,
                  thoi_gian: dbRecord.thoi_gian || item.thoi_gian,
                };
              }
              return item;
            });
          } else if (proposal.loai_de_xuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
            const kncFromDB = await prisma.kyNiemChuongVSNXDQDNDVN.findMany({
              where: {
                quan_nhan_id: { in: personnelIds },
                nam: proposal.nam,
              },
            });

            const kncMap = {};
            kncFromDB.forEach(dh => {
              kncMap[dh.quan_nhan_id] = dh;
            });

            // Enrich dataNienHan với file PDF và số quyết định
            dataNienHan = dataNienHan.map(item => {
              const dbRecord = kncMap[item.personnel_id];
              if (dbRecord) {
                return {
                  ...item,
                  so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
                  file_quyet_dinh: dbRecord.file_quyet_dinh,
                  thoi_gian: dbRecord.thoi_gian || item.thoi_gian,
                };
              }
              return item;
            });
          }
        }
      }
    }

    // Nếu proposal đã được approve, enrich với thông tin file PDF từ database cho dataCongHien
    if (
      proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN &&
      proposal.status === PROPOSAL_STATUS.APPROVED &&
      dataCongHien.length > 0
    ) {
      const personnelIds = dataCongHien.map(d => d.personnel_id).filter(Boolean);
      if (personnelIds.length > 0) {
        const congHienFromDB = await prisma.khenThuongCongHien.findMany({
          where: {
            quan_nhan_id: { in: personnelIds },
          },
        });

        const congHienMap = {};
        congHienFromDB.forEach(dh => {
          congHienMap[dh.quan_nhan_id] = dh;
        });

        // Enrich dataCongHien với file PDF và số quyết định
        dataCongHien = dataCongHien.map(item => {
          const dbRecord = congHienMap[item.personnel_id];
          if (dbRecord) {
            return {
              ...item,
              so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
              file_quyet_dinh: dbRecord.file_quyet_dinh,
              thoi_gian_nhom_0_7: dbRecord.thoi_gian_nhom_0_7 || item.thoi_gian_nhom_0_7,
              thoi_gian_nhom_0_8: dbRecord.thoi_gian_nhom_0_8 || item.thoi_gian_nhom_0_8,
              thoi_gian_nhom_0_9_1_0:
                dbRecord.thoi_gian_nhom_0_9_1_0 || item.thoi_gian_nhom_0_9_1_0,
            };
          }
          return item;
        });
      }
    }

    return {
      id: proposal.id,
      loai_de_xuat: proposal.loai_de_xuat,
      nam: proposal.nam,
      don_vi: {
        id: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.id || null,
        ma_don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ma_don_vi || '',
        ten_don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '',
      },
      nguoi_de_xuat: {
        id: proposal.NguoiDeXuat.id,
        username: proposal.NguoiDeXuat.username,
        ho_ten: proposal.NguoiDeXuat.QuanNhan?.ho_ten,
      },
      status: proposal.status,
      data_danh_hieu: dataDanhHieu,
      data_thanh_tich: dataThanhTich,
      data_nien_han: dataNienHan,
      data_cong_hien: dataCongHien,
      files_attached: proposal.files_attached || [],
      ghi_chu: proposal.ghi_chu,
      rejection_reason: proposal.rejection_reason || null,
      nguoi_duyet: proposal.NguoiDuyet
        ? {
            id: proposal.NguoiDuyet.id,
            username: proposal.NguoiDuyet.username,
            ho_ten: proposal.NguoiDuyet.QuanNhan?.ho_ten,
          }
        : null,
      ngay_duyet: proposal.ngay_duyet,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Xóa đề xuất (chỉ Manager có thể xóa đề xuất của chính mình, và chỉ khi status = PENDING)
 * @param {number} proposalId - ID của đề xuất
 * @param {number} userId - ID của tài khoản
 * @param {string} userRole - Role của user
 * @returns {Promise<Object>} - Kết quả xóa
 */
async function deleteProposal(proposalId, userId, userRole) {
  try {
    const proposal = await prisma.bangDeXuat.findUnique({
      where: { id: proposalId },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        NguoiDeXuat: {
          include: {
            QuanNhan: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('Đề xuất');
    }

    // Kiểm tra quyền: Manager chỉ có thể xóa đề xuất của chính mình
    if (userRole === ROLES.MANAGER) {
      if (proposal.nguoi_de_xuat_id !== userId) {
        throw new ForbiddenError('Bạn chỉ có thể xóa đề xuất của chính mình');
      }
      // Manager chỉ có thể xóa đề xuất chưa được duyệt
      if (proposal.status !== PROPOSAL_STATUS.PENDING) {
        throw new ValidationError('Chỉ có thể xóa đề xuất đang chờ duyệt (PENDING)');
      }
    }
    // ADMIN có thể xóa bất kỳ đề xuất nào

    // File PDF đã được lưu trong files_attached, không cần xóa riêng

    // Atomic delete: chỉ xoá nếu status vẫn là PENDING (tránh race condition)
    const deleteResult = await prisma.bangDeXuat.deleteMany({
      where: { id: proposalId, status: PROPOSAL_STATUS.PENDING },
    });

    if (deleteResult.count === 0) {
      throw new ValidationError(
        'Đề xuất đã bị thay đổi bởi người khác (có thể đã được phê duyệt hoặc từ chối). Vui lòng tải lại trang.'
      );
    }

    return {
      message: 'Đã xóa đề xuất thành công',
      proposal: {
        id: proposal.id,
        don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
        status: proposal.status,
      },
    };
  } catch (error) {
    throw error;
  }
}

export { getUserWithUnit, getProposals, getProposalById, deleteProposal };
