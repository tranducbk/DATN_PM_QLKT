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
import { notifyOnPersonnelDeleted, notifyOnSelfProfileUpdate } from '../helpers/notification';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';
import { diffPersonnelChanges, formatPersonnelChanges } from '../helpers/profileFieldDiff';
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

export interface UpdateOwnProfileData {
  ho_ten?: string;
  ngay_sinh?: Date | null;
  so_dien_thoai?: string | null;
  que_quan_2_cap?: string | null;
  que_quan_3_cap?: string | null;
  tru_quan?: string | null;
  cho_o_hien_nay?: string | null;
}

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  PERSONNEL SERVICE — quân nhân (QuanNhan) — core nghiệp vụ
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ENTITY trung tâm — TẤT CẢ khen thưởng đều ref tới QuanNhan.id qua FK.
 *
 *  CCCD = UNIQUE constraint (PII + business key):
 *  - 1 CCCD chỉ tồn tại 1 QuanNhan (mỗi công dân chỉ 1 căn cước).
 *  - Insert trùng CCCD → service trả message "CCCD đã tồn tại trong hệ thống".
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
 *  - getPersonnel với MANAGER role → filter chỉ trả quân nhân thuộc
 *    đơn vị manager mình. Logic ở `helpers/controllerHelper.ts`.
 *  - Manager CQDV thấy: chính mình + tất cả DVTT con + quân nhân DVTT.
 *  - Manager DVTT thấy: chỉ DVTT mình + quân nhân DVTT.
 *
 *  CASCADE DELETE chú ý:
 *  - Xoá QuanNhan → xoá tuần tự trong transaction các bảng liên quan
 *    (TaiKhoan, DanhHieuHangNam, ...). RỦI RO: mất audit trail.
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
  /**
   * Updates the limited self-editable fields of the caller's own profile.
   * @param quanNhanId - Personnel id resolved from the caller's token
   * @param data - Whitelisted contact/biographical fields
   * @returns Updated personnel record
   */
  async updateOwnProfile(
    quanNhanId: string,
    data: UpdateOwnProfileData,
    actor: { actorId: string; actorRole: string }
  ) {
    const before = await quanNhanRepository.findById(quanNhanId);
    const updated = await quanNhanRepository.update(quanNhanId, data);
    const changes = diffPersonnelChanges(before, data);

    if (changes.length > 0) {
      void writeSystemLog({
        userId: actor.actorId,
        userRole: actor.actorRole,
        action: AUDIT_ACTIONS.UPDATE,
        resource: RESOURCE_SLUGS.PERSONNEL,
        resourceId: quanNhanId,
        description: `Cập nhật thông tin cá nhân: ${formatPersonnelChanges(changes)}`,
      });
      void notifyOnSelfProfileUpdate(
        {
          id: updated.id,
          ho_ten: updated.ho_ten,
          co_quan_don_vi_id: updated.co_quan_don_vi_id,
          don_vi_truc_thuoc_id: updated.don_vi_truc_thuoc_id,
        },
        changes.map(change => change.label)
      );
    }

    return updated;
  }

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

    // Gán đúng 1 trong 2 FK đơn vị (mutually exclusive), cái còn lại = null.
    if (isCoQuanDonVi) {
      personnelData.co_quan_don_vi_id = unit_id;
      personnelData.don_vi_truc_thuoc_id = null;
    } else {
      personnelData.co_quan_don_vi_id = null;
      personnelData.don_vi_truc_thuoc_id = unit_id;
    }

    // Hash password NGOÀI transaction để giảm thời gian giữ lock (bcrypt chậm ~100ms,
    // không nên giữ row-lock trong lúc băm).
    const defaultPassword = DEFAULT_PASSWORD || 'Hvkhqs@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // TRANSACTION: tạo quân nhân (form "Thêm quân nhân" — CCCD nhập ngay).
    // Đây là luồng cccd-first (username = CCCD), khác account.service (account-first,
    // cccd điền sau). 4 thao tác nguyên tử, throw bất kỳ → Prisma rollback hết.
    // SQL minh hoạ:
    //   INSERT INTO "QuanNhan"     (cccd, ho_ten, chuc_vu_id, ngay_nhap_ngu, ...) VALUES ($cccd, $cccd, ...);
    //   SELECT he_so_chuc_vu FROM "ChucVu" WHERE id = $position;   -- hệ số cho dòng lịch sử
    //   INSERT INTO "LichSuChucVu" (quan_nhan_id, chuc_vu_id, he_so_chuc_vu, ngay_bat_dau) VALUES (...);
    //   INSERT INTO "TaiKhoan"     (username, password_hash, role, quan_nhan_id) VALUES ($cccd, ...);
    //   UPDATE "CoQuanDonVi" | "DonViTrucThuoc" SET so_luong = so_luong + 1 WHERE id = $unit;
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

      // Tăng so_luong của đơn vị (+1) trong cùng transaction → counter luôn khớp số QN.
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

      // Xoá thủ công tuần tự MỌI bảng con tham chiếu QuanNhan TRƯỚC khi xoá chính
      // QuanNhan (FK không set cascade) → tránh FK mồ côi / lỗi ràng buộc.
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
        // Giảm so_luong đơn vị (-1); lỗi ở đây throw để rollback cả cascade delete
        // (không để xoá QN xong mà counter đơn vị bị lệch).
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

    // HCBVTQ chỉ trao 1 lần/đời → loại quân nhân đã NHẬN hoặc ĐANG chờ duyệt.
    // 2 query song song + IN (...) cho cả danh sách → tránh N+1 (không query/người).
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
