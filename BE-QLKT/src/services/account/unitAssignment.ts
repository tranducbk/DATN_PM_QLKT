import { ROLES } from '../../constants/roles.constants';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../repositories/unit.repository';
import { positionRepository } from '../../repositories/position.repository';
import type { Prisma } from '../../generated/prisma';

// Tham số khi TẠO tài khoản gắn đơn vị: role thô từ payload, kèm 2 FK đơn vị
// (CQDV = cơ quan đơn vị cha, DVTT = đơn vị trực thuộc con) và chức vụ.
interface CreateUnitAssignmentParams {
  role: string;
  username: string;
  personnel_id?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
}

// Tham số khi CẬP NHẬT gán đơn vị: dùng effectiveRole (vai trò thực sau khi
// đã giải quyết quyền) thay vì role thô, vì lúc update vai trò đã xác định.
interface UpdateUnitAssignmentParams {
  effectiveRole: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
}

// Kết quả gán đơn vị đã chuẩn hóa: DVTT có thể null vì chỉ huy cấp CQDV
// (MANAGER) chỉ lưu đơn vị cha, không gắn đơn vị con.
interface ResolvedUnitAssignment {
  chuc_vu_id: string;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string | null;
}

/**
 * Kiểm tra và dựng bản ghi quân nhân cho tài khoản đơn vị tự tạo (MANAGER/USER
 * chưa liên kết quân nhân sẵn có). Trả null khi không thuộc trường hợp này.
 * @param params - Vai trò + các FK đơn vị/chức vụ lấy từ payload tạo tài khoản
 * @returns Dữ liệu tạo quân nhân kèm hệ số chức vụ, hoặc null nếu không áp dụng
 * @throws ValidationError | NotFoundError - Khi chọn đơn vị/chức vụ không hợp lệ
 */
export async function resolvePersonnelDataForCreate(
  params: CreateUnitAssignmentParams
): Promise<{ personnelDataForCreate: Prisma.QuanNhanCreateInput; heSoChucVu: number } | null> {
  const { role, username, personnel_id, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id } =
    params;

  // Chỉ áp dụng cho MANAGER/USER tự tạo quân nhân (chưa có personnel_id liên kết).
  // SUPER_ADMIN/ADMIN hoặc tài khoản đã gắn quân nhân thì bỏ qua, trả null.
  if (!((role === ROLES.MANAGER || role === ROLES.USER) && !personnel_id)) {
    return null;
  }

  // MANAGER = chỉ huy cấp CQDV: chỉ được gắn đơn vị cha (CQDV), KHÔNG gắn DVTT —
  // vì chỉ huy quản lý cả cơ quan, không thuộc riêng một đơn vị con nào.
  // USER = quân nhân thường: bắt buộc cả CQDV lẫn DVTT (lưu cả 2 FK cha+con).
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

  // Lấy đồng thời CQDV và DVTT để verify tồn tại (DVTT kèm theo FK cha để
  // kiểm tra quan hệ cha-con); Promise.all vì 2 truy vấn độc lập nhau.
  const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
    co_quan_don_vi_id ? coQuanDonViRepository.findIdById(co_quan_don_vi_id) : null,
    don_vi_truc_thuoc_id ? donViTrucThuocRepository.findIdAndParentById(don_vi_truc_thuoc_id) : null,
  ]);

  if (co_quan_don_vi_id && !coQuanDonVi) {
    throw new NotFoundError('Cơ quan đơn vị');
  }
  // DVTT phải thực sự là con của CQDV đã chọn — chặn ghép sai cây đơn vị,
  // tránh quân nhân nằm trong đơn vị con không thuộc cơ quan cha tương ứng.
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

  // MANAGER bắt buộc chức vụ có cờ is_manager (quyền chỉ huy) — quyền vai trò
  // phải khớp tính chất chức vụ, không cho chỉ huy gắn chức vụ thường.
  if (role === ROLES.MANAGER && !chucVu.is_manager) {
    throw new ValidationError(
      'Tài khoản MANAGER phải có chức vụ là Chỉ huy. Vui lòng chọn chức vụ có quyền chỉ huy.'
    );
  }

  // Dựng input tạo quân nhân: chỉ connect FK đơn vị nào thực có giá trị
  // (MANAGER bỏ DVTT). Các trường nhân thân để null vì đây là quân nhân
  // tối thiểu sinh kèm tài khoản, sẽ bổ sung sau.
  const personnelDataForCreate = {
    cccd: null,
    ho_ten: username,
    ChucVu: { connect: { id: chuc_vu_id } },
    ngay_sinh: null,
    ngay_nhap_ngu: null,
    ...(co_quan_don_vi_id ? { CoQuanDonVi: { connect: { id: co_quan_don_vi_id } } } : {}),
    ...(don_vi_truc_thuoc_id ? { DonViTrucThuoc: { connect: { id: don_vi_truc_thuoc_id } } } : {}),
  } as Prisma.QuanNhanCreateInput;
  // Hệ số chức vụ nuôi tính điều kiện khen thưởng; ép số, mặc định 0 nếu thiếu.
  const heSoChucVu = Number(chucVu?.he_so_chuc_vu) || 0;

  return { personnelDataForCreate, heSoChucVu };
}

/**
 * Kiểm tra việc gán lại đơn vị/chức vụ khi cập nhật một tài khoản gắn đơn vị.
 * @param params - Vai trò thực + các FK đơn vị/chức vụ lấy từ payload cập nhật
 * @returns Gán đơn vị/chức vụ đã chuẩn hóa (MANAGER bị bỏ don_vi_truc_thuoc_id)
 * @throws ValidationError | NotFoundError - Khi chọn đơn vị/chức vụ không hợp lệ
 */
export async function resolveUnitReassignment(
  params: UpdateUnitAssignmentParams
): Promise<ResolvedUnitAssignment> {
  const { effectiveRole, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id } = params;

  // Cùng quy tắc với lúc tạo: chỉ huy (MANAGER) chỉ giữ CQDV (đơn vị cha),
  // không được gắn DVTT; người dùng thường phải đủ cả cha lẫn con.
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

  // CQDV luôn bắt buộc khi update nên truy vấn không cần điều kiện (khác lúc
  // tạo); DVTT vẫn chỉ truy vấn khi có giá trị. Song song vì độc lập.
  const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
    coQuanDonViRepository.findIdById(co_quan_don_vi_id),
    don_vi_truc_thuoc_id ? donViTrucThuocRepository.findIdAndParentById(don_vi_truc_thuoc_id) : null,
  ]);

  if (!coQuanDonVi) {
    throw new NotFoundError('Cơ quan đơn vị');
  }
  // Giữ tính nhất quán cây đơn vị: DVTT phải là con đúng của CQDV vừa chọn,
  // tránh gán lại sai quan hệ cha-con.
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
  // Vai trò chỉ huy phải đi kèm chức vụ có quyền chỉ huy (is_manager).
  if (effectiveRole === ROLES.MANAGER && !chucVu.is_manager) {
    throw new ValidationError(
      'Tài khoản chỉ huy phải có chức vụ là Chỉ huy. Vui lòng chọn chức vụ có quyền chỉ huy.'
    );
  }

  // Chuẩn hóa kết quả: ép DVTT về null cho MANAGER để đảm bảo chỉ huy cấp
  // CQDV chỉ lưu đơn vị cha, dù payload có lỡ mang theo DVTT.
  return {
    chuc_vu_id,
    co_quan_don_vi_id,
    don_vi_truc_thuoc_id: effectiveRole === ROLES.MANAGER ? null : don_vi_truc_thuoc_id,
  };
}
