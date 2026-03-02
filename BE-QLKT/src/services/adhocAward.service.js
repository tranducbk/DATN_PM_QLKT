const { prisma } = require('../models');
const path = require('path');
const fs = require('fs').promises;
const notificationHelper = require('../helpers/notificationHelper');
const { NOTIFICATION_TYPES, RESOURCE_TYPES } = require('../constants/notificationTypes');

class AdhocAwardService {
  /**
   * Create ad-hoc award
   */
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
  }) {
    try {
      // Verify admin exists
      const admin = await prisma.taiKhoan.findUnique({
        where: { id: adminId },
      });

      if (!admin || admin.role !== 'ADMIN') {
        throw new Error('Chỉ Admin mới có quyền tạo khen thưởng đột xuất');
      }

      // Verify personnel exists if type is CA_NHAN
      if (type === 'CA_NHAN') {
        const personnel = await prisma.quanNhan.findUnique({
          where: { id: personnelId },
        });

        if (!personnel) {
          throw new Error('Quân nhân không tồn tại');
        }
      }

      // Verify unit exists if type is TAP_THE
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

      // Handle file uploads - chỉ xử lý attached files
      const proposalsDir = path.join(__dirname, '..', '..', 'storage', 'proposals');
      await fs.mkdir(proposalsDir, { recursive: true });

      const uploadedAttachedFiles = [];

      // Handle attached files
      if (attachedFiles && attachedFiles.length > 0) {
        const attachedDir = path.join(__dirname, '..', '..', 'storage', 'proposals');
        await fs.mkdir(attachedDir, { recursive: true });

        for (const file of attachedFiles) {
          const timestamp = Date.now();
          // Decode UTF-8 filename properly (multer may encode non-ASCII characters)
          let decodedName = file.originalname;
          try {
            // Try to decode if it looks like it was encoded incorrectly
            decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          } catch {
            decodedName = file.originalname;
          }
          // Sanitize filename: remove special characters but keep Vietnamese
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

      // Create ad-hoc award
      const adhocAward = await prisma.khenThuongDotXuat.create({
        data: {
          loai: 'KHEN_THUONG_DOT_XUAT',
          doi_tuong: type, // CA_NHAN hoặc TAP_THE
          ...(type === 'CA_NHAN' && personnelId && { quan_nhan_id: personnelId }),
          ...(type === 'TAP_THE' && unitType === 'CO_QUAN_DON_VI' && { co_quan_don_vi_id: unitId }),
          ...(type === 'TAP_THE' &&
            unitType === 'DON_VI_TRUC_THUOC' && { don_vi_truc_thuoc_id: unitId }),
          hinh_thuc_khen_thuong: awardForm,
          nam: year,
          // Cấp bậc và chức vụ cho phép trống (null)
          cap_bac: rank || null,
          chuc_vu: position || null,
          ghi_chu: note || null,
          so_quyet_dinh: decisionNumber || null,
          files_dinh_kem: uploadedAttachedFiles.length > 0 ? uploadedAttachedFiles : null,
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

      // Gửi thông báo
      try {
        await this._notifyOnAdhocAwardCreated(adhocAward, admin.username);
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
        // Không throw error để không ảnh hưởng đến việc tạo khen thưởng
      }

      return adhocAward;
    } catch (error) {
      console.error('Create ad-hoc award error:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi tạo khen thưởng đột xuất
   * -> Manager của đơn vị và quân nhân (nếu có tài khoản) nhận thông báo
   */
  async _notifyOnAdhocAwardCreated(adhocAward, adminUsername) {
    const notifications = [];

    if (adhocAward.doi_tuong === 'CA_NHAN' && adhocAward.QuanNhan) {
      const personnel = adhocAward.QuanNhan;
      const awardName = adhocAward.hinh_thuc_khen_thuong;
      const year = adhocAward.nam;

      // 1. Thông báo cho Manager của đơn vị quân nhân
      const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
      if (donViId) {
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: personnel.co_quan_don_vi_id },
                { don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id },
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
            tai_nguyen_id: adhocAward.id,
            link: `/manager/awards`,
          });
        });
      }

      // 2. Thông báo cho quân nhân (nếu có tài khoản)
      const personnelAccount = await prisma.taiKhoan.findFirst({
        where: { quan_nhan_id: personnel.id },
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
          tai_nguyen_id: adhocAward.id,
          link: `/user/profile`,
        });
      }
    } else if (adhocAward.doi_tuong === 'TAP_THE') {
      // Thông báo cho Manager của đơn vị được khen thưởng
      const awardName = adhocAward.hinh_thuc_khen_thuong;
      const year = adhocAward.nam;
      let unitName = '';

      if (adhocAward.CoQuanDonVi) {
        unitName = adhocAward.CoQuanDonVi.ten_don_vi;
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
            QuanNhan: { co_quan_don_vi_id: adhocAward.co_quan_don_vi_id },
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
            tai_nguyen_id: adhocAward.id,
            link: `/manager/awards`,
          });
        });
      } else if (adhocAward.DonViTrucThuoc) {
        unitName = adhocAward.DonViTrucThuoc.ten_don_vi;
        const parentUnitName = adhocAward.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi;

        // Chỉ thông báo cho Manager của cơ quan đơn vị cha
        if (adhocAward.DonViTrucThuoc.co_quan_don_vi_id) {
          const parentManagers = await prisma.taiKhoan.findMany({
            where: {
              role: 'MANAGER',
              QuanNhan: { co_quan_don_vi_id: adhocAward.DonViTrucThuoc.co_quan_don_vi_id },
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
              tai_nguyen_id: adhocAward.id,
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

  /**
   * Get all ad-hoc awards with filters and pagination
   * Supports manager-specific filters for unit-based access control
   */
  async getAdhocAwards({
    type,
    year,
    personnelId,
    unitId,
    ho_ten,
    page = 1,
    limit = 1000,
    // Manager-specific filters
    managerCoQuanId,
    managerDonViTrucThuocIds,
    managerDonViTrucThuocId,
  }) {
    try {
      const skip = (page - 1) * limit;

      const where = {};

      if (type) {
        where.doi_tuong = type; // Filter theo đối tượng (CA_NHAN/TAP_THE)
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

      // Filter by personnel name
      if (ho_ten) {
        where.QuanNhan = {
          ho_ten: { contains: ho_ten, mode: 'insensitive' },
        };
      }

      // Manager-specific unit filter
      if (managerCoQuanId) {
        // Manager belongs to a co_quan_don_vi - can see:
        // 1. CA_NHAN awards for personnel in their unit or subordinate units
        // 2. TAP_THE awards for their unit or subordinate units
        const unitFilter = [];

        // CA_NHAN: QuanNhan belongs to co_quan or don_vi_truc_thuoc
        unitFilter.push({
          doi_tuong: 'CA_NHAN',
          QuanNhan: {
            ...(ho_ten && { ho_ten: { contains: ho_ten, mode: 'insensitive' } }),
            OR: [
              { co_quan_don_vi_id: managerCoQuanId },
              ...(managerDonViTrucThuocIds?.length > 0
                ? [{ don_vi_truc_thuoc_id: { in: managerDonViTrucThuocIds } }]
                : []),
            ],
          },
        });

        // TAP_THE: Award directly for co_quan or don_vi_truc_thuoc
        unitFilter.push({
          doi_tuong: 'TAP_THE',
          OR: [
            { co_quan_don_vi_id: managerCoQuanId },
            ...(managerDonViTrucThuocIds?.length > 0
              ? [{ don_vi_truc_thuoc_id: { in: managerDonViTrucThuocIds } }]
              : []),
          ],
        });

        // Merge with existing where conditions
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: unitFilter }];
          delete where.OR;
        } else {
          where.OR = unitFilter;
        }

        // Remove ho_ten from top-level if added (it's now inside the OR filter)
        if (ho_ten) {
          delete where.QuanNhan;
        }
      } else if (managerDonViTrucThuocId) {
        // Manager belongs to a don_vi_truc_thuoc - can only see:
        // 1. CA_NHAN awards for personnel in their unit
        // 2. TAP_THE awards for their unit
        const unitFilter = [];

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

        // Merge with existing where conditions
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: unitFilter }];
          delete where.OR;
        } else {
          where.OR = unitFilter;
        }

        // Remove ho_ten from top-level if added (it's now inside the OR filter)
        if (ho_ten) {
          delete where.QuanNhan;
        }
      }

      const [total, data] = await Promise.all([
        prisma.khenThuongDotXuat.count({ where }),
        prisma.khenThuongDotXuat.findMany({
          where,
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
      console.error('Get ad-hoc awards error:', error);
      throw error;
    }
  }

  /**
   * Get single ad-hoc award by ID
   */
  async getAdhocAwardById(id) {
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
      console.error('Get ad-hoc award by ID error:', error);
      throw error;
    }
  }

  /**
   * Update ad-hoc award
   */
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
  }) {
    try {
      // Verify admin exists
      const admin = await prisma.taiKhoan.findUnique({
        where: { id: adminId },
      });

      if (!admin || admin.role !== 'ADMIN') {
        throw new Error('Chỉ Admin mới có quyền cập nhật khen thưởng đột xuất');
      }

      // Get existing record
      const existing = await prisma.khenThuongDotXuat.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Khen thưởng đột xuất không tồn tại');
      }

      // Handle existing attached files
      let existingAttachedFiles = existing.files_dinh_kem || [];

      // Remove attached files at specified indexes
      if (removeAttachedFileIndexes && removeAttachedFileIndexes.length > 0) {
        const filesToRemove = removeAttachedFileIndexes
          .sort((a, b) => b - a)
          .filter(index => index >= 0 && index < existingAttachedFiles.length);

        for (const index of filesToRemove) {
          const fileToRemove = existingAttachedFiles[index];
          try {
            const fullPath = path.join(__dirname, '..', '..', fileToRemove.path);
            await fs.unlink(fullPath);
          } catch (err) {
            console.error(`Failed to delete attached file: ${fileToRemove.path}`, err);
          }
          existingAttachedFiles.splice(index, 1);
        }
      }

      // Handle new attached file uploads
      if (attachedFiles && attachedFiles.length > 0) {
        const proposalsDir = path.join(__dirname, '..', '..', 'storage', 'proposals');
        await fs.mkdir(proposalsDir, { recursive: true });

        for (const file of attachedFiles) {
          const timestamp = Date.now();
          // Decode UTF-8 filename properly (multer may encode non-ASCII characters)
          let decodedName = file.originalname;
          try {
            decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          } catch {
            decodedName = file.originalname;
          }
          // Sanitize filename: remove special characters but keep Vietnamese
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

      // Update record
      const updateData = {};

      if (awardForm !== undefined) updateData.hinh_thuc_khen_thuong = awardForm;
      if (year !== undefined) updateData.nam = year;
      if (rank !== undefined) updateData.cap_bac = rank;
      if (position !== undefined) updateData.chuc_vu = position;
      if (note !== undefined) updateData.ghi_chu = note;
      if (decisionNumber !== undefined) updateData.so_quyet_dinh = decisionNumber;

      updateData.files_dinh_kem = existingAttachedFiles.length > 0 ? existingAttachedFiles : null;

      const updated = await prisma.khenThuongDotXuat.update({
        where: { id },
        data: updateData,
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

      // Gửi thông báo
      try {
        await this._notifyOnAdhocAwardUpdated(updated, admin.username);
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
      }

      return updated;
    } catch (error) {
      console.error('Update ad-hoc award error:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi cập nhật khen thưởng đột xuất
   */
  async _notifyOnAdhocAwardUpdated(adhocAward, adminUsername) {
    const notifications = [];
    const awardName = adhocAward.hinh_thuc_khen_thuong;
    const year = adhocAward.nam;

    if (adhocAward.doi_tuong === 'CA_NHAN' && adhocAward.QuanNhan) {
      const personnel = adhocAward.QuanNhan;

      // 1. Thông báo cho Manager của đơn vị quân nhân
      const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
      if (donViId) {
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: personnel.co_quan_don_vi_id },
                { don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id },
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
            tai_nguyen_id: adhocAward.id,
            link: `/manager/awards`,
          });
        });
      }

      // 2. Thông báo cho quân nhân (nếu có tài khoản)
      const personnelAccount = await prisma.taiKhoan.findFirst({
        where: { quan_nhan_id: personnel.id },
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
          tai_nguyen_id: adhocAward.id,
          link: `/user/profile`,
        });
      }
    } else if (adhocAward.doi_tuong === 'TAP_THE') {
      let unitName = '';

      if (adhocAward.CoQuanDonVi) {
        unitName = adhocAward.CoQuanDonVi.ten_don_vi;
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
            QuanNhan: { co_quan_don_vi_id: adhocAward.co_quan_don_vi_id },
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
            tai_nguyen_id: adhocAward.id,
            link: `/manager/awards`,
          });
        });
      } else if (adhocAward.DonViTrucThuoc) {
        unitName = adhocAward.DonViTrucThuoc.ten_don_vi;
        const parentUnitName = adhocAward.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi;

        // Chỉ thông báo cho Manager của cơ quan đơn vị cha
        if (adhocAward.DonViTrucThuoc.co_quan_don_vi_id) {
          const parentManagers = await prisma.taiKhoan.findMany({
            where: {
              role: 'MANAGER',
              QuanNhan: { co_quan_don_vi_id: adhocAward.DonViTrucThuoc.co_quan_don_vi_id },
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
              tai_nguyen_id: adhocAward.id,
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

  /**
   * Delete ad-hoc award
   */
  async deleteAdhocAward(id, adminId) {
    try {
      // Lấy thông tin admin
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

      // Lưu thông tin để gửi thông báo trước khi xóa
      const awardInfo = { ...adhocAward };

      // Delete associated attached files (file quyết định không lưu trong award, chỉ lưu số quyết định)
      const attachedFiles = adhocAward.files_dinh_kem || [];

      for (const file of attachedFiles) {
        try {
          const fullPath = path.join(__dirname, '..', '..', file.path);
          await fs.unlink(fullPath);
        } catch (err) {
          console.error(`Failed to delete file: ${file.path}`, err);
        }
      }

      // Delete record
      await prisma.khenThuongDotXuat.delete({
        where: { id },
      });

      // Gửi thông báo
      try {
        await this._notifyOnAdhocAwardDeleted(awardInfo, admin?.username || 'Admin');
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
      }

      return { success: true };
    } catch (error) {
      console.error('Delete ad-hoc award error:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi xóa khen thưởng đột xuất
   */
  async _notifyOnAdhocAwardDeleted(adhocAward, adminUsername) {
    const notifications = [];
    const awardName = adhocAward.hinh_thuc_khen_thuong;
    const year = adhocAward.nam;

    if (adhocAward.doi_tuong === 'CA_NHAN' && adhocAward.QuanNhan) {
      const personnel = adhocAward.QuanNhan;

      // 1. Thông báo cho Manager của đơn vị quân nhân
      const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
      if (donViId) {
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: personnel.co_quan_don_vi_id },
                { don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id },
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
            tai_nguyen_id: personnel.id,
            link: `/manager/awards`,
          });
        });
      }

      // 2. Thông báo cho quân nhân (nếu có tài khoản)
      const personnelAccount = await prisma.taiKhoan.findFirst({
        where: { quan_nhan_id: personnel.id },
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
          tai_nguyen_id: personnel.id,
          link: `/user/profile`,
        });
      }
    } else if (adhocAward.doi_tuong === 'TAP_THE') {
      let unitName = '';

      if (adhocAward.CoQuanDonVi) {
        unitName = adhocAward.CoQuanDonVi.ten_don_vi;
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
            QuanNhan: { co_quan_don_vi_id: adhocAward.co_quan_don_vi_id },
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
            tai_nguyen_id: adhocAward.co_quan_don_vi_id,
            link: `/manager/awards`,
          });
        });
      } else if (adhocAward.DonViTrucThuoc) {
        unitName = adhocAward.DonViTrucThuoc.ten_don_vi;
        const parentUnitName = adhocAward.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi;

        // Chỉ thông báo cho Manager của cơ quan đơn vị cha
        if (adhocAward.DonViTrucThuoc.co_quan_don_vi_id) {
          const parentManagers = await prisma.taiKhoan.findMany({
            where: {
              role: 'MANAGER',
              QuanNhan: { co_quan_don_vi_id: adhocAward.DonViTrucThuoc.co_quan_don_vi_id },
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
              tai_nguyen_id: adhocAward.don_vi_truc_thuoc_id,
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

  /**
   * Get all ad-hoc awards for a specific personnel
   */
  async getAdhocAwardsByPersonnel(personnelId) {
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
      console.error('Get ad-hoc awards by personnel error:', error);
      throw error;
    }
  }

  /**
   * Get all ad-hoc awards for a specific unit
   */
  async getAdhocAwardsByUnit(unitId, unitType) {
    try {
      const where = {
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
      console.error('Get ad-hoc awards by unit error:', error);
      throw error;
    }
  }
}

module.exports = new AdhocAwardService();
