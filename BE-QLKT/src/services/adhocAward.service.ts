/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ADHOC AWARD SERVICE — khen thưởng đột xuất (KhenThuongDotXuat)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  BUSINESS RULE:
 *  Khen thưởng đột xuất KHÔNG đi qua quy trình đề xuất (Manager → Admin
 *  duyệt). Admin trực tiếp tạo khi có sự kiện đột xuất (vd: cứu người,
 *  hoàn thành nhiệm vụ đặc biệt).
 *
 *  ĐẶC THÙ:
 *  - Đối tượng: cá nhân HOẶC đơn vị (mutually exclusive).
 *  - Không có chuỗi/cấp bậc → 1 record độc lập.
 *  - Có thể attach nhiều file (ảnh + tài liệu).
 *  - Loại khen thưởng tự do (free text danh hieu).
 *
 *  WHY tách khỏi proposal flow:
 *  - Tính chất "đột xuất" cần xử lý nhanh, không qua duyệt nhiều bước.
 *  - Strategy pattern không apply (không có chuỗi, không có eligibility check).
 *  - File attachment đa dạng (ảnh, PDF, Word) — khác PDF quyết định.
 *
 *  ATTT — UPLOAD FILE:
 *  - multer adhocAwardUpload accept ảnh + doc + xls (xem configs/multer.ts).
 *  - Limit 50MB/file (lớn hơn 10MB của proposal vì có ảnh).
 *  - File QĐ → uploads/decisions/ (dedup tên "(1)(2)", persistDecisionFile).
 *  - File đính kèm → storage/proposals/ (tên <timestamp>_<sanitized>).
 *  - DB chỉ lưu metadata (đường dẫn tương đối) trong JSON files_dinh_kem;
 *    FE xem qua signed URL, không chạm đường dẫn thật.
 *
 *  NOTIFICATION:
 *  Sau khi tạo, notify đối tượng được khen + manager đơn vị qua socket.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
import { sanitizeFilename } from './proposal/helpers';
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
  // Giới hạn phạm vi xem theo đơn vị của Manager: chỉ thấy khen thưởng (cá nhân +
  // tập thể) thuộc đơn vị mình quản lý. Xây dựng mệnh đề OR gồm 2 vế CA_NHAN/TAP_THE.
  private applyManagerUnitFilter(
    where: Record<string, unknown>,
    hoTen: string | undefined,
    filter: ManagerUnitFilter
  ): void {
    const unitFilter: Record<string, unknown>[] = [];

    if (filter.type === 'coQuan') {
      // Manager cấp CQDV: thấy CQDV cha + tất cả ĐVTT con (nếu có danh sách con)
      const dvttCondition =
        filter.dvttIds && filter.dvttIds.length > 0
          ? [{ don_vi_truc_thuoc_id: { in: filter.dvttIds } }]
          : [];

      // Khen cá nhân: quân nhân thuộc CQDV cha HOẶC một trong các ĐVTT con
      unitFilter.push({
        doi_tuong: ADHOC_TYPE.CA_NHAN,
        QuanNhan: {
          ...(hoTen && { ho_ten: { contains: hoTen, mode: 'insensitive' } }),
          OR: [{ co_quan_don_vi_id: filter.coQuanId }, ...dvttCondition],
        },
      });

      // Khen tập thể: đơn vị được khen là CQDV cha HOẶC một ĐVTT con
      unitFilter.push({
        doi_tuong: ADHOC_TYPE.TAP_THE,
        OR: [{ co_quan_don_vi_id: filter.coQuanId }, ...dvttCondition],
      });
    } else {
      // Manager cấp ĐVTT: chỉ thấy đúng ĐVTT đó (cá nhân thuộc ĐVTT)
      unitFilter.push({
        doi_tuong: ADHOC_TYPE.CA_NHAN,
        QuanNhan: {
          ...(hoTen && { ho_ten: { contains: hoTen, mode: 'insensitive' } }),
          don_vi_truc_thuoc_id: filter.dvttId,
        },
      });

      // ...và khen tập thể của đúng ĐVTT đó
      unitFilter.push({
        doi_tuong: ADHOC_TYPE.TAP_THE,
        don_vi_truc_thuoc_id: filter.dvttId,
      });
    }

    // Nếu đã có OR (vd lọc theo unitId), gộp bằng AND để KHÔNG nới rộng phạm vi quyền
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: unitFilter }];
      delete where.OR;
    } else {
      where.OR = unitFilter;
    }

    // ho_ten đã được nhét vào trong unitFilter → bỏ điều kiện trùng ở cấp ngoài
    if (hoTen) {
      delete where.QuanNhan;
    }
  }

  private async persistDecisionFile(file: UploadedFile): Promise<string> {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'decisions');
    await fs.mkdir(uploadsDir, { recursive: true });

    // multer lưu tên file dạng latin1 → giải mã về UTF-8 để giữ nguyên dấu tiếng Việt
    let decodedName = file.originalname;
    try {
      decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (error) {
      console.error('Failed to decode decision file name during adhoc-award create:', error);
    }

    const sanitized = sanitizeFilename(decodedName);
    const ext = path.extname(sanitized);
    const baseName = path.basename(sanitized, ext);
    let filename = sanitized;
    let counter = 1;
    // Giữ tên gốc cho dễ nhận biết; trùng thì thêm "(1)(2)" tránh ghi đè file
    // QĐ khác cùng tên (giống decisionUpload — xem configs/multer.ts).
    while (
      await fs
        .access(path.join(uploadsDir, filename))
        .then(() => true)
        .catch(() => false)
    ) {
      filename = `${baseName}(${counter})${ext}`;
      counter++;
    }

    await fs.writeFile(path.join(uploadsDir, filename), file.buffer);
    return `uploads/decisions/${filename}`;
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
    if (!soQuyetDinh) return; // Không nhập số QĐ → bỏ qua, không cần tạo bản ghi quyết định

    // Số QĐ đã có trong hệ thống → dùng lại, không tạo trùng
    const existing = await decisionService.getDecisionBySoQuyetDinh(soQuyetDinh);
    if (existing) return;

    // Số QĐ mới → bắt buộc đủ năm, ngày ký, người ký mới được tạo bản ghi quyết định
    if (!decisionYear || !signDate || !signer?.trim()) {
      throw new ValidationError('Quyết định mới cần đầy đủ năm, ngày ký và người ký quyết định');
    }

    const filePath = decisionFile?.buffer ? await this.persistDecisionFile(decisionFile) : null;

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

    // Phân quyền: chỉ Admin được tạo khen thưởng đột xuất
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Chỉ Admin mới có quyền tạo khen thưởng đột xuất');
    }

    // Khen cá nhân → xác minh quân nhân tồn tại
    if (type === ADHOC_TYPE.CA_NHAN) {
      const personnel = await quanNhanRepository.findIdById(String(personnelId));

      if (!personnel) {
        throw new NotFoundError('Quân nhân');
      }
    }

    // Khen tập thể → xác minh đơn vị tồn tại (CQDV hoặc ĐVTT tùy unitType)
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

    const proposalsDir = path.join(__dirname, '..', '..', 'storage', 'proposals');
    await fs.mkdir(proposalsDir, { recursive: true });

    // Lưu file đính kèm (ảnh/tài liệu) xuống đĩa, thu metadata để lưu vào DB
    const uploadedAttachedFiles: AttachedFileInfo[] = [];

    if (attachedFiles && attachedFiles.length > 0) {
      uploadedAttachedFiles.push(
        ...(await this.persistAdhocAttachments(attachedFiles, 'adhoc-award create'))
      );
    }

    await this.ensureDecisionRecord({
      decisionNumber,
      decisionYear,
      signDate,
      signer,
      decisionFile,
    });

    const adhocAward = await adhocAwardRepository.create({
      loai: 'KHEN_THUONG_DOT_XUAT',
      doi_tuong: type,
      // Gắn đúng 1 FK đối tượng theo loại (cá nhân / CQDV / ĐVTT) — loại trừ nhau
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
    attachedFiles: UploadedFile[],
    context: string
  ): Promise<AttachedFileInfo[]> {
    const dir = path.join(__dirname, '..', '..', 'storage', 'proposals');
    await fs.mkdir(dir, { recursive: true });
    const saved: AttachedFileInfo[] = [];
    for (const file of attachedFiles) {
      // Prefix timestamp → tên file vật lý không đụng nhau giữa các lần
      // upload; tên gốc (decodedName) vẫn giữ trong DB để hiển thị.
      const timestamp = Date.now();
      let decodedName = file.originalname;
      try {
        decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (error) {
        console.error(`Failed to decode uploaded attachment name during ${context}:`, error);
        decodedName = file.originalname;
      }
      const sanitizedName = decodedName.replace(/[<>:"/\\|?*]/g, '_');
      const uniqueName = `${timestamp}_${sanitizedName}`;
      await fs.writeFile(path.join(dir, uniqueName), file.buffer);
      saved.push({
        filename: uniqueName,
        originalName: decodedName,
        path: `storage/proposals/${uniqueName}`,
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

    // Ráp dần điều kiện lọc theo các tham số được truyền (đối tượng, năm, quân nhân, đơn vị, tên)
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
      // Lọc theo đơn vị: khớp CQDV hoặc ĐVTT
      where.OR = [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: unitId }];
    }

    if (ho_ten) {
      where.QuanNhan = {
        ho_ten: { contains: ho_ten, mode: 'insensitive' },
      };
    }

    // Nếu là Manager → áp thêm bộ lọc phạm vi đơn vị (chỉ thấy dữ liệu trong quyền)
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

    // Song song: đếm tổng (phân trang) + lấy dữ liệu trang kèm quân nhân/đơn vị/chức vụ
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

    // Phân quyền: chỉ Admin được cập nhật khen thưởng đột xuất
    if (!admin || admin.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Chỉ Admin mới có quyền cập nhật khen thưởng đột xuất');
    }

    const existing = await adhocAwardRepository.findUniqueRaw({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Khen thưởng đột xuất');
    }

    // Danh sách file hiện có (đọc từ cột JSON files_dinh_kem)
    let existingAttachedFiles: AttachedFileInfo[] = parseAttachedFiles(existing.files_dinh_kem);

    if (removeAttachedFileIndexes && removeAttachedFileIndexes.length > 0) {
      // Xóa từ index lớn → nhỏ để splice không làm lệch index các phần tử còn lại
      const filesToRemove = [...removeAttachedFileIndexes]
        .sort((a, b) => b - a)
        .filter(index => index >= 0 && index < existingAttachedFiles.length);

      for (const index of filesToRemove) {
        const fileToRemove = existingAttachedFiles[index];
        try {
          const fullPath = path.join(__dirname, '..', '..', fileToRemove.path);
          await fs.unlink(fullPath);
        } catch (error) {
          console.error('Failed to delete removed attachment during adhoc-award update:', error);
        }
        existingAttachedFiles.splice(index, 1);
      }
    }

    // Thêm file mới (nếu có) vào danh sách còn lại sau khi đã xóa ở trên
    if (attachedFiles && attachedFiles.length > 0) {
      existingAttachedFiles.push(
        ...(await this.persistAdhocAttachments(attachedFiles, 'adhoc-award update'))
      );
    }

    // Chỉ cập nhật field nào được gửi lên (undefined = không đổi) → partial update
    const updateData: Record<string, unknown> = {};

    if (awardForm !== undefined) updateData.hinh_thuc_khen_thuong = awardForm;
    if (year !== undefined) updateData.nam = year;
    if (rank !== undefined) updateData.cap_bac = rank;
    if (position !== undefined) updateData.chuc_vu = position;
    if (note !== undefined) updateData.ghi_chu = note;
    if (decisionNumber !== undefined) updateData.so_quyet_dinh = decisionNumber;

    // Ghi lại danh sách file sau chỉnh sửa (null nếu không còn file nào)
    updateData.files_dinh_kem = existingAttachedFiles.length > 0 ? existingAttachedFiles : null;

    const updated = await adhocAwardRepository.updateRaw({
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

    // Chụp lại bản ghi trước khi xóa để dùng cho thông báo (notify) sau đó
    const awardInfo = { ...adhocAward };

    // Dọn file vật lý trên đĩa; lỗi xóa file chỉ log, không chặn việc xóa bản ghi
    const attachedFilesRaw = adhocAward.files_dinh_kem as unknown as AttachedFileInfo[] | null;
    const attachedFilesList = attachedFilesRaw || [];

    for (const file of attachedFilesList) {
      try {
        const fullPath = path.join(__dirname, '..', '..', file.path);
        await fs.unlink(fullPath);
      } catch (error) {
        console.error('Failed to delete attachment file during adhoc-award delete:', error);
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: AWARD_SLUGS.ADHOC_AWARDS,
          description: `Lỗi xóa file đính kèm ${AWARD_LABEL}: ${error}`,
        });
      }
    }

    await adhocAwardRepository.delete(id);

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

    // Chỉ lấy khen cá nhân của đúng quân nhân này, mới nhất lên trước
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
    // Chỉ lấy khen tập thể; lọc theo đúng loại đơn vị (CQDV hoặc ĐVTT)
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
