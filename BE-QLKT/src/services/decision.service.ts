import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../models';
import { danhHieuHangNamRepository } from '../repositories/danhHieu.repository';
import { decisionFileRepository } from '../repositories/decisionFile.repository';
import { contributionMedalRepository } from '../repositories/contributionMedal.repository';
import { tenureMedalRepository } from '../repositories/tenureMedal.repository';
import { adhocAwardRepository } from '../repositories/adhocAward.repository';
import { militaryFlagRepository } from '../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../repositories/commemorativeMedal.repository';
import { scientificAchievementRepository } from '../repositories/scientificAchievement.repository';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import type { FileQuyetDinh, Prisma } from '../generated/prisma';

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

interface FileDownloadResult {
  success: boolean;
  filePath: string | null;
  filename: string | null;
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
    } catch (error: unknown) {
      return {
        success: false,
        file_path: null,
        decision: null,
        error: error instanceof Error ? error.message : 'Có lỗi xảy ra khi lấy file quyết định',
      };
    }
  }

  async getDecisionFileForDownload(soQuyetDinh: string): Promise<FileDownloadResult> {
    try {
      if (!soQuyetDinh || soQuyetDinh.trim() === '') {
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'Số quyết định không được để trống',
        };
      }

      const decision = await decisionFileRepository.findUniqueRaw({
        where: { so_quyet_dinh: soQuyetDinh.trim() },
      });

      if (!decision) {
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'Không tìm thấy quyết định với số này',
        };
      }

      if (!decision.file_path) {
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'Quyết định này chưa có file đính kèm',
        };
      }

      let filePath = decision.file_path;

      if (!path.isAbsolute(filePath)) {
        filePath = path.join(__dirname, '..', '..', filePath);
      }

      try {
        await fs.access(filePath);
        const filename = path.basename(filePath);

        return {
          success: true,
          filePath: filePath,
          filename: filename,
          error: null,
        };
      } catch (error) {
   console.error('Failed to access decision file on disk:', error);
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'File không tồn tại trong hệ thống',
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        filePath: null,
        filename: null,
        error: error instanceof Error ? error.message : 'Có lỗi xảy ra khi lấy file quyết định',
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

  async updateDecision(id: string, data: UpdateDecisionData): Promise<FileQuyetDinh> {
    const existingDecision = await decisionFileRepository.findUniqueRaw({
      where: { id },
    });

    if (!existingDecision) {
      throw new NotFoundError('Quyết định');
    }

    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, file_path, loai_khen_thuong, ghi_chu } = data;

    if (so_quyet_dinh && so_quyet_dinh !== existingDecision.so_quyet_dinh) {
      const duplicateDecision = await decisionFileRepository.findUniqueRaw({
        where: { so_quyet_dinh },
      });

      if (duplicateDecision) {
        throw new AppError('Số quyết định đã tồn tại', 409);
      }
    }

    const updateData: Prisma.FileQuyetDinhUpdateInput = {};
    if (so_quyet_dinh !== undefined) updateData.so_quyet_dinh = so_quyet_dinh.trim();
    if (nam !== undefined) updateData.nam = parseInt(String(nam));
    if (ngay_ky !== undefined) updateData.ngay_ky = new Date(ngay_ky);
    if (nguoi_ky !== undefined) updateData.nguoi_ky = nguoi_ky.trim();
    if (file_path !== undefined) updateData.file_path = file_path;
    if (loai_khen_thuong !== undefined) updateData.loai_khen_thuong = loai_khen_thuong;
    if (ghi_chu !== undefined) updateData.ghi_chu = ghi_chu;

    const updatedDecision = await decisionFileRepository.update(id, updateData);

    return updatedDecision;
  }

  async deleteDecision(id: string): Promise<{ message: string }> {
    const existingDecision = await decisionFileRepository.findUniqueRaw({
      where: { id },
    });

    if (!existingDecision) {
      throw new NotFoundError('Quyết định');
    }

    const soQuyetDinh = existingDecision.so_quyet_dinh;
    const [danhHieu, congHien, hccsvv, dotXuat, huanChuong, kyNiem, thanhTich] = await Promise.all([
      danhHieuHangNamRepository.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
      contributionMedalRepository.findFirstRaw({ where: { so_quyet_dinh: soQuyetDinh } }),
      tenureMedalRepository.findFirstRaw({ where: { so_quyet_dinh: soQuyetDinh } }),
      adhocAwardRepository.findFirstRaw({ where: { so_quyet_dinh: soQuyetDinh } }),
      militaryFlagRepository.findFirstRaw({ where: { so_quyet_dinh: soQuyetDinh } }),
      commemorativeMedalRepository.findFirstRaw({ where: { so_quyet_dinh: soQuyetDinh } }),
      scientificAchievementRepository.findFirstRaw({ where: { so_quyet_dinh: soQuyetDinh } }),
    ]);

    const isInUse = danhHieu || congHien || hccsvv || dotXuat || huanChuong || kyNiem || thanhTich;
    if (isInUse) {
      throw new ValidationError(
        `Không thể xóa quyết định "${soQuyetDinh}" vì đang được sử dụng trong dữ liệu khen thưởng.`
      );
    }

    await decisionFileRepository.delete(id);

    return { message: 'Xóa quyết định thành công' };
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
