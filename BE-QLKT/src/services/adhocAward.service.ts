import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../models';
import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../constants/notificationTypes';
import { ROLES } from '../constants/roles';
import type { KhenThuongDotXuat, Prisma } from '../generated/prisma';

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

interface NotificationData {
  nguoi_nhan_id: string;
  recipient_role: string;
  type: string;
  title: string;
  message: string;
  resource: string;
  tai_nguyen_id: string;
  link: string;
}

function parseAttachedFiles(json: Prisma.JsonValue | null): AttachedFileInfo[] {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as AttachedFileInfo[];
}

class AdhocAwardService {
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
    attachedFiles,
  }: CreateAdhocAwardParams): Promise<KhenThuongDotXuat> {
    try {
      const admin = await prisma.taiKhoan.findUnique({
        where: { id: adminId },
      });

      if (!admin || admin.role !== ROLES.ADMIN) {
        throw new Error('Chỉ Admin mới có quyền tạo khen thưởng đột xuất');
      }

      if (type === 'CA_NHAN') {
        const personnel = await prisma.quanNhan.findUnique({
          where: { id: personnelId },
        });

        if (!personnel) {
          throw new Error('Quân nhân không tồn tại');
        }
      }

      if (type === 'TAP_THE') {
        if (unitType === 'CO_QUAN_DON_VI') {
          const unit = await prisma.coQuanDonVi.findUnique({
            where: { id: unitId },
          });

          if (!unit) {
            throw new Error('Cơ quan đơn vị không tồn tại');
          }
        } else if (unitType === 'DON_VI_TRUC_THUOC') {
          const unit = await prisma.donViTrucThuoc.findUnique({
            where: { id: unitId },
          });

          if (!unit) {
            throw new Error('Đơn vị trực thuộc không tồn tại');
          }
        }
      }

      const proposalsDir = path.join(__dirname, '..', '..', 'storage', 'proposals');
      await fs.mkdir(proposalsDir, { recursive: true });

      const uploadedAttachedFiles: AttachedFileInfo[] = [];

      if (attachedFiles && attachedFiles.length > 0) {
        const attachedDir = path.join(__dirname, '..', '..', 'storage', 'proposals');
        await fs.mkdir(attachedDir, { recursive: true });

        for (const file of attachedFiles) {
          const timestamp = Date.now();
          let decodedName = file.originalname;
          try {
            decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          } catch {
            decodedName = file.originalname;
          }
          const sanitizedName = decodedName.replace(/[<>:"/\\|?*]/g, '_');
          const uniqueName = `${timestamp}_${sanitizedName}`;
          const filePath = path.join(attachedDir, uniqueName);

          await fs.writeFile(filePath, file.buffer);

          uploadedAttachedFiles.push({
            filename: uniqueName,
            originalName: decodedName,
            path: `storage/proposals/${uniqueName}`,
            size: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date().toISOString(),
          });
        }
      }

      const adhocAward = await prisma.khenThuongDotXuat.create({
        data: {
          loai: 'KHEN_THUONG_DOT_XUAT',
          doi_tuong: type,
          ...(type === 'CA_NHAN' && personnelId && { quan_nhan_id: personnelId }),
          ...(type === 'TAP_THE' && unitType === 'CO_QUAN_DON_VI' && { co_quan_don_vi_id: unitId }),
          ...(type === 'TAP_THE' &&
            unitType === 'DON_VI_TRUC_THUOC' && { don_vi_truc_thuoc_id: unitId }),
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
      });

      try {
        await this._notifyOnAdhocAwardCreated(adhocAward, admin.username);
      } catch {
        // Không throw error để không ảnh hưởng đến việc tạo khen thưởng
      }

      return adhocAward;
    } catch (error) {
      throw error;
    }
  }

  async _notifyOnAdhocAwardCreated(
    adhocAward: Record<string, unknown>,
    adminUsername: string
  ): Promise<number> {
    const notifications: NotificationData[] = [];

    if (adhocAward.doi_tuong === 'CA_NHAN' && adhocAward.QuanNhan) {
      const personnel = adhocAward.QuanNhan as Record<string, unknown>;
      const awardName = adhocAward.hinh_thuc_khen_thuong as string;
      const year = adhocAward.nam as number;

      const donViId =
        (personnel.co_quan_don_vi_id as string) || (personnel.don_vi_truc_thuoc_id as string);
      if (donViId) {
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: personnel.co_quan_don_vi_id as string },
                { don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id as string },
              ].filter(Boolean),
            },
          },
          select: { id: true, role: true },
        });

        managers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_ADDED,
            title: 'Khen thưởng đột xuất mới',
            message: `${adminUsername} đã thêm khen thưởng đột xuất "${awardName}" năm ${year} cho quân nhân ${personnel.ho_ten}`,
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.id as string,
            link: `/manager/awards`,
          });
        });
      }

      const personnelAccount = await prisma.taiKhoan.findFirst({
        where: { quan_nhan_id: personnel.id as string },
        select: { id: true, role: true },
      });

      if (personnelAccount) {
        notifications.push({
          nguoi_nhan_id: personnelAccount.id,
          recipient_role: personnelAccount.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: 'Bạn được khen thưởng đột xuất',
          message: `Bạn được khen thưởng "${awardName}" năm ${year}`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: adhocAward.id as string,
          link: `/user/profile`,
        });
      }
    } else if (adhocAward.doi_tuong === 'TAP_THE') {
      const awardName = adhocAward.hinh_thuc_khen_thuong as string;
      const year = adhocAward.nam as number;
      let unitName = '';

      if (adhocAward.CoQuanDonVi) {
        const coQuanDonVi = adhocAward.CoQuanDonVi as Record<string, unknown>;
        unitName = coQuanDonVi.ten_don_vi as string;
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: { co_quan_don_vi_id: adhocAward.co_quan_don_vi_id as string },
          },
          select: { id: true, role: true },
        });

        managers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_ADDED,
            title: 'Đơn vị được khen thưởng đột xuất',
            message: `${adminUsername} đã thêm khen thưởng đột xuất "${awardName}" năm ${year} cho đơn vị ${unitName}`,
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.id as string,
            link: `/manager/awards`,
          });
        });
      } else if (adhocAward.DonViTrucThuoc) {
        const donViTrucThuoc = adhocAward.DonViTrucThuoc as Record<string, unknown>;
        unitName = donViTrucThuoc.ten_don_vi as string;
        const parentUnitName = (donViTrucThuoc.CoQuanDonVi as Record<string, unknown> | null)
          ?.ten_don_vi as string | undefined;

        if (donViTrucThuoc.co_quan_don_vi_id) {
          const parentManagers = await prisma.taiKhoan.findMany({
            where: {
              role: ROLES.MANAGER,
              QuanNhan: { co_quan_don_vi_id: donViTrucThuoc.co_quan_don_vi_id as string },
            },
            select: { id: true, role: true },
          });

          parentManagers.forEach(manager => {
            notifications.push({
              nguoi_nhan_id: manager.id,
              recipient_role: manager.role,
              type: NOTIFICATION_TYPES.AWARD_ADDED,
              title: 'Đơn vị trực thuộc được khen thưởng đột xuất',
              message: `${adminUsername} đã thêm khen thưởng đột xuất "${awardName}" năm ${year} cho đơn vị ${unitName}${
                parentUnitName ? ` (thuộc ${parentUnitName})` : ''
              }`,
              resource: RESOURCE_TYPES.AWARDS,
              tai_nguyen_id: adhocAward.id as string,
              link: `/manager/awards`,
            });
          });
        }
      }
    }

    if (notifications.length > 0) {
      await prisma.thongBao.createMany({ data: notifications });
    }

    return notifications.length;
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
    try {
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
        const unitFilter: Record<string, unknown>[] = [];

        unitFilter.push({
          doi_tuong: 'CA_NHAN',
          QuanNhan: {
            ...(ho_ten && { ho_ten: { contains: ho_ten, mode: 'insensitive' } }),
            OR: [
              { co_quan_don_vi_id: managerCoQuanId },
              ...(managerDonViTrucThuocIds && managerDonViTrucThuocIds.length > 0
                ? [{ don_vi_truc_thuoc_id: { in: managerDonViTrucThuocIds } }]
                : []),
            ],
          },
        });

        unitFilter.push({
          doi_tuong: 'TAP_THE',
          OR: [
            { co_quan_don_vi_id: managerCoQuanId },
            ...(managerDonViTrucThuocIds && managerDonViTrucThuocIds.length > 0
              ? [{ don_vi_truc_thuoc_id: { in: managerDonViTrucThuocIds } }]
              : []),
          ],
        });

        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: unitFilter }];
          delete where.OR;
        } else {
          where.OR = unitFilter;
        }

        if (ho_ten) {
          delete where.QuanNhan;
        }
      } else if (managerDonViTrucThuocId) {
        const unitFilter: Record<string, unknown>[] = [];

        unitFilter.push({
          doi_tuong: 'CA_NHAN',
          QuanNhan: {
            ...(ho_ten && { ho_ten: { contains: ho_ten, mode: 'insensitive' } }),
            don_vi_truc_thuoc_id: managerDonViTrucThuocId,
          },
        });

        unitFilter.push({
          doi_tuong: 'TAP_THE',
          don_vi_truc_thuoc_id: managerDonViTrucThuocId,
        });

        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: unitFilter }];
          delete where.OR;
        } else {
          where.OR = unitFilter;
        }

        if (ho_ten) {
          delete where.QuanNhan;
        }
      }

      const [total, data] = await Promise.all([
        prisma.khenThuongDotXuat.count({ where: where as Prisma.KhenThuongDotXuatWhereInput }),
        prisma.khenThuongDotXuat.findMany({
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
    } catch (error) {
      throw error;
    }
  }

  async getAdhocAwardById(id: string): Promise<KhenThuongDotXuat> {
    try {
      const adhocAward = await prisma.khenThuongDotXuat.findUnique({
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
        throw new Error('Khen thưởng đột xuất không tồn tại');
      }

      return adhocAward;
    } catch (error) {
      throw error;
    }
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
    try {
      const admin = await prisma.taiKhoan.findUnique({
        where: { id: adminId },
      });

      if (!admin || admin.role !== ROLES.ADMIN) {
        throw new Error('Chỉ Admin mới có quyền cập nhật khen thưởng đột xuất');
      }

      const existing = await prisma.khenThuongDotXuat.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Khen thưởng đột xuất không tồn tại');
      }

      let existingAttachedFiles: AttachedFileInfo[] = parseAttachedFiles(existing.files_dinh_kem);

      if (removeAttachedFileIndexes && removeAttachedFileIndexes.length > 0) {
        const filesToRemove = [...removeAttachedFileIndexes]
          .sort((a, b) => b - a)
          .filter(index => index >= 0 && index < existingAttachedFiles.length);

        for (const index of filesToRemove) {
          const fileToRemove = existingAttachedFiles[index];
          try {
            const fullPath = path.join(__dirname, '..', '..', fileToRemove.path);
            await fs.unlink(fullPath);
          } catch {
            // ignore file deletion errors
          }
          existingAttachedFiles.splice(index, 1);
        }
      }

      if (attachedFiles && attachedFiles.length > 0) {
        const proposalsDir = path.join(__dirname, '..', '..', 'storage', 'proposals');
        await fs.mkdir(proposalsDir, { recursive: true });

        for (const file of attachedFiles) {
          const timestamp = Date.now();
          let decodedName = file.originalname;
          try {
            decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          } catch {
            decodedName = file.originalname;
          }
          const sanitizedName = decodedName.replace(/[<>:"/\\|?*]/g, '_');
          const uniqueName = `${timestamp}_${sanitizedName}`;
          const filePath = path.join(proposalsDir, uniqueName);

          await fs.writeFile(filePath, file.buffer);

          existingAttachedFiles.push({
            filename: uniqueName,
            originalName: decodedName,
            path: `storage/proposals/${uniqueName}`,
            size: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date().toISOString(),
          });
        }
      }

      const updateData: Record<string, unknown> = {};

      if (awardForm !== undefined) updateData.hinh_thuc_khen_thuong = awardForm;
      if (year !== undefined) updateData.nam = year;
      if (rank !== undefined) updateData.cap_bac = rank;
      if (position !== undefined) updateData.chuc_vu = position;
      if (note !== undefined) updateData.ghi_chu = note;
      if (decisionNumber !== undefined) updateData.so_quyet_dinh = decisionNumber;

      updateData.files_dinh_kem = existingAttachedFiles.length > 0 ? existingAttachedFiles : null;

      const updated = await prisma.khenThuongDotXuat.update({
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
      });

      try {
        await this._notifyOnAdhocAwardUpdated(updated, admin.username);
      } catch {
        // Không throw error
      }

      return updated;
    } catch (error) {
      throw error;
    }
  }

  async _notifyOnAdhocAwardUpdated(
    adhocAward: Record<string, unknown>,
    adminUsername: string
  ): Promise<number> {
    const notifications: NotificationData[] = [];
    const awardName = adhocAward.hinh_thuc_khen_thuong as string;
    const year = adhocAward.nam as number;

    if (adhocAward.doi_tuong === 'CA_NHAN' && adhocAward.QuanNhan) {
      const personnel = adhocAward.QuanNhan as Record<string, unknown>;

      const donViId =
        (personnel.co_quan_don_vi_id as string) || (personnel.don_vi_truc_thuoc_id as string);
      if (donViId) {
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: personnel.co_quan_don_vi_id as string },
                { don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id as string },
              ].filter(Boolean),
            },
          },
          select: { id: true, role: true },
        });

        managers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_UPDATED,
            title: 'Khen thưởng đột xuất đã được cập nhật',
            message: `${adminUsername} đã cập nhật khen thưởng đột xuất "${awardName}" năm ${year} của quân nhân ${personnel.ho_ten}`,
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.id as string,
            link: `/manager/awards`,
          });
        });
      }

      const personnelAccount = await prisma.taiKhoan.findFirst({
        where: { quan_nhan_id: personnel.id as string },
        select: { id: true, role: true },
      });

      if (personnelAccount) {
        notifications.push({
          nguoi_nhan_id: personnelAccount.id,
          recipient_role: personnelAccount.role,
          type: NOTIFICATION_TYPES.AWARD_UPDATED,
          title: 'Khen thưởng của bạn đã được cập nhật',
          message: `Khen thưởng đột xuất "${awardName}" năm ${year} của bạn đã được cập nhật`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: adhocAward.id as string,
          link: `/user/profile`,
        });
      }
    } else if (adhocAward.doi_tuong === 'TAP_THE') {
      let unitName = '';

      if (adhocAward.CoQuanDonVi) {
        const coQuanDonVi = adhocAward.CoQuanDonVi as Record<string, unknown>;
        unitName = coQuanDonVi.ten_don_vi as string;
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: { co_quan_don_vi_id: adhocAward.co_quan_don_vi_id as string },
          },
          select: { id: true, role: true },
        });

        managers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_UPDATED,
            title: 'Khen thưởng đơn vị đã được cập nhật',
            message: `${adminUsername} đã cập nhật khen thưởng đột xuất "${awardName}" năm ${year} của đơn vị ${unitName}`,
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.id as string,
            link: `/manager/awards`,
          });
        });
      } else if (adhocAward.DonViTrucThuoc) {
        const donViTrucThuoc = adhocAward.DonViTrucThuoc as Record<string, unknown>;
        unitName = donViTrucThuoc.ten_don_vi as string;
        const parentUnitName = (donViTrucThuoc.CoQuanDonVi as Record<string, unknown> | null)
          ?.ten_don_vi as string | undefined;

        if (donViTrucThuoc.co_quan_don_vi_id) {
          const parentManagers = await prisma.taiKhoan.findMany({
            where: {
              role: ROLES.MANAGER,
              QuanNhan: { co_quan_don_vi_id: donViTrucThuoc.co_quan_don_vi_id as string },
            },
            select: { id: true, role: true },
          });

          parentManagers.forEach(manager => {
            notifications.push({
              nguoi_nhan_id: manager.id,
              recipient_role: manager.role,
              type: NOTIFICATION_TYPES.AWARD_UPDATED,
              title: 'Khen thưởng đơn vị trực thuộc đã được cập nhật',
              message: `${adminUsername} đã cập nhật khen thưởng đột xuất "${awardName}" năm ${year} của đơn vị ${unitName}${
                parentUnitName ? ` (thuộc ${parentUnitName})` : ''
              }`,
              resource: RESOURCE_TYPES.AWARDS,
              tai_nguyen_id: adhocAward.id as string,
              link: `/manager/awards`,
            });
          });
        }
      }
    }

    if (notifications.length > 0) {
      await prisma.thongBao.createMany({ data: notifications });
    }

    return notifications.length;
  }

  async deleteAdhocAward(id: string, adminId: string): Promise<{ success: boolean }> {
    try {
      const admin = await prisma.taiKhoan.findUnique({
        where: { id: adminId },
      });

      const adhocAward = await prisma.khenThuongDotXuat.findUnique({
        where: { id },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: true,
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
        throw new Error('Khen thưởng đột xuất không tồn tại');
      }

      const awardInfo = { ...adhocAward };

      const attachedFilesRaw = adhocAward.files_dinh_kem as unknown as AttachedFileInfo[] | null;
      const attachedFilesList = attachedFilesRaw || [];

      for (const file of attachedFilesList) {
        try {
          const fullPath = path.join(__dirname, '..', '..', file.path);
          await fs.unlink(fullPath);
        } catch {
          // ignore
        }
      }

      await prisma.khenThuongDotXuat.delete({
        where: { id },
      });

      try {
        await this._notifyOnAdhocAwardDeleted(awardInfo, admin?.username || 'Admin');
      } catch {
        // ignore
      }

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  async _notifyOnAdhocAwardDeleted(
    adhocAward: Record<string, unknown>,
    adminUsername: string
  ): Promise<number> {
    const notifications: NotificationData[] = [];
    const awardName = adhocAward.hinh_thuc_khen_thuong as string;
    const year = adhocAward.nam as number;

    if (adhocAward.doi_tuong === 'CA_NHAN' && adhocAward.QuanNhan) {
      const personnel = adhocAward.QuanNhan as Record<string, unknown>;

      const donViId =
        (personnel.co_quan_don_vi_id as string) || (personnel.don_vi_truc_thuoc_id as string);
      if (donViId) {
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: personnel.co_quan_don_vi_id as string },
                { don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id as string },
              ].filter(Boolean),
            },
          },
          select: { id: true, role: true },
        });

        managers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_DELETED,
            title: 'Khen thưởng đột xuất đã bị xóa',
            message: `${adminUsername} đã xóa khen thưởng đột xuất "${awardName}" năm ${year} của quân nhân ${personnel.ho_ten}`,
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: personnel.id as string,
            link: `/manager/awards`,
          });
        });
      }

      const personnelAccount = await prisma.taiKhoan.findFirst({
        where: { quan_nhan_id: personnel.id as string },
        select: { id: true, role: true },
      });

      if (personnelAccount) {
        notifications.push({
          nguoi_nhan_id: personnelAccount.id,
          recipient_role: personnelAccount.role,
          type: NOTIFICATION_TYPES.AWARD_DELETED,
          title: 'Khen thưởng của bạn đã bị xóa',
          message: `Khen thưởng đột xuất "${awardName}" năm ${year} của bạn đã bị xóa khỏi hệ thống`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: personnel.id as string,
          link: `/user/profile`,
        });
      }
    } else if (adhocAward.doi_tuong === 'TAP_THE') {
      let unitName = '';

      if (adhocAward.CoQuanDonVi) {
        const coQuanDonVi = adhocAward.CoQuanDonVi as Record<string, unknown>;
        unitName = coQuanDonVi.ten_don_vi as string;
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: { co_quan_don_vi_id: adhocAward.co_quan_don_vi_id as string },
          },
          select: { id: true, role: true },
        });

        managers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_DELETED,
            title: 'Khen thưởng đơn vị đã bị xóa',
            message: `${adminUsername} đã xóa khen thưởng đột xuất "${awardName}" năm ${year} của đơn vị ${unitName}`,
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.co_quan_don_vi_id as string,
            link: `/manager/awards`,
          });
        });
      } else if (adhocAward.DonViTrucThuoc) {
        const donViTrucThuoc = adhocAward.DonViTrucThuoc as Record<string, unknown>;
        unitName = donViTrucThuoc.ten_don_vi as string;
        const parentUnitName = (donViTrucThuoc.CoQuanDonVi as Record<string, unknown> | null)
          ?.ten_don_vi as string | undefined;

        if (donViTrucThuoc.co_quan_don_vi_id) {
          const parentManagers = await prisma.taiKhoan.findMany({
            where: {
              role: ROLES.MANAGER,
              QuanNhan: { co_quan_don_vi_id: donViTrucThuoc.co_quan_don_vi_id as string },
            },
            select: { id: true, role: true },
          });

          parentManagers.forEach(manager => {
            notifications.push({
              nguoi_nhan_id: manager.id,
              recipient_role: manager.role,
              type: NOTIFICATION_TYPES.AWARD_DELETED,
              title: 'Khen thưởng đơn vị trực thuộc đã bị xóa',
              message: `${adminUsername} đã xóa khen thưởng đột xuất "${awardName}" năm ${year} của đơn vị ${unitName}${
                parentUnitName ? ` (thuộc ${parentUnitName})` : ''
              }`,
              resource: RESOURCE_TYPES.AWARDS,
              tai_nguyen_id: adhocAward.don_vi_truc_thuoc_id as string,
              link: `/manager/awards`,
            });
          });
        }
      }
    }

    if (notifications.length > 0) {
      await prisma.thongBao.createMany({ data: notifications });
    }

    return notifications.length;
  }

  async getAdhocAwardsByPersonnel(personnelId: string): Promise<KhenThuongDotXuat[]> {
    try {
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      const adhocAwards = await prisma.khenThuongDotXuat.findMany({
        where: {
          doi_tuong: 'CA_NHAN',
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
    } catch (error) {
      throw error;
    }
  }

  async getAdhocAwardsByUnit(unitId: string, unitType: string): Promise<KhenThuongDotXuat[]> {
    try {
      const where: Prisma.KhenThuongDotXuatWhereInput = {
        doi_tuong: 'TAP_THE',
      };

      if (unitType === 'CO_QUAN_DON_VI') {
        where.co_quan_don_vi_id = unitId;

        const unit = await prisma.coQuanDonVi.findUnique({
          where: { id: unitId },
        });

        if (!unit) {
          throw new Error('Cơ quan đơn vị không tồn tại');
        }
      } else if (unitType === 'DON_VI_TRUC_THUOC') {
        where.don_vi_truc_thuoc_id = unitId;

        const unit = await prisma.donViTrucThuoc.findUnique({
          where: { id: unitId },
        });

        if (!unit) {
          throw new Error('Đơn vị trực thuộc không tồn tại');
        }
      }

      const adhocAwards = await prisma.khenThuongDotXuat.findMany({
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
    } catch (error) {
      throw error;
    }
  }
}

export default new AdhocAwardService();
