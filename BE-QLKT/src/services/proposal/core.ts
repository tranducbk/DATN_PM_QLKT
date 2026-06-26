import { danhHieuHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { militaryFlagRepository } from '../../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { accountRepository } from '../../repositories/account.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import type { Prisma } from '../../generated/prisma';
import { ROLES } from '../../constants/roles.constants';
import {
  PROPOSAL_TYPES,
  PROPOSAL_SUBMITTER_DELETED_LABEL,
  type ProposalType,
} from '../../constants/proposalTypes.constants';
import { UNIT_TYPE } from '../../constants/unitType.constants';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import type {
  ProposalDanhHieuItem,
  ProposalThanhTichItem,
  ProposalNienHanItem,
  ProposalCongHienItem,
} from '../../types/proposal';

type AnyProposalDataItem =
  | ProposalDanhHieuItem
  | ProposalThanhTichItem
  | ProposalNienHanItem
  | ProposalCongHienItem;

/** Normalizes a Prisma JSON column into a typed array (single object → one-element array). */
function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return value ? [value as T] : [];
}

interface NienHanMedalRecord {
  quan_nhan_id: string;
  danh_hieu?: string | null;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  thoi_gian?: unknown;
}

type NienHanEnrichConfig = {
  fetch: (personnelIds: string[], nam: number) => Promise<NienHanMedalRecord[]>;
  recordKey: (record: NienHanMedalRecord) => string;
  itemKey: (item: ProposalNienHanItem) => string;
};

// Approved tenure-family proposals hydrate so_quyet_dinh/file_quyet_dinh/thoi_gian from the
// persisted medal table. Only the source repo and match key differ per type; the merge is
// identical, so per-type variance lives here instead of three near-duplicate branches.
const NIEN_HAN_ENRICH: Partial<Record<ProposalType, NienHanEnrichConfig>> = {
  [PROPOSAL_TYPES.NIEN_HAN]: {
    fetch: (ids, nam) =>
      tenureMedalRepository.findManyRaw({ where: { quan_nhan_id: { in: ids }, nam } }),
    recordKey: r => `${r.quan_nhan_id}_${r.danh_hieu}`,
    itemKey: i => `${i.personnel_id}_${i.danh_hieu}`,
  },
  [PROPOSAL_TYPES.HC_QKQT]: {
    fetch: (ids, nam) =>
      militaryFlagRepository.findManyRaw({ where: { quan_nhan_id: { in: ids }, nam } }),
    recordKey: r => String(r.quan_nhan_id),
    itemKey: i => String(i.personnel_id),
  },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
    fetch: (ids, nam) =>
      commemorativeMedalRepository.findManyRaw({ where: { quan_nhan_id: { in: ids }, nam } }),
    recordKey: r => String(r.quan_nhan_id),
    itemKey: i => String(i.personnel_id),
  },
};

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

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  GET PROPOSALS — list đề xuất với role-based filter (truy vấn nghiệp vụ)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ROLE VISIBILITY:
 *  - ADMIN / SUPER_ADMIN: thấy TẤT CẢ đề xuất (where={}).
 *  - MANAGER: chỉ thấy đề xuất từ đơn vị mình:
 *      WHERE (co_quan_don_vi_id = X OR don_vi_truc_thuoc_id = X)
 *    Trong đó X = đơn vị manager đang quản lý.
 *
 *  WHY KHÔNG check MANAGER xem được đề xuất do MÌNH submit thôi:
 *  - Manager là chỉ huy đơn vị → thấy đề xuất của TẤT CẢ trợ lý cùng
 *    đơn vị mình submit (vai trò giám sát).
 *  - Filter theo unit chứ không phải theo nguoi_de_xuat_id.
 *
 *  PERFORMANCE:
 *  - Promise.all gộp findManyRaw + count → 2 query parallel thay vì
 *    sequential. Pagination cần TOTAL count để FE tính totalPages.
 *  - Index trên (status, loai_de_xuat) cho list filtered.
 *  - JOIN CoQuanDonVi + DonViTrucThuoc + NguoiDeXuat + NguoiDuyet trong
 *    `include` → 1 query với JOIN thay vì N+1.
 *
 *  POST-PROCESS shape:
 *  Map raw Prisma result thành lighter response (chỉ field cần dùng):
 *      { id, loai_de_xuat, nam, don_vi, nguoi_de_xuat, status, counters }
 *  → tiết kiệm bandwidth + FE không phải null-check sâu.
 *
 *  COUNTER fields (so_danh_hieu, so_thanh_tich, ...):
 *  Đếm length của JSON array tại app layer:
 *      so_danh_hieu = Array.isArray(data_danh_hieu) ? data_danh_hieu.length : 0
 *  → Tránh JSON aggregate query phức tạp ở DB. Trade-off: load full JSON
 *  vào RAM rồi mới đếm — chấp nhận vì JSON nhỏ (vài trăm bytes).
 * ════════════════════════════════════════════════════════════════════════════
 */
async function getProposals(
  userId: string,
  userRole: string,
  page: number = 1,
  limit: number = 10
) {
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.BangDeXuatWhereInput = {};

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
      nguoi_de_xuat:
        p.NguoiDeXuat?.QuanNhan?.ho_ten ||
        p.NguoiDeXuat?.username ||
        PROPOSAL_SUBMITTER_DELETED_LABEL,
      status: p.status,
      so_danh_hieu: Array.isArray(p.data_danh_hieu) ? p.data_danh_hieu.length : 0,
      so_thanh_tich: Array.isArray(p.data_thanh_tich) ? p.data_thanh_tich.length : 0,
      so_nien_han: Array.isArray(p.data_nien_han) ? p.data_nien_han.length : 0,
      so_cong_hien: Array.isArray(p.data_cong_hien) ? p.data_cong_hien.length : 0,
      nguoi_duyet:
        p.NguoiDuyet?.QuanNhan?.ho_ten ||
        p.NguoiDuyet?.username ||
        (p.ngay_duyet ? PROPOSAL_SUBMITTER_DELETED_LABEL : null),
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
  const [proposal, manager] = await Promise.all([
    proposalRepository.findUniqueRaw({
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
    }),
    userRole === ROLES.MANAGER
      ? accountRepository.findUniqueRaw({
          where: { id: userId },
          select: {
            QuanNhan: { select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!proposal) {
    throw new NotFoundError('Đề xuất');
  }

  if (userRole === ROLES.MANAGER && manager?.QuanNhan) {
    const userDonViId = manager.QuanNhan.co_quan_don_vi_id || manager.QuanNhan.don_vi_truc_thuoc_id;
    const proposalDonViId = proposal.co_quan_don_vi_id || proposal.don_vi_truc_thuoc_id;

    if (userDonViId !== proposalDonViId) {
      throw new ForbiddenError('Bạn không có quyền xem đề xuất này');
    }
  }

  let dataDanhHieu = toArray<ProposalDanhHieuItem>(proposal.data_danh_hieu);
  let dataThanhTich = toArray<ProposalThanhTichItem>(proposal.data_thanh_tich);
  let dataNienHan = toArray<ProposalNienHanItem>(proposal.data_nien_han);
  let dataCongHien = toArray<ProposalCongHienItem>(proposal.data_cong_hien);

  // Enrich stale records with latest personnel/unit data
  if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    const fallbackYear = proposal.createdAt.getFullYear();
    const needsLookup = (item: ProposalDanhHieuItem) =>
      !(item.ten_don_vi && item.ma_don_vi) && Boolean(item.don_vi_id);

    const coQuanIds = dataDanhHieu
      .filter(i => needsLookup(i) && i.don_vi_type === UNIT_TYPE.CO_QUAN_DON_VI)
      .map(i => i.don_vi_id as string);
    const trucThuocIds = dataDanhHieu
      .filter(i => needsLookup(i) && i.don_vi_type === UNIT_TYPE.DON_VI_TRUC_THUOC)
      .map(i => i.don_vi_id as string);

    const [coQuanList, trucThuocList] = await Promise.all([
      coQuanIds.length
        ? coQuanDonViRepository.findManyRaw({
            where: { id: { in: coQuanIds } },
            select: { id: true, ten_don_vi: true, ma_don_vi: true },
          })
        : Promise.resolve([]),
      trucThuocIds.length
        ? donViTrucThuocRepository.findManyRaw({
            where: { id: { in: trucThuocIds } },
            select: {
              id: true,
              ten_don_vi: true,
              ma_don_vi: true,
              CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const coQuanMap = new Map(coQuanList.map(d => [d.id, d]));
    const trucThuocMap = new Map(trucThuocList.map(d => [d.id, d]));

    dataDanhHieu = dataDanhHieu.map(item => {
      if (item.ten_don_vi && item.ma_don_vi) {
        return { ...item, nam: item.nam ?? fallbackYear };
      }

      const trucThuoc =
        item.don_vi_type === UNIT_TYPE.DON_VI_TRUC_THUOC
          ? trucThuocMap.get(item.don_vi_id)
          : undefined;
      const coQuan =
        item.don_vi_type === UNIT_TYPE.CO_QUAN_DON_VI ? coQuanMap.get(item.don_vi_id) : undefined;
      const donViInfo = trucThuoc ?? coQuan ?? null;

      return {
        ...item,
        ten_don_vi: item.ten_don_vi || donViInfo?.ten_don_vi || '',
        ma_don_vi: item.ma_don_vi || donViInfo?.ma_don_vi || '',
        nam: item.nam ?? fallbackYear,
        co_quan_don_vi_cha: item.co_quan_don_vi_cha || trucThuoc?.CoQuanDonVi || null,
      };
    });
  } else {
    const allPersonnelIds = [
      ...dataDanhHieu.map(d => d.personnel_id).filter(Boolean),
      ...dataThanhTich.map(d => d.personnel_id).filter(Boolean),
      ...dataNienHan.map(d => d.personnel_id).filter(Boolean),
      ...dataCongHien.map(d => d.personnel_id).filter(Boolean),
    ];

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

      const enrichItem = <T extends AnyProposalDataItem>(item: T): T => {
        const personnel = item.personnel_id ? personnelMap[item.personnel_id] : undefined;
        const enrichedItem: T = {
          ...item,
          ho_ten: personnel?.ho_ten || item.ho_ten || '',
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

        dataDanhHieu = dataDanhHieu.map((item: ProposalDanhHieuItem) => {
          const personnelKey = item.personnel_id ?? '';
          const dbRecords = (danhHieuMap[personnelKey] || []) as Array<{
            danh_hieu: string;
            nam: number;
            so_quyet_dinh?: string | null;
            file_quyet_dinh?: string | null;
            file_quyet_dinh_bkbqp?: string | null;
            file_quyet_dinh_cstdtq?: string | null;
          }>;
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
    const enrich = NIEN_HAN_ENRICH[proposal.loai_de_xuat as ProposalType];
    const personnelIds = dataNienHan.map(d => d.personnel_id).filter(Boolean);
    if (enrich && personnelIds.length > 0) {
      const recordsFromDB = await enrich.fetch(personnelIds, proposal.nam);
      const dbMap: Record<string, NienHanMedalRecord> = {};
      recordsFromDB.forEach(record => {
        dbMap[enrich.recordKey(record)] = record;
      });

      dataNienHan = dataNienHan.map(item => {
        const dbRecord = dbMap[enrich.itemKey(item)];
        if (dbRecord) {
          return {
            ...item,
            so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
            file_quyet_dinh: dbRecord.file_quyet_dinh,
            thoi_gian: (dbRecord.thoi_gian as ProposalNienHanItem['thoi_gian']) || item.thoi_gian,
          };
        }
        return item;
      });
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
            thoi_gian_nhom_0_9_1_0: dbRecord.thoi_gian_nhom_0_9_1_0 || item.thoi_gian_nhom_0_9_1_0,
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
      id: proposal.NguoiDeXuat?.id ?? null,
      username: proposal.NguoiDeXuat?.username ?? null,
      ho_ten: proposal.NguoiDeXuat
        ? proposal.NguoiDeXuat.QuanNhan?.ho_ten
        : PROPOSAL_SUBMITTER_DELETED_LABEL,
    },
    status: proposal.status,
    data_danh_hieu: dataDanhHieu,
    data_thanh_tich: dataThanhTich,
    data_nien_han: dataNienHan,
    data_cong_hien: dataCongHien,
    files_attached: proposal.files_attached || [],
    files_attached_admin: proposal.files_attached_admin || [],
    ghi_chu: proposal.ghi_chu,
    rejection_reason: proposal.rejection_reason || null,
    nguoi_duyet: proposal.NguoiDuyet
      ? {
          id: proposal.NguoiDuyet.id,
          username: proposal.NguoiDuyet.username,
          ho_ten: proposal.NguoiDuyet.QuanNhan?.ho_ten,
        }
      : proposal.ngay_duyet
        ? { id: null, username: null, ho_ten: PROPOSAL_SUBMITTER_DELETED_LABEL }
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

  // ─── RACE-AWARE: optimistic locking khi DELETE ──────────────────
  // Manager bấm "Xoá đề xuất" CHỈ được khi status còn PENDING (chưa
  // duyệt). Race condition:
  //   T1 (Manager): SELECT thấy status=PENDING → tính sẽ xoá.
  //   T2 (Admin):   APPROVE → status=APPROVED → DB đã đổi.
  //   T1 → DELETE → nếu dùng deleteOne({id}) sẽ xoá luôn record đã
  //                  approve → MẤT data + corrupt audit trail.
  //
  // Dùng deleteMany với compound where (id + status=PENDING):
  //   - Nếu status đã đổi → count=0 → throw "đã bị thay đổi".
  //   - User refresh page → thấy proposal đã APPROVED → không cho xoá.
  //
  // Đây là CAS (Compare-And-Swap) operation — pattern phổ biến chống
  // lost update giữa read + delete.
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
      loai_de_xuat: proposal.loai_de_xuat,
      nam: proposal.nam,
      nguoi_de_xuat_id: proposal.nguoi_de_xuat_id,
      NguoiDeXuat: proposal.NguoiDeXuat,
    },
  };
}

export { getUserWithUnit, getProposals, getProposalById, deleteProposal };
