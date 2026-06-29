import { prisma } from '../models';
import { decisionFileRepository } from '../repositories/decisionFile.repository';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import type { FileQuyetDinh, Prisma } from '../generated/prisma';
import { cascadeRenameSoQuyetDinh, type CascadeRenameSummary } from './decision/cascadeRename';
import { findDecisionUsages, formatUsageError } from './decision/findUsages';
import { deleteStoredFile } from '../helpers/file/fileStorage';

export type UpdateDecisionResult = FileQuyetDinh & {
  cascade: CascadeRenameSummary | null;
};

interface DecisionFilters {
  nam?: number;
  loai_khen_thuong?: string;
  search?: string;
}

interface PaginatedDecisions {
  decisions: FileQuyetDinh[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface FilePathResult {
  success: boolean;
  file_path: string | null;
  decision: FileQuyetDinh | null;
  error: string | null;
}

interface CreateDecisionData {
  so_quyet_dinh: string;
  nam: number;
  ngay_ky: Date;
  nguoi_ky: string;
  file_path?: string | null;
  loai_khen_thuong?: string | null;
  ghi_chu?: string | null;
}

interface UpdateDecisionData {
  so_quyet_dinh?: string;
  nam?: number;
  ngay_ky?: Date;
  nguoi_ky?: string;
  file_path?: string | null;
  loai_khen_thuong?: string | null;
  ghi_chu?: string | null;
}

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DECISION SERVICE — quản lý số quyết định (so_quyet_dinh) — REGISTRY
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  BUSINESS RULE:
 *  Mỗi khen thưởng PHẢI có số quyết định (so_quyet_dinh) — căn cứ pháp lý.
 *  Số QĐ là string format: "123/QĐ-HV" (số/QĐ-Cơ quan ban hành).
 *  Bảng FileQuyetDinh đóng vai trò REGISTRY trung tâm:
 *
 *      FileQuyetDinh {
 *        so_quyet_dinh    UNIQUE  ← key
 *        nam              INT     ← năm ban hành
 *        ngay_ky          DATE    ← ngày ký
 *        nguoi_ky         STRING  ← người ký
 *        file_path        STRING? ← path PDF (nullable, có thể upload sau)
 *        loai_khen_thuong STRING  ← loại khen thưởng (HCCSVV, ĐVQT, ...)
 *      }
 *
 *  UNIQUE CONSTRAINT trên so_quyet_dinh:
 *  - 1 số QĐ chỉ ghi 1 lần. Lý do: trong giấy tờ thật, 1 số QĐ = 1 văn
 *    bản ký bởi 1 cấp có thẩm quyền tại 1 thời điểm.
 *  - Insert trùng → Prisma throw P2002 → service trả message thân thiện.
 *
 *  TRUY VẤN SEARCH (case-insensitive prefix):
 *  - `contains` + `mode: 'insensitive'` → SELECT ... WHERE so_quyet_dinh
 *    ILIKE '%search%'.
 *  - PostgreSQL ILIKE chậm hơn LIKE → cần index `idx_so_quyet_dinh_lower`
 *    cho production (chưa add).
 *  - Autocomplete API trả top 10 → tránh load toàn bộ list về FE.
 *
 *  RELATION:
 *  - 1 FileQuyetDinh → N award records (DanhHieuHangNam, KhenThuongHCCSVV,
 *    KhenThuongHCBVTQ, ...). FK trỏ qua so_quyet_dinh (KHÔNG dùng id) —
 *    để giữ tính semantic + dễ search/export.
 *  - syncDecisionFiles trong approve flow auto-tạo FileQuyetDinh nếu chưa
 *    có (xem `approve/decisionMappings.ts`).
 *
 *  PDF UPLOAD pattern:
 *  - file_path nullable → tạo decision trước, upload PDF sau cũng được.
 *  - Lazy population: khi user upload PDF lần đầu, update field.
 *  - Một QĐ chỉ có 1 PDF (không hỗ trợ multiple versions).
 *
 *  HISTORY-AWARE DELETE:
 *  Xoá FileQuyetDinh trong khi có award reference → FK violation. Service
 *  check trước khi xoá: nếu có >0 award đang tham chiếu → reject.
 * ════════════════════════════════════════════════════════════════════════════
 */
class DecisionService {
  async getAllDecisions(
    filters: DecisionFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedDecisions> {
    const { nam, loai_khen_thuong, search } = filters;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.FileQuyetDinhWhereInput = {};
    if (nam) whereClause.nam = parseInt(String(nam));
    if (loai_khen_thuong) whereClause.loai_khen_thuong = loai_khen_thuong;
    if (search) {
      whereClause.OR = [
        { so_quyet_dinh: { contains: search, mode: 'insensitive' } },
        { nguoi_ky: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [decisions, total] = await Promise.all([
      decisionFileRepository.findManyRaw({
        where: whereClause,
        orderBy: [{ nam: 'desc' }, { ngay_ky: 'desc' }, { so_quyet_dinh: 'desc' }],
        skip,
        take: limit,
      }),
      decisionFileRepository.count(whereClause),
    ]);

    return {
      decisions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async autocomplete(
    query: string,
    limit: number = 10,
    loaiKhenThuong?: string
  ): Promise<FileQuyetDinh[]> {
    if (!query || query.trim() === '') {
      return [];
    }

    const where: Record<string, unknown> = {
      so_quyet_dinh: {
        contains: query.trim(),
        mode: 'insensitive',
      },
    };
    if (loaiKhenThuong) where.loai_khen_thuong = loaiKhenThuong;

    const decisions = await decisionFileRepository.findManyRaw({
      where,
      orderBy: [{ nam: 'desc' }, { ngay_ky: 'desc' }],
      take: limit,
    });

    return decisions;
  }

  async getDecisionById(id: string): Promise<FileQuyetDinh> {
    const decision = await decisionFileRepository.findUniqueRaw({
      where: { id },
    });

    if (!decision) {
      throw new NotFoundError('Quyết định');
    }

    return decision;
  }

  async getDecisionBySoQuyetDinh(soQuyetDinh: string): Promise<FileQuyetDinh | null> {
    const decision = await decisionFileRepository.findUniqueRaw({
      where: { so_quyet_dinh: soQuyetDinh },
    });

    return decision;
  }

  async getFilePathBySoQuyetDinh(soQuyetDinh: string): Promise<FilePathResult> {
    try {
      if (!soQuyetDinh || soQuyetDinh.trim() === '') {
        return {
          success: false,
          file_path: null,
          decision: null,
          error: 'Số quyết định không được để trống',
        };
      }

      const decision = await decisionFileRepository.findUniqueRaw({
        where: { so_quyet_dinh: soQuyetDinh.trim() },
      });

      if (!decision) {
        return {
          success: false,
          file_path: null,
          decision: null,
          error: 'Không tìm thấy quyết định với số này',
        };
      }

      if (!decision.file_path) {
        return {
          success: false,
          file_path: null,
          decision: decision,
          error: 'Quyết định này chưa có file đính kèm',
        };
      }

      return {
        success: true,
        file_path: decision.file_path,
        decision: decision,
        error: null,
      };
    } catch (error) {
      console.error('[decision.getFilePath] error:', error);
      return {
        success: false,
        file_path: null,
        decision: null,
        error: 'Có lỗi xảy ra khi lấy file quyết định',
      };
    }
  }

  async getFilePathsBySoQuyetDinhs(
    soQuyetDinhs: string[]
  ): Promise<Record<string, FilePathResult>> {
    if (!Array.isArray(soQuyetDinhs) || soQuyetDinhs.length === 0) {
      return {};
    }

    const validSoQDs = soQuyetDinhs.filter(sq => sq && sq.trim() !== '').map(sq => sq.trim());

    if (validSoQDs.length === 0) {
      return {};
    }

    const decisions = await decisionFileRepository.findManyRaw({
      where: {
        so_quyet_dinh: {
          in: validSoQDs,
        },
      },
    });

    const decisionMap: Record<string, FileQuyetDinh> = {};
    decisions.forEach(d => {
      decisionMap[d.so_quyet_dinh] = d;
    });

    const result: Record<string, FilePathResult> = {};
    validSoQDs.forEach(soQD => {
      const decision = decisionMap[soQD];
      if (!decision) {
        result[soQD] = {
          success: false,
          file_path: null,
          decision: null,
          error: 'Không tìm thấy quyết định',
        };
      } else if (!decision.file_path) {
        result[soQD] = {
          success: false,
          file_path: null,
          decision: decision,
          error: 'Chưa có file đính kèm',
        };
      } else {
        result[soQD] = {
          success: true,
          file_path: decision.file_path,
          decision: decision,
          error: null,
        };
      }
    });

    return result;
  }

  async createDecision(data: CreateDecisionData): Promise<FileQuyetDinh> {
    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, file_path, loai_khen_thuong, ghi_chu } = data;

    const existingDecision = await decisionFileRepository.findUniqueRaw({
      where: { so_quyet_dinh },
    });

    if (existingDecision) {
      throw new AppError('Số quyết định đã tồn tại', 409);
    }

    if (!so_quyet_dinh || !nam || !ngay_ky || !nguoi_ky) {
      throw new ValidationError('Thiếu thông tin bắt buộc: số quyết định, năm, ngày ký, người ký');
    }

    const newDecision = await decisionFileRepository.create({
      so_quyet_dinh: so_quyet_dinh.trim(),
      nam: parseInt(String(nam)),
      ngay_ky: new Date(ngay_ky),
      nguoi_ky: nguoi_ky.trim(),
      file_path: file_path || null,
      loai_khen_thuong: loai_khen_thuong || null,
      ghi_chu: ghi_chu || null,
    });

    return newDecision;
  }

  async updateDecision(id: string, data: UpdateDecisionData): Promise<UpdateDecisionResult> {
    const existingDecision = await decisionFileRepository.findUniqueRaw({
      where: { id },
    });

    if (!existingDecision) {
      throw new NotFoundError('Quyết định');
    }

    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, file_path, loai_khen_thuong, ghi_chu } = data;
    const newSqd = so_quyet_dinh?.trim();

    if (so_quyet_dinh !== undefined && !newSqd) {
      throw new ValidationError('Số quyết định không được để trống');
    }

    const oldSqd = existingDecision.so_quyet_dinh;
    const willRename = !!newSqd && newSqd !== oldSqd;

    if (willRename) {
      const duplicateDecision = await decisionFileRepository.findUniqueRaw({
        where: { so_quyet_dinh: newSqd },
      });

      if (duplicateDecision) {
        throw new AppError('Số quyết định đã tồn tại', 409);
      }
    }

    const updateData: Prisma.FileQuyetDinhUncheckedUpdateInput = {};
    if (newSqd !== undefined) updateData.so_quyet_dinh = newSqd;
    if (nam !== undefined) updateData.nam = parseInt(String(nam));
    if (ngay_ky !== undefined) updateData.ngay_ky = new Date(ngay_ky);
    if (nguoi_ky !== undefined) updateData.nguoi_ky = nguoi_ky.trim();
    if (file_path !== undefined) updateData.file_path = file_path || null;
    if (loai_khen_thuong !== undefined) updateData.loai_khen_thuong = loai_khen_thuong;
    if (ghi_chu !== undefined) updateData.ghi_chu = ghi_chu;

    const { decision, cascade } = await prisma.$transaction(async tx => {
      const updated = await decisionFileRepository.update(id, updateData, tx);
      const cascadeSummary = willRename
        ? await cascadeRenameSoQuyetDinh(tx, oldSqd, newSqd!)
        : null;
      return { decision: updated, cascade: cascadeSummary };
    });

    if (
      file_path !== undefined &&
      existingDecision.file_path &&
      existingDecision.file_path !== file_path
    ) {
      await deleteStoredFile(existingDecision.file_path);
    }

    return { ...decision, cascade };
  }

  async deleteDecision(id: string): Promise<{ message: string; decision: FileQuyetDinh }> {
    const existingDecision = await decisionFileRepository.findUniqueRaw({
      where: { id },
    });

    if (!existingDecision) {
      throw new NotFoundError('Quyết định');
    }

    const usage = await findDecisionUsages(existingDecision.so_quyet_dinh);
    if (usage.inUse) {
      throw new ValidationError(formatUsageError(existingDecision.so_quyet_dinh, usage));
    }

    await decisionFileRepository.delete(id);
    await deleteStoredFile(existingDecision.file_path);

    return { message: 'Xóa quyết định thành công', decision: existingDecision };
  }

  async getAvailableYears(): Promise<number[]> {
    const years = await decisionFileRepository.findManyRaw({
      select: {
        nam: true,
      },
      distinct: ['nam'],
      orderBy: {
        nam: 'desc',
      },
    });

    return years.map(y => y.nam);
  }

  async getAwardTypes(): Promise<string[]> {
    const types = await decisionFileRepository.findManyRaw({
      select: {
        loai_khen_thuong: true,
      },
      distinct: ['loai_khen_thuong'],
      where: {
        loai_khen_thuong: {
          not: null,
        },
      },
    });

    return types.map(t => t.loai_khen_thuong).filter((t): t is string => t !== null);
  }
}

export default new DecisionService();
