import path from 'path';
import fs from 'fs/promises';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../repositories/unit.repository';
import { adhocAwardRepository } from '../repositories/adhocAward.repository';
import { accountRepository } from '../repositories/account.repository';
import { ROLES } from '../constants/roles.constants';
import { ADHOC_TYPE } from '../constants/adhocType.constants';
import { UNIT_TYPE } from '../constants/unitType.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import { ForbiddenError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import type { KhenThuongDotXuat, Prisma } from '../generated/prisma';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import decisionService from './decision.service';
import { buildTimestampedName, decodeOriginalName } from '../helpers/file/fileNaming';
import { STORAGE_PROPOSALS_DIR, PROPOSALS_REL, ensureDir } from '../configs/storagePaths';
import {
  deleteStoredFiles,
  attachmentRelativePath,
  persistDecisionFile,
} from '../helpers/file/fileStorage';
import {
  notifyOnAdhocAwardCreated,
  notifyOnAdhocAwardUpdated,
  notifyOnAdhocAwardDeleted,
} from './adhocAward/notifications';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.ADHOC_AWARDS];

interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

interface AttachedFileInfo {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface CreateAdhocAwardParams {
  adminId: string;
  type: string;
  year: number;
  awardForm: string;
  personnelId?: string;
  unitId?: string;
  unitType?: string;
  rank?: string | null;
  position?: string | null;
  note?: string | null;
  decisionNumber?: string | null;
  decisionYear?: number;
  signDate?: string;
  signer?: string;
  decisionFile?: UploadedFile;
  attachedFiles?: UploadedFile[];
}

interface UpdateAdhocAwardParams {
  id: string;
  adminId: string;
  awardForm?: string;
  year?: number;
  rank?: string | null;
  position?: string | null;
  note?: string | null;
  decisionNumber?: string | null;
  attachedFiles?: UploadedFile[];
  removeAttachedFileIndexes?: number[];
}

interface GetAdhocAwardsParams {
  type?: string;
  year?: number;
  personnelId?: string;
  unitId?: string;
  ho_ten?: string;
  page?: number;
  limit?: number;
  managerCoQuanId?: string;
  managerDonViTrucThuocIds?: string[];
  managerDonViTrucThuocId?: string;
}

function parseAttachedFiles(json: Prisma.JsonValue | null): AttachedFileInfo[] {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as AttachedFileInfo[];
}

interface ManagerUnitFilterCoQuan {
  type: 'coQuan';
  coQuanId: string;
  dvttIds?: string[];
}

interface ManagerUnitFilterDvtt {
  type: 'dvtt';
  dvttId: string;
}

type ManagerUnitFilter = ManagerUnitFilterCoQuan | ManagerUnitFilterDvtt;

class AdhocAwardService {
  private applyManagerUnitFilter(
    where: Record<string, unknown>,
    hoTen: string | undefined,
    filter: ManagerUnitFilter
  ): void {
    const unitFilter: Record<string, unknown>[] = [];

    if (filter.type === 'coQuan') {
      const dvttCondition =
        filter.dvttIds && filter.dvttIds.length > 0
          ? [{ don_vi_truc_thuoc_id: { in: filter.dvttIds } }]
          : [];

      unitFilter.push({
        doi_tuong: ADHOC_TYPE.CA_NHAN,
        QuanNhan: {
          ...(hoTen && { ho_ten: { contains: hoTen, mode: 'insensitive' } }),
          OR: [{ co_quan_don_vi_id: filter.coQuanId }, ...dvttCondition],
        },
      });

      unitFilter.push({
        doi_tuong: ADHOC_TYPE.TAP_THE,
        OR: [{ co_quan_don_vi_id: filter.coQuanId }, ...dvttCondition],
      });
    } else {
      unitFilter.push({
        doi_tuong: ADHOC_TYPE.CA_NHAN,
        QuanNhan: {
          ...(hoTen && { ho_ten: { contains: hoTen, mode: 'insensitive' } }),
          don_vi_truc_thuoc_id: filter.dvttId,
        },
      });

      unitFilter.push({
        doi_tuong: ADHOC_TYPE.TAP_THE,
        don_vi_truc_thuoc_id: filter.dvttId,
      });
    }

    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: unitFilter }];
      delete where.OR;
    } else {
      where.OR = unitFilter;
    }

    if (hoTen) {
      delete where.QuanNhan;
    }
  }

  // FK so_quyet_dinh references FileQuyetDinh — a new decision number must have a row first
  private async ensureDecisionRecord({
    decisionNumber,
    decisionYear,
    signDate,
    signer,
    decisionFile,
  }: Pick<
    CreateAdhocAwardParams,
    'decisionNumber' | 'decisionYear' | 'signDate' | 'signer' | 'decisionFile'
  >): Promise<void> {
    const soQuyetDinh = decisionNumber?.trim();
    if (!soQuyetDinh) return;

    const existing = await decisionService.getDecisionBySoQuyetDinh(soQuyetDinh);
    if (existing) return;

    if (!decisionYear || !signDate || !signer?.trim()) {
      throw new ValidationError('Quyết định mới cần đầy đủ năm, ngày ký và người ký quyết định');
    }

    const filePath = decisionFile?.buffer ? await persistDecisionFile(decisionFile) : null;

    await decisionService.createDecision({
      so_quyet_dinh: soQuyetDinh,
      nam: decisionYear,
      ngay_ky: new Date(signDate),
      nguoi_ky: signer.trim(),
      file_path: filePath,
      loai_khen_thuong: PROPOSAL_TYPES.DOT_XUAT,
    });
  }

  async createAdhocAward({
    adminId,
    type,
    year,
    awardForm,
    personnelId,
    unitId,
    unitType,
    rank,
    position,
    note,
    decisionNumber,
    decisionYear,
    signDate,
    signer,
    decisionFile,
    attachedFiles,
  }: CreateAdhocAwardParams): Promise<KhenThuongDotXuat> {
    const admin = await accountRepository.findUniqueRaw({
      where: { id: adminId },
    });

    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Chỉ Admin mới có quyền tạo khen thưởng đột xuất');
    }

    if (type === ADHOC_TYPE.CA_NHAN) {
      const personnel = await quanNhanRepository.findIdById(String(personnelId));

      if (!personnel) {
        throw new NotFoundError('Quân nhân');
      }
    }

    if (type === ADHOC_TYPE.TAP_THE) {
      if (unitType === UNIT_TYPE.CO_QUAN_DON_VI) {
        const unit = await coQuanDonViRepository.findIdById(String(unitId));

        if (!unit) {
          throw new NotFoundError('Cơ quan đơn vị');
        }
      } else if (unitType === UNIT_TYPE.DON_VI_TRUC_THUOC) {
        const unit = await donViTrucThuocRepository.findIdById(String(unitId));

        if (!unit) {
          throw new NotFoundError('Đơn vị trực thuộc');
        }
      }
    }

    const uploadedAttachedFiles: AttachedFileInfo[] = [];

    if (attachedFiles && attachedFiles.length > 0) {
      uploadedAttachedFiles.push(...(await this.persistAdhocAttachments(attachedFiles)));
    }

    let adhocAward: KhenThuongDotXuat;
    try {
      await this.ensureDecisionRecord({
        decisionNumber,
        decisionYear,
        signDate,
        signer,
        decisionFile,
      });

      adhocAward = await adhocAwardRepository.create({
        loai: 'KHEN_THUONG_DOT_XUAT',
        doi_tuong: type,
        ...(type === ADHOC_TYPE.CA_NHAN && personnelId && { quan_nhan_id: personnelId }),
        ...(type === ADHOC_TYPE.TAP_THE &&
          unitType === UNIT_TYPE.CO_QUAN_DON_VI && { co_quan_don_vi_id: unitId }),
        ...(type === ADHOC_TYPE.TAP_THE &&
          unitType === UNIT_TYPE.DON_VI_TRUC_THUOC && { don_vi_truc_thuoc_id: unitId }),
        hinh_thuc_khen_thuong: awardForm,
        nam: year,
        cap_bac: rank || null,
        chuc_vu: position || null,
        ghi_chu: note || null,
        so_quyet_dinh: decisionNumber || null,
        files_dinh_kem:
          uploadedAttachedFiles.length > 0
            ? (JSON.parse(JSON.stringify(uploadedAttachedFiles)) as Prisma.InputJsonValue)
            : null,
      } as Prisma.KhenThuongDotXuatUncheckedCreateInput);
    } catch (e) {
      await deleteStoredFiles(uploadedAttachedFiles.map(attachmentRelativePath));
      throw e;
    }

    // Reload with relations — notifyOnAdhocAwardCreated reads QuanNhan/CoQuanDonVi/
    // DonViTrucThuoc, which the bare create() result does not include.
    const adhocAwardWithRelations = await adhocAwardRepository.findUniqueRaw({
      where: { id: adhocAward.id },
      include: {
        QuanNhan: { include: { CoQuanDonVi: true, DonViTrucThuoc: true } },
        CoQuanDonVi: true,
        DonViTrucThuoc: { include: { CoQuanDonVi: true } },
      },
    });

    try {
      await notifyOnAdhocAwardCreated(adhocAwardWithRelations ?? adhocAward, admin.username);
    } catch (e) {
      console.error('notifyOnAdhocAwardCreated failed:', e);
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.ADHOC_AWARDS,
        description: logMessages.notifyError('tạo', AWARD_LABEL, e),
      });
    }

    return adhocAward;
  }

  private async persistAdhocAttachments(
    attachedFiles: UploadedFile[]
  ): Promise<AttachedFileInfo[]> {
    ensureDir(STORAGE_PROPOSALS_DIR);
    const saved: AttachedFileInfo[] = [];
    for (const file of attachedFiles) {
      const originalName = decodeOriginalName(file.originalname);
      const uniqueName = buildTimestampedName(file.originalname);
      await fs.writeFile(path.join(STORAGE_PROPOSALS_DIR, uniqueName), file.buffer);
      saved.push({
        filename: uniqueName,
        originalName,
        path: `${PROPOSALS_REL}/${uniqueName}`,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      });
    }
    return saved;
  }

  async getAdhocAwards({
    type,
    year,
    personnelId,
    unitId,
    ho_ten,
    page = 1,
    limit = 20,
    managerCoQuanId,
    managerDonViTrucThuocIds,
    managerDonViTrucThuocId,
  }: GetAdhocAwardsParams): Promise<{
    data: KhenThuongDotXuat[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (type) {
      where.doi_tuong = type;
    }

    if (year) {
      where.nam = year;
    }

    if (personnelId) {
      where.quan_nhan_id = personnelId;
    }

    if (unitId) {
      where.OR = [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: unitId }];
    }

    if (ho_ten) {
      where.QuanNhan = {
        ho_ten: { contains: ho_ten, mode: 'insensitive' },
      };
    }

    if (managerCoQuanId) {
      this.applyManagerUnitFilter(where, ho_ten, {
        type: 'coQuan',
        coQuanId: managerCoQuanId,
        dvttIds: managerDonViTrucThuocIds,
      });
    } else if (managerDonViTrucThuocId) {
      this.applyManagerUnitFilter(where, ho_ten, {
        type: 'dvtt',
        dvttId: managerDonViTrucThuocId,
      });
    }

    const [total, data] = await Promise.all([
      adhocAwardRepository.count(where as Prisma.KhenThuongDotXuatWhereInput),
      adhocAwardRepository.findManyRaw({
        where: where as Prisma.KhenThuongDotXuatWhereInput,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: true,
              ChucVu: true,
            },
          },
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdhocAwardById(id: string): Promise<KhenThuongDotXuat> {
    const adhocAward = await adhocAwardRepository.findUniqueRaw({
      where: { id },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
            ChucVu: true,
          },
        },
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
      },
    });

    if (!adhocAward) {
      throw new NotFoundError('Khen thưởng đột xuất');
    }

    return adhocAward;
  }

  async updateAdhocAward({
    id,
    adminId,
    awardForm,
    year,
    rank,
    position,
    note,
    decisionNumber,
    attachedFiles,
    removeAttachedFileIndexes,
  }: UpdateAdhocAwardParams): Promise<KhenThuongDotXuat> {
    const admin = await accountRepository.findUniqueRaw({
      where: { id: adminId },
    });

    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Chỉ Admin mới có quyền cập nhật khen thưởng đột xuất');
    }

    const existing = await adhocAwardRepository.findUniqueRaw({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Khen thưởng đột xuất');
    }

    const existingAttachedFiles: AttachedFileInfo[] = parseAttachedFiles(existing.files_dinh_kem);
    const removedPaths: Array<string | null> = [];

    if (removeAttachedFileIndexes && removeAttachedFileIndexes.length > 0) {
      const filesToRemove = [...removeAttachedFileIndexes]
        .sort((a, b) => b - a)
        .filter(index => index >= 0 && index < existingAttachedFiles.length);

      for (const index of filesToRemove) {
        removedPaths.push(attachmentRelativePath(existingAttachedFiles[index]));
        existingAttachedFiles.splice(index, 1);
      }
    }

    const newlyPersisted: AttachedFileInfo[] = [];
    if (attachedFiles && attachedFiles.length > 0) {
      newlyPersisted.push(...(await this.persistAdhocAttachments(attachedFiles)));
      existingAttachedFiles.push(...newlyPersisted);
    }

    const updateData: Record<string, unknown> = {};

    if (awardForm !== undefined) updateData.hinh_thuc_khen_thuong = awardForm;
    if (year !== undefined) updateData.nam = year;
    if (rank !== undefined) updateData.cap_bac = rank;
    if (position !== undefined) updateData.chuc_vu = position;
    if (note !== undefined) updateData.ghi_chu = note;
    if (decisionNumber !== undefined) updateData.so_quyet_dinh = decisionNumber;

    updateData.files_dinh_kem = existingAttachedFiles.length > 0 ? existingAttachedFiles : null;

    const updated = await adhocAwardRepository
      .updateRaw({
        where: { id },
        data: updateData as Prisma.KhenThuongDotXuatUpdateInput,
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: true,
              ChucVu: true,
            },
          },
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
        },
      })
      .catch(async e => {
        await deleteStoredFiles(newlyPersisted.map(attachmentRelativePath));
        throw e;
      });

    await deleteStoredFiles(removedPaths);

    try {
      await notifyOnAdhocAwardUpdated(updated, admin.username);
    } catch (e) {
      console.error('notifyOnAdhocAwardUpdated failed:', e);
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.ADHOC_AWARDS,
        description: logMessages.notifyError('cập nhật', AWARD_LABEL, e),
      });
    }

    return updated;
  }

  async deleteAdhocAward(
    id: string,
    adminId: string
  ): Promise<{ success: boolean; award: KhenThuongDotXuat }> {
    const admin = await accountRepository.findUniqueRaw({
      where: { id: adminId },
    });

    const adhocAward = await adhocAwardRepository.findUniqueRaw({
      where: { id },
      include: {
        QuanNhan: {
          select: {
            id: true,
            ho_ten: true,
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
            DonViTrucThuoc: { select: { co_quan_don_vi_id: true } },
          },
        },
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
      },
    });

    if (!adhocAward) {
      throw new NotFoundError('Khen thưởng đột xuất');
    }

    const awardInfo = { ...adhocAward };

    const attachedFilesRaw = adhocAward.files_dinh_kem as unknown as AttachedFileInfo[] | null;
    const attachedFilesList = attachedFilesRaw || [];

    await adhocAwardRepository.delete(id);

    await deleteStoredFiles(attachedFilesList.map(attachmentRelativePath));

    try {
      await notifyOnAdhocAwardDeleted(awardInfo, admin?.username || 'Admin');
    } catch (error) {
      console.error('Failed to send adhoc-award deletion notifications:', error);
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.ADHOC_AWARDS,
        description: logMessages.notifyError('xóa', AWARD_LABEL, error),
      });
    }

    return { success: true, award: awardInfo };
  }

  async getAdhocAwardsByPersonnel(personnelId: string): Promise<KhenThuongDotXuat[]> {
    const personnel = await quanNhanRepository.findIdById(personnelId);

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const adhocAwards = await adhocAwardRepository.findManyRaw({
      where: {
        doi_tuong: ADHOC_TYPE.CA_NHAN,
        quan_nhan_id: personnelId,
      },
      orderBy: {
        nam: 'desc',
      },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
            ChucVu: true,
          },
        },
      },
    });

    return adhocAwards;
  }

  async getAdhocAwardsByUnit(unitId: string, unitType: string): Promise<KhenThuongDotXuat[]> {
    const where: Prisma.KhenThuongDotXuatWhereInput = {
      doi_tuong: ADHOC_TYPE.TAP_THE,
    };

    if (unitType === UNIT_TYPE.CO_QUAN_DON_VI) {
      where.co_quan_don_vi_id = unitId;

      const unit = await coQuanDonViRepository.findIdById(unitId);

      if (!unit) {
        throw new NotFoundError('Cơ quan đơn vị');
      }
    } else if (unitType === UNIT_TYPE.DON_VI_TRUC_THUOC) {
      where.don_vi_truc_thuoc_id = unitId;

      const unit = await donViTrucThuocRepository.findIdById(unitId);

      if (!unit) {
        throw new NotFoundError('Đơn vị trực thuộc');
      }
    }

    const adhocAwards = await adhocAwardRepository.findManyRaw({
      where,
      orderBy: {
        nam: 'desc',
      },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
      },
    });

    return adhocAwards;
  }
}

export default new AdhocAwardService();
