import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { danhHieuHangNamRepository } from '../repositories/danhHieu.repository';
import { contributionMedalRepository } from '../repositories/contributionMedal.repository';
import { accountRepository } from '../repositories/account.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { positionRepository } from '../repositories/position.repository';
import { positionHistoryRepository } from '../repositories/positionHistory.repository';
import { scientificAchievementRepository } from '../repositories/scientificAchievement.repository';
import { militaryFlagRepository } from '../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../repositories/commemorativeMedal.repository';
import { tenureMedalRepository } from '../repositories/tenureMedal.repository';
import { adhocAwardRepository } from '../repositories/adhocAward.repository';
import { tenureProfileRepository } from '../repositories/tenureProfile.repository';
import { contributionProfileRepository } from '../repositories/contributionProfile.repository';
import { annualProfileRepository } from '../repositories/annualProfile.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../repositories/unit.repository';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import bcrypt from 'bcrypt';
import { parseCCCD } from '../helpers/cccdHelper';
import { notifyOnPersonnelDeleted } from '../helpers/notification';
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

  /**
   * Enforces that the requesting user may view the given personnel's data.
   * @param personnelId - Target personnel ID
   * @param userRole - Requesting user's role
   * @param userQuanNhanId - Requesting user's own personnel ID
   * @param preloadedTarget - Target unit foreign keys when already loaded (skips a query)
   * @returns Nothing
   * @throws NotFoundError - When the target personnel does not exist
   * @throws ForbiddenError - When a USER targets another personnel or a MANAGER targets out-of-unit personnel
   */
  async assertCanViewPersonnel(
    personnelId: string,
    userRole?: string,
    userQuanNhanId?: string,
    preloadedTarget?: { co_quan_don_vi_id: string | null; don_vi_truc_thuoc_id: string | null }
  ): Promise<void> {
    if (userRole === ROLES.SUPER_ADMIN || userRole === ROLES.ADMIN) {
      return;
    }

    if (userRole === ROLES.USER) {
      if (userQuanNhanId !== personnelId) {
        throw new ForbiddenError('Bạn không có quyền xem thông tin này');
      }
      return;
    }

    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const target = preloadedTarget ?? (await quanNhanRepository.findUnitScope(personnelId));
      if (!target) {
        throw new NotFoundError('Quân nhân');
      }

      const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);
      if (manager && manager.co_quan_don_vi_id) {
        const donViTrucThuocList = await donViTrucThuocRepository.findIdsByCoQuanDonViId(
          manager.co_quan_don_vi_id
        );
        const donViTrucThuocIds = donViTrucThuocList.map(dv => dv.id);

        const isInCoQuanDonVi = target.co_quan_don_vi_id === manager.co_quan_don_vi_id;
        const isInDonViTrucThuoc =
          target.don_vi_truc_thuoc_id && donViTrucThuocIds.includes(target.don_vi_truc_thuoc_id);

        if (!isInCoQuanDonVi && !isInDonViTrucThuoc) {
          throw new ForbiddenError('Bạn không có quyền xem thông tin quân nhân ngoài đơn vị');
        }
      }
    }
  }

  /** Returns one personnel record by id. */
  async getPersonnelById(id, userRole, userQuanNhanId) {
    const personnel = await quanNhanRepository.findByIdForDetail(String(id));

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    await this.assertCanViewPersonnel(String(id), userRole, userQuanNhanId, personnel);

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

    const isCoQuanDonVi = !!coQuanDonVi;
    const personnelData: Prisma.QuanNhanUncheckedCreateInput = {
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
      const chucVu = await positionRepository.findUniqueRaw(
        {
          where: { id: position_id },
          select: { he_so_chuc_vu: true },
        },
        prismaTx
      );

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

      const account = await accountRepository.create(
        {
          username,
          password_hash: hashedPassword,
          role: role,
          quan_nhan_id: newPersonnel.id,
        },
        prismaTx
      );

      await adjustUnitCount(prismaTx, unit_id, isCoQuanDonVi, 'increment');

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
  async deletePersonnel(id, userRole, userQuanNhanId, adminUsername?: string) {
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
      if (personnel.TaiKhoan) {
        await accountRepository.delete(personnel.TaiKhoan.id, prismaTx);
      }

      await positionHistoryRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await scientificAchievementRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await danhHieuHangNamRepository.deleteManyByPersonnelId(id, prismaTx);
      await contributionMedalRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await militaryFlagRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await commemorativeMedalRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await tenureMedalRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await adhocAwardRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await tenureProfileRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await contributionProfileRepository.deleteMany({ quan_nhan_id: id }, prismaTx);
      await annualProfileRepository.deleteMany({ quan_nhan_id: id }, prismaTx);

      await quanNhanRepository.delete(String(id), prismaTx);

      if (unitId) {
        try {
          await adjustUnitCount(prismaTx, unitId, isCoQuanDonVi, 'decrement');
        } catch (error) {
          console.error('[deletePersonnel] adjustUnitCount failed', { unitId, error });
          throw new AppError(
            'Không thể cập nhật số lượng quân nhân của đơn vị, vui lòng thử lại.',
            500
          );
        }
      }
    });

    try {
      await notifyOnPersonnelDeleted(
        {
          id: String(id),
          ho_ten: personnel.ho_ten,
          co_quan_don_vi_id: personnel.co_quan_don_vi_id,
          don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id,
        },
        adminUsername
      );
    } catch (error) {
      console.error('[deletePersonnel] notifyOnPersonnelDeleted failed', error);
    }

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
