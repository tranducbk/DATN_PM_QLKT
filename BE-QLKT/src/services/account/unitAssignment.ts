import { ROLES } from '../../constants/roles.constants';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../repositories/unit.repository';
import { positionRepository } from '../../repositories/position.repository';
import type { Prisma } from '../../generated/prisma';

interface CreateUnitAssignmentParams {
  role: string;
  username: string;
  personnel_id?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
}

interface UpdateUnitAssignmentParams {
  effectiveRole: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
}

interface ResolvedUnitAssignment {
  chuc_vu_id: string;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string | null;
}

/**
 * Validates and builds the personnel record for a self-created unit account (MANAGER/USER
 * without a linked personnel). Returns null when the account is not such a case.
 * @param params - Role + unit/position ids from the create payload
 * @returns Personnel create input + position coefficient, or null when not applicable
 * @throws ValidationError | NotFoundError - On invalid unit/position selection
 */
export async function resolvePersonnelDataForCreate(
  params: CreateUnitAssignmentParams
): Promise<{ personnelDataForCreate: Prisma.QuanNhanCreateInput; heSoChucVu: number } | null> {
  const { role, username, personnel_id, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id } =
    params;

  if (!((role === ROLES.MANAGER || role === ROLES.USER) && !personnel_id)) {
    return null;
  }

  if (role === ROLES.MANAGER) {
    if (!co_quan_don_vi_id) {
      throw new ValidationError(
        'Tài khoản MANAGER phải có thông tin Cơ quan đơn vị. Vui lòng chọn Cơ quan đơn vị.'
      );
    }
    if (don_vi_truc_thuoc_id) {
      throw new ValidationError(
        'Tài khoản MANAGER chỉ được chọn Cơ quan đơn vị, không được chọn Đơn vị trực thuộc.'
      );
    }
  } else if (role === ROLES.USER) {
    if (!co_quan_don_vi_id || !don_vi_truc_thuoc_id) {
      throw new ValidationError(
        'Tài khoản USER phải có đầy đủ thông tin Cơ quan đơn vị và Đơn vị trực thuộc. Vui lòng chọn cả hai.'
      );
    }
  }

  if (!chuc_vu_id) {
    throw new ValidationError('Vui lòng chọn chức vụ');
  }

  const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
    co_quan_don_vi_id ? coQuanDonViRepository.findIdById(co_quan_don_vi_id) : null,
    don_vi_truc_thuoc_id ? donViTrucThuocRepository.findIdAndParentById(don_vi_truc_thuoc_id) : null,
  ]);

  if (co_quan_don_vi_id && !coQuanDonVi) {
    throw new NotFoundError('Cơ quan đơn vị');
  }
  if (don_vi_truc_thuoc_id) {
    if (!donViTrucThuoc) {
      throw new NotFoundError('Đơn vị trực thuộc');
    }
    if (co_quan_don_vi_id && donViTrucThuoc.co_quan_don_vi_id !== co_quan_don_vi_id) {
      throw new ValidationError('Đơn vị trực thuộc không thuộc cơ quan đơn vị đã chọn');
    }
  }

  const chucVu = await positionRepository.findUniqueRaw({
    where: { id: chuc_vu_id },
    select: { he_so_chuc_vu: true, is_manager: true },
  });
  if (!chucVu) {
    throw new NotFoundError('Chức vụ');
  }

  if (role === ROLES.MANAGER && !chucVu.is_manager) {
    throw new ValidationError(
      'Tài khoản MANAGER phải có chức vụ là Chỉ huy. Vui lòng chọn chức vụ có quyền chỉ huy.'
    );
  }

  const personnelDataForCreate = {
    cccd: null,
    ho_ten: username,
    ChucVu: { connect: { id: chuc_vu_id } },
    ngay_sinh: null,
    ngay_nhap_ngu: null,
    ...(co_quan_don_vi_id ? { CoQuanDonVi: { connect: { id: co_quan_don_vi_id } } } : {}),
    ...(don_vi_truc_thuoc_id ? { DonViTrucThuoc: { connect: { id: don_vi_truc_thuoc_id } } } : {}),
  } as Prisma.QuanNhanCreateInput;
  const heSoChucVu = Number(chucVu?.he_so_chuc_vu) || 0;

  return { personnelDataForCreate, heSoChucVu };
}

/**
 * Validates the unit/position reassignment for an updated unit-scoped account.
 * @param params - Effective role + unit/position ids from the update payload
 * @returns Resolved unit/position assignment (MANAGER drops don_vi_truc_thuoc_id)
 * @throws ValidationError | NotFoundError - On invalid unit/position selection
 */
export async function resolveUnitReassignment(
  params: UpdateUnitAssignmentParams
): Promise<ResolvedUnitAssignment> {
  const { effectiveRole, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id } = params;

  if (effectiveRole === ROLES.MANAGER) {
    if (!co_quan_don_vi_id) {
      throw new ValidationError(
        'Tài khoản chỉ huy phải có Cơ quan đơn vị. Vui lòng chọn Cơ quan đơn vị.'
      );
    }
    if (don_vi_truc_thuoc_id) {
      throw new ValidationError(
        'Tài khoản chỉ huy chỉ được chọn Cơ quan đơn vị, không được chọn Đơn vị trực thuộc.'
      );
    }
  } else if (!co_quan_don_vi_id || !don_vi_truc_thuoc_id) {
    throw new ValidationError(
      'Tài khoản người dùng phải có đầy đủ Cơ quan đơn vị và Đơn vị trực thuộc. Vui lòng chọn cả hai.'
    );
  }

  if (!chuc_vu_id) {
    throw new ValidationError('Vui lòng chọn chức vụ');
  }

  const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
    coQuanDonViRepository.findIdById(co_quan_don_vi_id),
    don_vi_truc_thuoc_id ? donViTrucThuocRepository.findIdAndParentById(don_vi_truc_thuoc_id) : null,
  ]);

  if (!coQuanDonVi) {
    throw new NotFoundError('Cơ quan đơn vị');
  }
  if (don_vi_truc_thuoc_id) {
    if (!donViTrucThuoc) {
      throw new NotFoundError('Đơn vị trực thuộc');
    }
    if (donViTrucThuoc.co_quan_don_vi_id !== co_quan_don_vi_id) {
      throw new ValidationError('Đơn vị trực thuộc không thuộc cơ quan đơn vị đã chọn');
    }
  }

  const chucVu = await positionRepository.findUniqueRaw({
    where: { id: chuc_vu_id },
    select: { is_manager: true },
  });
  if (!chucVu) {
    throw new NotFoundError('Chức vụ');
  }
  if (effectiveRole === ROLES.MANAGER && !chucVu.is_manager) {
    throw new ValidationError(
      'Tài khoản chỉ huy phải có chức vụ là Chỉ huy. Vui lòng chọn chức vụ có quyền chỉ huy.'
    );
  }

  return {
    chuc_vu_id,
    co_quan_don_vi_id,
    don_vi_truc_thuoc_id: effectiveRole === ROLES.MANAGER ? null : don_vi_truc_thuoc_id,
  };
}
