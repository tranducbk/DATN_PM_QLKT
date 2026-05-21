import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { danhHieuHangNamRepository } from '../repositories/danhHieu.repository';
import { contributionMedalRepository } from '../repositories/contributionMedal.repository';
import { accountRepository } from '../repositories/account.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { positionRepository } from '../repositories/position.repository';
import { positionHistoryRepository } from '../repositories/positionHistory.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../repositories/unit.repository';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import bcrypt from 'bcrypt';
import { parseCCCD } from '../helpers/cccdHelper';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  AppError,
} from '../middlewares/errorHandler';
import { buildUnitWhereFilter } from '../helpers/controllerHelper';
import { DEFAULT_PASSWORD } from '../configs';
import { adjustUnitCount } from './personnel/unitCount';
import { updatePersonnel as doUpdatePersonnel } from './personnel/update';
import type { UpdatePersonnelInput } from './personnel/update';

const HCBVTQ_LABEL = AWARD_LABELS[AWARD_SLUGS.CONTRIBUTION_MEDALS];

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  PERSONNEL SERVICE — quân nhân (QuanNhan) — core nghiệp vụ
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ENTITY trung tâm — TẤT CẢ khen thưởng đều ref tới QuanNhan.id qua FK.
 *
 *  CCCD = UNIQUE constraint (PII + business key):
 *  - 1 CCCD chỉ tồn tại 1 QuanNhan (mỗi công dân chỉ 1 căn cước).
 *  - Insert trùng CCCD → Prisma throw P2002 → service trả message
 *    "Quân nhân với CCCD này đã tồn tại".
 *  - parseCCCD chuẩn hoá pad zero trước khi check duplicate (tránh "123"
 *    và "000000000123" coi là 2 CCCD khác).
 *
 *  USERNAME = CCCD (default):
 *  - Khi admin tạo quân nhân, account.username AUTO = cccd.
 *  - Dễ nhớ + chống tạo trùng username (vì CCCD đã unique).
 *  - User đầu tiên login với password mặc định → buộc đổi.
 *
 *  UNIT ID dual field:
 *      QuanNhan có 2 field FK:
 *        co_quan_don_vi_id     (CQDV — cơ quan/đơn vị mẹ)
 *        don_vi_truc_thuoc_id  (DVTT — đơn vị trực thuộc)
 *      Chỉ 1 trong 2 được set (mutually exclusive — quân nhân thuộc CQDV
 *      hoặc DVTT, không cả hai). DVTT thuộc CQDV qua FK riêng.
 *
 *      Khi lấy "đơn vị của quân nhân" → DVTT ưu tiên hơn CQDV (DVTT là
 *      con cụ thể hơn, CQDV là cha):
 *        const donViId = qn.don_vi_truc_thuoc_id ?? qn.co_quan_don_vi_id;
 *
 *  SO_LUONG AUTO-MAINTAIN:
 *      CoQuanDonVi.so_luong + DonViTrucThuoc.so_luong = số quân nhân
 *      trong đơn vị (denormalized counter để query nhanh).
 *      Mỗi khi:
 *        - Tạo QuanNhan          → tăng so_luong của đơn vị tương ứng.
 *        - Xoá QuanNhan          → giảm so_luong.
 *        - Đổi đơn vị QuanNhan   → giảm đơn vị cũ + tăng đơn vị mới.
 *      Implementation: trong transaction để đảm bảo atomic.
 *      Pattern dùng `if/else` (KHÔNG 2 if riêng biệt) — xem CLAUDE.md
 *      mục Unit count để tránh đếm dư.
 *
 *  MANAGER UNIT FILTER:
 *  - getAllPersonnel với MANAGER role → filter chỉ trả quân nhân thuộc
 *    đơn vị manager mình. Logic ở `helpers/controllerHelper.ts`.
 *  - Manager CQDV thấy: chính mình + tất cả DVTT con + quân nhân DVTT.
 *  - Manager DVTT thấy: chỉ DVTT mình + quân nhân DVTT.
 *
 *  CASCADE DELETE chú ý:
 *  - Xoá QuanNhan → cascade delete TaiKhoan, DanhHieuHangNam, ... liên
 *    quan (FK onDelete: Cascade). RỦI RO: mất audit trail.
 *  - Tốt hơn: soft delete (flag `is_deleted`) — chưa implement.
 * ════════════════════════════════════════════════════════════════════════════
 */
class PersonnelService {
  parseCCCD(value) {
    return parseCCCD(value);
  }

  /**
   * Returns a paginated personnel list.
   * Admin can view all records.
   * Manager can only view records in their allowed units.
   */
  async getPersonnel(
    page = 1,
    limit = 10,
    userRole,
    userQuanNhanId,
    filters: Record<string, unknown> = {}
  ) {
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;
    const search = typeof filters.search === 'string' ? filters.search : undefined;
    const unit_id = typeof filters.unit_id === 'string' ? filters.unit_id : undefined;
    let whereCondition: Prisma.QuanNhanWhereInput = {};
    const andConditions = [];

    // Manager can only query personnel inside their unit scope.
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);

      if (manager) {
        const unitFilter = await buildUnitWhereFilter(manager);
        if (unitFilter) andConditions.push(unitFilter);
      }
    }

    // Optional unit filter — resolve whether unit_id is a CQDV or DVTT before building filter.
    if (unit_id) {
      const isCqdv = await coQuanDonViRepository.findIdById(unit_id);
      const unitFilter = isCqdv
        ? await buildUnitWhereFilter({ co_quan_don_vi_id: unit_id })
        : await buildUnitWhereFilter({ don_vi_truc_thuoc_id: unit_id });
      if (unitFilter) andConditions.push(unitFilter);
    }

    // Optional keyword search by name or CCCD.
    if (search && search.trim()) {
      const searchTerm = search.trim();
      andConditions.push({
        OR: [
          { ho_ten: { contains: searchTerm, mode: 'insensitive' } },
          { cccd: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    // Combine all filters with AND conditions.
    if (andConditions.length > 0) {
      whereCondition = {
        AND: andConditions,
      };
    }

    const [personnel, total] = await Promise.all([
      quanNhanRepository.findMany({ where: whereCondition, skip, take: limitNum }),
      quanNhanRepository.count(whereCondition),
    ]);

    return {
      personnel,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /** Returns one personnel record by id. */
  async getPersonnelById(id, userRole, userQuanNhanId) {
    const personnel = await quanNhanRepository.findByIdForDetail(String(id));

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // USER can only view their own profile.
    if (userRole === ROLES.USER && userQuanNhanId !== id) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin này');
    }

    // MANAGER can only view personnel in their unit scope.
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);

      if (manager && manager.co_quan_don_vi_id) {
        // Load all child units of manager's parent unit.
        const donViTrucThuocList = await donViTrucThuocRepository.findIdsByCoQuanDonViId(
          manager.co_quan_don_vi_id
        );
        const donViTrucThuocIds = donViTrucThuocList.map(dv => dv.id);

        // Allow if personnel belongs to parent unit or any child unit.
        const isInCoQuanDonVi = personnel.co_quan_don_vi_id === manager.co_quan_don_vi_id;
        const isInDonViTrucThuoc =
          personnel.don_vi_truc_thuoc_id &&
          donViTrucThuocIds.includes(personnel.don_vi_truc_thuoc_id);

        if (!isInCoQuanDonVi && !isInDonViTrucThuoc) {
          throw new ForbiddenError('Bạn không có quyền xem thông tin quân nhân ngoài đơn vị');
        }
      }
    }

    return personnel;
  }

  /** Creates a new personnel and auto-creates its account. */
  async createPersonnel(data) {
    const { cccd, unit_id, position_id, role = ROLES.USER } = data;

    const existingPersonnel = await quanNhanRepository.findIdByCccd(cccd);

    if (existingPersonnel) {
      throw new ValidationError('CCCD đã tồn tại trong hệ thống');
    }

    // Unit can be either CoQuanDonVi or DonViTrucThuoc.
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findById(unit_id),
      donViTrucThuocRepository.findById(unit_id),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Đơn vị');
    }

    const position = await positionRepository.findUniqueRaw({
      where: { id: position_id },
      select: { id: true },
    });

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }

    const username = cccd;

    const existingAccount = await accountRepository.findUniqueRaw({
      where: { username },
      select: { id: true },
    });

    if (existingAccount) {
      throw new ValidationError('Username (CCCD) đã tồn tại trong hệ thống tài khoản');
    }

    // Set unit foreign keys based on unit type.
    const isCoQuanDonVi = !!coQuanDonVi;
    let personnelData: Prisma.QuanNhanUncheckedCreateInput = {
      cccd,
      ho_ten: username,
      ngay_sinh: null,
      ngay_nhap_ngu: new Date(),
      chuc_vu_id: position_id,
    };

    if (isCoQuanDonVi) {
      personnelData.co_quan_don_vi_id = unit_id;
      personnelData.don_vi_truc_thuoc_id = null;
    } else {
      personnelData.co_quan_don_vi_id = null;
      personnelData.don_vi_truc_thuoc_id = unit_id;
    }

    // Hash password outside transaction to reduce lock duration.
    const defaultPassword = DEFAULT_PASSWORD || 'Hvkhqs@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Wrap all writes in one transaction for consistency.
    const result = await prisma.$transaction(async prismaTx => {
      const newPersonnel = await quanNhanRepository.create(personnelData, prismaTx);

      // Load position coefficient for initial history row.
      const chucVu = await positionRepository.findUniqueRaw({
        where: { id: position_id },
        select: { he_so_chuc_vu: true },
      }, prismaTx);

      // Create initial LichSuChucVu record.
      const ngayBatDau = new Date();
      await positionHistoryRepository.create(
        {
          quan_nhan_id: newPersonnel.id,
          chuc_vu_id: position_id,
          he_so_chuc_vu: Number(chucVu?.he_so_chuc_vu ?? 0),
          ngay_bat_dau: ngayBatDau,
          ngay_ket_thuc: null,
          so_thang: null,
        },
        prismaTx
      );

      // Create linked account.
      const account = await prismaTx.taiKhoan.create({
        data: {
          username,
          password_hash: hashedPassword,
          role: role,
          quan_nhan_id: newPersonnel.id,
        },
      });

      await adjustUnitCount(prismaTx, unit_id, isCoQuanDonVi, 'increment');

      // Return personnel with account data.
      return {
        ...newPersonnel,
        TaiKhoan: {
          id: account.id,
          username: account.username,
          role: account.role,
        },
      };
    });

    return result;
  }

  /**
   * Updates personnel data, including unit and position reassignment.
   * @param id - Personnel ID to update
   * @param data - Fields to update
   * @param userRole - Role of the requesting user
   * @param userQuanNhanId - QuanNhan ID of the requesting user
   * @param adminUsername - Username for transfer notification
   */
  async updatePersonnel(
    id: string,
    data: UpdatePersonnelInput,
    userRole: string,
    userQuanNhanId: string,
    adminUsername: string
  ) {
    return doUpdatePersonnel(id, data, userRole, userQuanNhanId, adminUsername);
  }

  /**
   * Deletes personnel and all related records through cascade constraints.
   * Cascade covers accounts, histories, awards, and annual profile snapshots.
   */
  async deletePersonnel(id, userRole, userQuanNhanId) {
    const personnel = await quanNhanRepository.findByIdWithAccount(String(id));

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Only ADMIN and SUPER_ADMIN can delete personnel.
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Chỉ Admin mới có quyền xóa quân nhân');
    }

    // Prevent self-delete.
    if (userQuanNhanId === id) {
      throw new ValidationError('Không thể xóa chính mình');
    }

    // Keep unit id to adjust personnel count after delete.
    const unitId = personnel.don_vi_truc_thuoc_id || personnel.co_quan_don_vi_id;
    const isCoQuanDonVi = !personnel.don_vi_truc_thuoc_id && !!personnel.co_quan_don_vi_id;

    // Use transaction for full cascade delete.
    await prisma.$transaction(async prismaTx => {
      // Delete linked account.
      if (personnel.TaiKhoan) {
        await prismaTx.taiKhoan.delete({
          where: { id: personnel.TaiKhoan.id },
        });
      }

      // Delete position history.
      await prismaTx.lichSuChucVu.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete scientific achievements.
      await prismaTx.thanhTichKhoaHoc.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete annual titles.
      await danhHieuHangNamRepository.deleteManyByPersonnelId(id, prismaTx);

      // Delete contribution awards.
      await prismaTx.khenThuongHCBVTQ.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete HC_QKQT awards.
      await prismaTx.huanChuongQuanKyQuyetThang.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete KNC_VSNXD_QDNDVN awards.
      await prismaTx.kyNiemChuongVSNXDQDNDVN.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete HCCSVV awards.
      await prismaTx.khenThuongHCCSVV.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete ad-hoc awards.
      await prismaTx.khenThuongDotXuat.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete tenure profiles.
      await prismaTx.hoSoNienHan.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete contribution profiles.
      await prismaTx.hoSoCongHien.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete annual profiles.
      await prismaTx.hoSoHangNam.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete personnel row.
      await quanNhanRepository.delete(String(id), prismaTx);

      if (unitId) {
        try {
          await adjustUnitCount(prismaTx, unitId, isCoQuanDonVi, 'decrement');
        } catch (error) {
          throw new AppError(
            `Không thể cập nhật số lượng quân nhân của đơn vị: ${error.message}`,
            500
          );
        }
      }
    });

    return {
      message: 'Xóa quân nhân và toàn bộ dữ liệu liên quan thành công',
      ho_ten: personnel.ho_ten,
      cccd: personnel.cccd,
    };
  }

  /**
   * Checks contribution-award eligibility.
   * Returns personnel already awarded or currently pending approval.
   * @param personnelIds - Personnel ids to validate.
   * @returns Ineligible personnel with reason and status.
   */
  async checkContributionEligibility(personnelIds: string[]) {
    const ineligiblePersonnel = [];

    const [existingAwards, pendingProposals] = await Promise.all([
      contributionMedalRepository.findManyRaw({
        where: { quan_nhan_id: { in: personnelIds } },
      }),
      proposalRepository.findManyRaw({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN,
          status: PROPOSAL_STATUS.PENDING,
        },
        select: {
          id: true,
          data_cong_hien: true,
          nam: true,
        },
      }),
    ]);

    const awardByPersonnelId = new Map(existingAwards.map(a => [a.quan_nhan_id, a]));

    // Build a map: personnelId -> first pending proposal that contains them.
    const pendingByPersonnelId = new Map<string, { id: string; nam: number }>();
    for (const proposal of pendingProposals) {
      if (!proposal.data_cong_hien) continue;
      const congHienList = Array.isArray(proposal.data_cong_hien)
        ? (proposal.data_cong_hien as Array<Record<string, unknown>>)
        : [];
      for (const item of congHienList) {
        const pid = item.personnel_id as string | undefined;
        if (pid && !pendingByPersonnelId.has(pid)) {
          pendingByPersonnelId.set(pid, { id: proposal.id, nam: proposal.nam });
        }
      }
    }

    for (const personnelId of personnelIds) {
      const existingAward = awardByPersonnelId.get(personnelId);
      if (existingAward) {
        ineligiblePersonnel.push({
          personnelId,
          reason: `Đã nhận ${HCBVTQ_LABEL}`,
          status: PROPOSAL_STATUS.APPROVED,
          awardYear: existingAward.nam,
          awardTitle: existingAward.danh_hieu,
        });
        continue;
      }

      const pendingProposal = pendingByPersonnelId.get(personnelId);
      if (pendingProposal) {
        ineligiblePersonnel.push({
          personnelId,
          reason: `Đang chờ duyệt đề xuất ${HCBVTQ_LABEL}`,
          status: PROPOSAL_STATUS.PENDING,
          proposalId: pendingProposal.id,
          proposalYear: pendingProposal.nam,
        });
      }
    }

    return {
      ineligiblePersonnel,
      eligibleCount: personnelIds.length - ineligiblePersonnel.length,
      totalChecked: personnelIds.length,
    };
  }
}

export default new PersonnelService();
