import { danhHieuHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../repositories/unit.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { militaryFlagRepository } from '../../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { accountRepository } from '../../repositories/account.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import type { Prisma } from '../../generated/prisma';
import { ROLES } from '../../constants/roles.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';

/**
 * Fetches user with their associated QuanNhan and unit relations.
 * @param userId - Account ID
 * @returns User record with QuanNhan included, or null if not found
 */
async function getUserWithUnit(userId: string) {
  return await accountRepository.findUniqueRaw({
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
 * Returns paginated proposals filtered by role — ADMIN sees all, MANAGER sees own unit only.
 * @param userId - Caller's account ID
 * @param userRole - Caller's role (ADMIN or MANAGER)
 * @param page - Page number (1-based)
 * @param limit - Records per page
 * @returns Paginated proposal list with total count
 */
async function getProposals(
  userId: string,
  userRole: string,
  page: number = 1,
  limit: number = 10
) {
  const skip = (page - 1) * limit;

  let whereCondition: Prisma.BangDeXuatWhereInput = {};

  if (userRole === ROLES.MANAGER) {
    // Manager can only view proposals from their own unit
    const user = await accountRepository.findUniqueRaw({
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

  const [proposals, total] = await Promise.all([
    proposalRepository.findManyRaw({
      where: whereCondition,
      skip,
      take: limit,
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
    proposalRepository.count(whereCondition),
  ]);

  return {
    proposals: proposals.map(p => ({
      id: p.id,
      loai_de_xuat: p.loai_de_xuat,
      nam: p.nam,
      thang: p.thang,
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
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Returns full detail of a single proposal; enforces unit-based visibility for MANAGER.
 * @param proposalId - Proposal ID
 * @param userId - Caller's account ID
 * @param userRole - Caller's role
 * @returns Proposal with all related data included
 */
async function getProposalById(proposalId: string, userId: string, userRole: string) {
  const proposal = await proposalRepository.findUniqueRaw({
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

  if (userRole === ROLES.MANAGER) {
    const user = await accountRepository.findUniqueRaw({
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

  // Ensure these are always arrays even if stored as null
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

  // Enrich stale records with latest personnel/unit data
  if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    dataDanhHieu = await Promise.all(
      dataDanhHieu.map(async item => {
        if (item.ten_don_vi && item.ma_don_vi) {
          return {
            ...item,
            nam: item.nam ?? proposal.createdAt.getFullYear(),
          };
        }

        let donViInfo = null;
        let coQuanDonViCha = null;

        if (item.don_vi_type === 'CO_QUAN_DON_VI' && item.don_vi_id) {
          const donVi = await coQuanDonViRepository.findLightById(item.don_vi_id);
          donViInfo = donVi;
        } else if (item.don_vi_type === 'DON_VI_TRUC_THUOC' && item.don_vi_id) {
          const selectedDonVi = await donViTrucThuocRepository.findUniqueRaw({
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
          if (selectedDonVi) {
            donViInfo = {
              id: selectedDonVi.id,
              ten_don_vi: selectedDonVi.ten_don_vi,
              ma_don_vi: selectedDonVi.ma_don_vi,
            };
            coQuanDonViCha = selectedDonVi.CoQuanDonVi;
          }
        }

        return {
          ...item,
          ten_don_vi: item.ten_don_vi || donViInfo?.ten_don_vi || '',
          ma_don_vi: item.ma_don_vi || donViInfo?.ma_don_vi || '',
          nam: item.nam ?? proposal.createdAt.getFullYear(),
          co_quan_don_vi_cha: item.co_quan_don_vi_cha || coQuanDonViCha,
        };
      })
    );
  } else {
    const allPersonnelIds = [
      ...dataDanhHieu.map(d => d.personnel_id).filter(Boolean),
      ...dataThanhTich.map(d => d.personnel_id).filter(Boolean),
      ...dataNienHan.map(d => d.personnel_id).filter(Boolean),
      ...dataCongHien.map(d => d.personnel_id).filter(Boolean),
    ];

    // Init map before the loop to avoid undefined reference
    const personnelMap = {};

    if (allPersonnelIds.length > 0) {
      const personnelList = await quanNhanRepository.findManyRaw({
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
      const enrichItem = (item: Record<string, any>) => {
        const personnel = personnelMap[item.personnel_id];
        const enrichedItem: Record<string, any> = {
          ...item,
          ho_ten: item.ho_ten || personnel?.ho_ten || '',
          nam: item.nam ?? proposal.createdAt.getFullYear(),
          cap_bac: item.cap_bac ?? null,
          chuc_vu: item.chuc_vu ?? null,
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

  // Approved proposals only: hydrate PDF paths from persisted awards (data_cong_hien has its own branch).
  if (
    proposal.status === PROPOSAL_STATUS.APPROVED &&
    dataDanhHieu.length > 0 &&
    proposal.loai_de_xuat !== PROPOSAL_TYPES.CONG_HIEN
  ) {
    if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      // Unit award PDF is stored in the proposal data at approval time
    } else {
      const personnelIds = dataDanhHieu.map(d => d.personnel_id).filter(Boolean);
      if (personnelIds.length > 0) {
        const danhHieuFromDB = await danhHieuHangNamRepository.findMany({
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

        dataDanhHieu = dataDanhHieu.map((item: Record<string, any>) => {
          const dbRecords = (danhHieuMap[item.personnel_id] || []) as Record<string, any>[];
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

  if (proposal.status === PROPOSAL_STATUS.APPROVED && dataNienHan.length > 0) {
    const nienHanTypes: ProposalType[] = [
      PROPOSAL_TYPES.NIEN_HAN,
      PROPOSAL_TYPES.HC_QKQT,
      PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    ];
    if (nienHanTypes.includes(proposal.loai_de_xuat as ProposalType)) {
      const personnelIds = dataNienHan.map(d => d.personnel_id).filter(Boolean);
      if (personnelIds.length > 0) {
        if (proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN) {
          const hccsvvFromDB = await tenureMedalRepository.findManyRaw({
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
          const hcqkqtFromDB = await militaryFlagRepository.findManyRaw({
            where: {
              quan_nhan_id: { in: personnelIds },
              nam: proposal.nam,
            },
          });

          const hcqkqtMap = {};
          hcqkqtFromDB.forEach(dh => {
            hcqkqtMap[dh.quan_nhan_id] = dh;
          });

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
          const kncFromDB = await commemorativeMedalRepository.findManyRaw({
            where: {
              quan_nhan_id: { in: personnelIds },
              nam: proposal.nam,
            },
          });

          const kncMap = {};
          kncFromDB.forEach(dh => {
            kncMap[dh.quan_nhan_id] = dh;
          });

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

  if (
    proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN &&
    proposal.status === PROPOSAL_STATUS.APPROVED &&
    dataCongHien.length > 0
  ) {
    const personnelIds = dataCongHien.map(d => d.personnel_id).filter(Boolean);
    if (personnelIds.length > 0) {
      const congHienFromDB = await contributionMedalRepository.findManyRaw({
        where: {
          quan_nhan_id: { in: personnelIds },
        },
      });

      const congHienMap = {};
      congHienFromDB.forEach(dh => {
        congHienMap[dh.quan_nhan_id] = dh;
      });

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
    thang: proposal.thang,
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
}

/**
 * Deletes a proposal — only the owning MANAGER can delete, and only when status is PENDING.
 * @param proposalId - Proposal ID
 * @param userId - Caller's account ID
 * @param userRole - Caller's role
 * @returns Deleted proposal record
 */
async function deleteProposal(proposalId: string, userId: string, userRole: string) {
  const proposal = await proposalRepository.findUniqueRaw({
    where: { id: proposalId },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: {
        include: {
          CoQuanDonVi: true,
        },
      },
      NguoiDeXuat: {
        select: { id: true, username: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
    },
  });

  if (!proposal) {
    throw new NotFoundError('Đề xuất');
  }

  // Manager can only delete their own proposals
  if (userRole === ROLES.MANAGER) {
    if (proposal.nguoi_de_xuat_id !== userId) {
      throw new ForbiddenError('Bạn chỉ có thể xóa đề xuất của chính mình');
    }
    // Manager can only delete pending proposals
    if (proposal.status !== PROPOSAL_STATUS.PENDING) {
      throw new ValidationError('Chỉ có thể xóa đề xuất đang chờ duyệt (PENDING)');
    }
  }

  // PDFs are in files_attached — no separate deletion needed

  // Atomic delete guarded by status=PENDING to prevent race condition
  const deleteResult = await proposalRepository.deleteMany({
    id: proposalId,
    status: PROPOSAL_STATUS.PENDING,
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
}

export { getUserWithUnit, getProposals, getProposalById, deleteProposal };
