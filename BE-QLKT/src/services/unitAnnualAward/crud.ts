import type { Prisma } from '../../generated/prisma';
import { danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';
import { unitAnnualProfileRepository } from '../../repositories/unitAnnualProfile.repository';
import {
  getDanhHieuName,
  formatDanhHieuList,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../constants/danhHieu.constants';
import { ROLES } from '../../constants/roles.constants';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import { resolveUnit, buildUnitIdFields } from '../../helpers/unitHelper';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import { recalculateAnnualUnit as defaultRecalculateAnnualUnit } from './eligibility';
import type { UnitAnnualAwardDeps } from './types';

const defaultDeps: UnitAnnualAwardDeps = {
  recalculateAnnualUnit: defaultRecalculateAnnualUnit,
  getSubUnits: async () => [],
};

/**
 * Lấy danh sách id các đơn vị trực thuộc của một cơ quan đơn vị (CQDV).
 * @param coQuanDonViId - Id cơ quan đơn vị cha
 * @returns Mảng id các đơn vị trực thuộc nằm dưới CQDV đó
 */
export async function getSubUnits(coQuanDonViId) {
  // Chỉ lấy id (không lấy cả bản ghi) để rẻ — caller dùng để giới hạn phạm vi.
  const subUnits = await donViTrucThuocRepository.findIdsByCoQuanDonViId(coQuanDonViId);
  return subUnits.map(u => u.id);
}

/**
 * Liệt kê danh hiệu đơn vị hằng năm có phân trang, đã giới hạn theo phạm vi của người gọi.
 * @param params - Tham số lọc/phân trang và thông tin vai trò người gọi để giới hạn phạm vi
 * @param deps - Phụ thuộc tiêm vào (mặc định dùng implement thật)
 * @returns Object gồm `data` (mảng bản ghi) và `pagination`
 */
export async function list(
  {
    page = 1,
    limit = 10,
    year,
    donViId,
    danhHieu,
    userRole,
    userQuanNhanId,
  }: Record<string, any> = {},
  deps: UnitAnnualAwardDeps = defaultDeps
) {
  const where: Record<string, any> = {};
  if (year) where.nam = Number(year);
  if (danhHieu) where.danh_hieu = danhHieu;

  // USER/MANAGER chỉ thấy đơn vị trong phạm vi mình; ADMIN trở lên không bị chặn ở đây.
  let allowedUnitIds: string[] | null = null;
  if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (user) {
      // MANAGER cấp CQDV: thấy chính CQDV và tất cả đơn vị trực thuộc dưới nó.
      if (userRole === ROLES.MANAGER && user.co_quan_don_vi_id) {
        const subUnitIds = await deps.getSubUnits(user.co_quan_don_vi_id);
        allowedUnitIds = [user.co_quan_don_vi_id, ...subUnitIds];
        where.OR = [
          { co_quan_don_vi_id: user.co_quan_don_vi_id },
          { don_vi_truc_thuoc_id: { in: subUnitIds } },
        ];
      } else if (userRole === ROLES.MANAGER && user.don_vi_truc_thuoc_id) {
        // MANAGER không gắn CQDV mà gắn DVTT: chỉ thấy đúng đơn vị trực thuộc đó.
        allowedUnitIds = [user.don_vi_truc_thuoc_id];
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      } else if (userRole === ROLES.USER && user.don_vi_truc_thuoc_id) {
        // USER thường chỉ thấy đúng đơn vị trực thuộc của mình.
        allowedUnitIds = [user.don_vi_truc_thuoc_id];
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      }
    } else {
      // Không tra được quân nhân của người gọi → coi như không có quyền, trả rỗng.
      return {
        data: [],
        pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
      };
    }
  }

  // Bộ lọc donViId chỉ được áp khi nằm trong phạm vi cho phép — tránh vượt quyền.
  if (donViId) {
    if (allowedUnitIds && !allowedUnitIds.includes(donViId)) {
      // donViId outside allowed scope — keep scoping, ignore the filter
    } else {
      where.OR = [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }];
    }
  }

  // Đếm và lấy trang song song để giảm round-trip DB.
  const [total, awards] = await Promise.all([
    danhHieuDonViHangNamRepository.count({ where }),
    danhHieuDonViHangNamRepository.findMany({
      where,
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    }),
  ]);

  return {
    data: awards,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}

/**
 * Lấy một bản ghi danh hiệu đơn vị theo id, có kiểm tra phạm vi truy cập của người gọi.
 * @param id - Id bản ghi danh hiệu đơn vị
 * @param userRole - Vai trò người gọi
 * @param userQuanNhanId - Id quân nhân liên kết với người gọi (để xác định phạm vi đơn vị)
 * @param _deps - Phụ thuộc tiêm vào (không dùng ở hàm này, giữ cho đồng nhất chữ ký)
 * @returns Bản ghi nếu hợp lệ và trong phạm vi; null nếu không tồn tại hoặc ngoài phạm vi
 */
export async function getById(
  id: string,
  userRole: string,
  userQuanNhanId: string,
  _deps: UnitAnnualAwardDeps = defaultDeps
) {
  const record = await danhHieuDonViHangNamRepository.findUnique({
    where: { id: String(id) },
    include: { CoQuanDonVi: true, DonViTrucThuoc: true },
  });

  if (!record) return null;

  // Chỉ USER/MANAGER mới bị soát phạm vi; ADMIN trở lên xem được mọi bản ghi.
  if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (!user) return null;

    // Ưu tiên CQDV trước, DVTT sau để xác định đơn vị của bản ghi.
    const recordDonViId = record.co_quan_don_vi_id || record.don_vi_truc_thuoc_id;

    if (userRole === ROLES.MANAGER) {
      // MANAGER khớp theo CQDV: bản ghi phải thuộc đúng CQDV của họ thì mới xem được.
      if (
        user.co_quan_don_vi_id !== record.co_quan_don_vi_id &&
        user.co_quan_don_vi_id !== recordDonViId
      ) {
        return null;
      }
    } else if (userRole === ROLES.USER) {
      // USER khớp theo đúng DVTT của mình.
      if (user.don_vi_truc_thuoc_id !== recordDonViId) {
        return null;
      }
    }
  }

  return record;
}

/**
 * Tạo mới hoặc cập nhật danh hiệu đơn vị hằng năm cho 1 đơn vị trong 1 năm, rồi tính lại hồ sơ.
 * Một bản ghi/năm/đơn vị có thể đồng thời mang danh hiệu cơ bản và các bằng khen BKBQP/BKTTCP.
 * @param params - Thông tin danh hiệu cần ghi (đơn vị, năm, loại danh hiệu, số quyết định, ghi chú)
 * @param deps - Phụ thuộc tiêm vào (mặc định gọi hàm tính lại hồ sơ thật)
 * @returns Bản ghi danh hiệu sau khi upsert (kèm thông tin đơn vị)
 * @throws ValidationError khi đơn vị đã có danh hiệu/bằng khen tương ứng trong năm, hoặc số QĐ sai
 */
export async function upsert(
  {
    don_vi_id,
    nam,
    danh_hieu,
    so_quyet_dinh,
    ghi_chu,
    nguoi_tao_id,
  }: {
    don_vi_id: string;
    nam: number | string;
    danh_hieu?: string | null;
    so_quyet_dinh?: string | null;
    ghi_chu?: string | null;
    nguoi_tao_id: string;
  },
  deps: UnitAnnualAwardDeps = defaultDeps
) {
  const year = Number(nam);
  const unitId = don_vi_id;

  // Đơn vị có thể là CQDV hoặc DVTT — cờ này quyết định cột FK và khóa unique dùng sau.
  const { isCoQuanDonVi } = await resolveUnit(unitId);

  // Chặn ghi đè: nếu đơn vị đã có đúng danh hiệu/bằng khen này trong năm thì báo lỗi.
  if (danh_hieu) {
    const existing = await danhHieuDonViHangNamRepository.findFirst({
      where: {
        OR: [
          { co_quan_don_vi_id: unitId, nam: year },
          { don_vi_truc_thuoc_id: unitId, nam: year },
        ],
      },
      select: { danh_hieu: true, nhan_bkbqp: true, nhan_bkttcp: true },
    });

    if (existing) {
      const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danh_hieu);
      const isBkbqp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
      const isBkttcp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;

      // Mỗi loại chặn riêng vì 3 loại nằm ở 3 cột khác nhau, được phép cùng tồn tại.
      if (isDv && existing.danh_hieu) {
        throw new ValidationError(
          `Đơn vị đã có danh hiệu ${getDanhHieuName(existing.danh_hieu)} năm ${year}`
        );
      }
      if (isBkbqp && existing.nhan_bkbqp) {
        throw new ValidationError(
          `Đơn vị đã có ${getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP)} năm ${year}`
        );
      }
      if (isBkttcp && existing.nhan_bkttcp) {
        throw new ValidationError(
          `Đơn vị đã có ${getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKTTCP)} năm ${year}`
        );
      }
    }
  }

  // Chọn đúng khóa unique theo loại đơn vị để Prisma upsert đúng bản ghi/năm.
  const whereCondition = isCoQuanDonVi
    ? { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } }
    : { unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: unitId, nam: year } };

  // BKBQP/BKTTCP (bằng khen chuỗi) ghi vào cột riêng; danh hiệu cơ bản ghi vào cột danh_hieu.
  const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danh_hieu || '');
  const isBkbqp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
  const isBkttcp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;

  if (danh_hieu) {
    // Bằng khen ghi số QĐ vào cột riêng nên truyền null cho cặp số QĐ danh hiệu cơ bản.
    const decisionErrors = validateDecisionNumbers(
      {
        danh_hieu: isBk ? null : danh_hieu,
        so_quyet_dinh: isBk ? null : so_quyet_dinh,
        nhan_bkbqp: isBkbqp,
        so_quyet_dinh_bkbqp: isBkbqp ? so_quyet_dinh : null,
        nhan_bkttcp: isBkttcp,
        so_quyet_dinh_bkttcp: isBkttcp ? so_quyet_dinh : null,
      },
      { entityType: 'unit', entityName: unitId }
    );
    if (decisionErrors.length > 0) {
      throw new ValidationError(decisionErrors.join('\n'));
    }
  }

  // Nhánh update chỉ đụng các cột tương ứng loại danh hiệu, không ghi đè các cột khác.
  const updateData: Record<string, unknown> = {};
  if (isBk) {
    // Bằng khen: bật cờ nhan_* và ghi số QĐ/ghi chú vào cột riêng của từng bằng khen.
    if (isBkbqp) {
      updateData.nhan_bkbqp = true;
      if (so_quyet_dinh) updateData.so_quyet_dinh_bkbqp = so_quyet_dinh;
      if (ghi_chu) updateData.ghi_chu_bkbqp = ghi_chu;
    }
    if (isBkttcp) {
      updateData.nhan_bkttcp = true;
      if (so_quyet_dinh) updateData.so_quyet_dinh_bkttcp = so_quyet_dinh;
      if (ghi_chu) updateData.ghi_chu_bkttcp = ghi_chu;
    }
  } else {
    // Danh hiệu cơ bản: ghi vào bộ cột chung (danh_hieu/so_quyet_dinh/ghi_chu).
    updateData.danh_hieu = danh_hieu || null;
    if (so_quyet_dinh) updateData.so_quyet_dinh = so_quyet_dinh;
    if (ghi_chu) updateData.ghi_chu = ghi_chu;
  }

  // Nhánh create khởi tạo đầy đủ cả 3 nhóm cột (cơ bản + BKBQP + BKTTCP) trong một lần.
  const record = await danhHieuDonViHangNamRepository.upsert({
    where: whereCondition,
    update: updateData,
    create: {
      ...buildUnitIdFields(unitId, isCoQuanDonVi),
      nam: year,
      danh_hieu: isBk ? null : danh_hieu || null,
      so_quyet_dinh: isBk ? null : so_quyet_dinh || null,
      ghi_chu: isBk ? null : ghi_chu || null,
      nhan_bkbqp: isBkbqp,
      ...(isBkbqp && so_quyet_dinh && { so_quyet_dinh_bkbqp: so_quyet_dinh }),
      ...(isBkbqp && ghi_chu && { ghi_chu_bkbqp: ghi_chu }),
      nhan_bkttcp: isBkttcp,
      ...(isBkttcp && so_quyet_dinh && { so_quyet_dinh_bkttcp: so_quyet_dinh }),
      ...(isBkttcp && ghi_chu && { ghi_chu_bkttcp: ghi_chu }),
      nguoi_tao_id: nguoi_tao_id,
    },
    include: { CoQuanDonVi: true, DonViTrucThuoc: true },
  });

  // Sau khi ghi, tính lại hồ sơ chuỗi của đơn vị (đủ điều kiện BKBQP/BKTTCP, gợi ý...).
  await deps.recalculateAnnualUnit(unitId, year);

  return record;
}

/**
 * Xóa toàn bộ bản ghi danh hiệu, hoặc gỡ riêng một loại danh hiệu trong bản ghi, rồi tính lại.
 * Khi gỡ riêng mà bản ghi không còn loại nào → xóa luôn bản ghi; ngược lại chỉ cập nhật.
 * @param id - Id bản ghi danh hiệu đơn vị cần xử lý
 * @param awardType - Loại danh hiệu cần gỡ riêng; bỏ trống để xóa cả bản ghi
 * @param deps - Phụ thuộc tiêm vào (mặc định gọi hàm tính lại hồ sơ thật)
 * @returns Bản ghi danh hiệu trước khi xóa/cập nhật (để dùng cho audit log/notification)
 * @throws NotFoundError khi không tìm thấy bản ghi
 * @throws ValidationError khi awardType không hợp lệ hoặc bản ghi không mang loại đó
 */
export async function remove(
  id: string,
  awardType?: string | null,
  deps: UnitAnnualAwardDeps = defaultDeps
) {
  const danhHieu = await danhHieuDonViHangNamRepository.findUnique({
    where: { id: String(id) },
    include: {
      CoQuanDonVi: { select: { ten_don_vi: true } },
      DonViTrucThuoc: { select: { ten_don_vi: true } },
    },
  });

  if (!danhHieu) {
    throw new NotFoundError('Danh hiệu đơn vị hằng năm');
  }

  // Ưu tiên CQDV trước, DVTT sau để xác định đơn vị cần tính lại hồ sơ.
  const donViId = danhHieu.co_quan_don_vi_id || danhHieu.don_vi_truc_thuoc_id;

  // Nhánh gỡ riêng một loại danh hiệu (giữ các loại còn lại trong cùng bản ghi).
  if (awardType) {
    const validTypes = new Set<string>([...DANH_HIEU_DON_VI_CO_BAN, ...DANH_HIEU_DON_VI_BANG_KHEN]);
    if (!validTypes.has(awardType)) {
      throw new ValidationError(
        `Loại danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validTypes])}.`
      );
    }

    const updateData: Prisma.DanhHieuDonViHangNamUncheckedUpdateInput = {};
    const isBaseAward = DANH_HIEU_DON_VI_CO_BAN.has(awardType);

    // Mỗi loại chỉ gỡ đúng bộ cột của nó; phải đang thực sự mang loại đó mới gỡ được.
    if (isBaseAward) {
      if (danhHieu.danh_hieu !== awardType) {
        throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
      }
      updateData.danh_hieu = null;
      updateData.so_quyet_dinh = null;
      updateData.ghi_chu = null;
    } else if (awardType === DANH_HIEU_DON_VI_HANG_NAM.BKBQP) {
      if (!danhHieu.nhan_bkbqp) {
        throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
      }
      updateData.nhan_bkbqp = false;
      updateData.so_quyet_dinh_bkbqp = null;
      updateData.ghi_chu_bkbqp = null;
    } else if (awardType === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP) {
      if (!danhHieu.nhan_bkttcp) {
        throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
      }
      updateData.nhan_bkttcp = false;
      updateData.so_quyet_dinh_bkttcp = null;
      updateData.ghi_chu_bkttcp = null;
    }

    // Tính phần còn lại SAU khi gỡ loại này để biết bản ghi có còn dữ liệu gì không.
    const remainingDanhHieu = isBaseAward ? null : danhHieu.danh_hieu;
    const remainingBkbqp =
      awardType === DANH_HIEU_DON_VI_HANG_NAM.BKBQP ? false : danhHieu.nhan_bkbqp;
    const remainingBkttcp =
      awardType === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP ? false : danhHieu.nhan_bkttcp;
    const isEmpty = !remainingDanhHieu && !remainingBkbqp && !remainingBkttcp;

    // Không còn loại nào → xóa hẳn bản ghi rỗng; còn loại khác → chỉ cập nhật cột đã gỡ.
    if (isEmpty) {
      await danhHieuDonViHangNamRepository.delete(String(id));
    } else {
      await danhHieuDonViHangNamRepository.updateRaw({
        where: { id: String(id) },
        data: updateData,
      });
    }

    await deps.recalculateAnnualUnit(donViId, danhHieu.nam);
    return danhHieu;
  }

  // Không truyền awardType → xóa cả bản ghi (mọi loại danh hiệu trong năm đó).
  await danhHieuDonViHangNamRepository.delete(String(id));

  await deps.recalculateAnnualUnit(donViId, danhHieu.nam);

  return danhHieu;
}

/**
 * Lấy hồ sơ danh hiệu hằng năm của một đơn vị theo năm; tự tạo hồ sơ rỗng nếu chưa có.
 * @param donViId - Id đơn vị (CQDV hoặc DVTT)
 * @param year - Năm cần lấy hồ sơ
 * @returns Bản ghi hồ sơ (kèm thông tin đơn vị); nếu chưa có sẽ trả về hồ sơ mới tạo mặc định
 */
export async function getAnnualUnit(donViId: string, year: number) {
  year = Number(year);
  const { isCoQuanDonVi } = await resolveUnit(donViId);

  let profile = await unitAnnualProfileRepository.findFirstRaw({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      nam: year,
    },
    orderBy: { nam: 'desc' },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: true,
    },
  });

  // Chưa có hồ sơ → tạo bản rỗng cho năm hiện tại để FE luôn có dữ liệu hiển thị.
  if (!profile) {
    const currentYear = new Date().getFullYear();
    profile = await unitAnnualProfileRepository.createRaw({
      data: {
        ...buildUnitIdFields(donViId, isCoQuanDonVi),
        nam: currentYear,
        tong_dvqt: 0,
        tong_dvqt_json: [],
        dvqt_lien_tuc: 0,
        du_dieu_kien_bkbqp: false,
        du_dieu_kien_bkttcp: false,
        goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập danh hiệu đơn vị.',
      },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: true,
      },
    });
  }

  return profile;
}

/**
 * Throws unless the caller may access the given unit's award data.
 * ADMIN/SUPER_ADMIN: any unit. MANAGER: only their own co_quan_don_vi (CQDV itself or
 * a don_vi_truc_thuoc under it). USER: only their own don_vi_truc_thuoc.
 * @param donViId - Target unit id (CQDV or DVTT)
 * @param userRole - Caller role
 * @param userQuanNhanId - Caller's linked personnel id (resolves their unit scope)
 * @throws ValidationError when donViId is missing
 * @throws NotFoundError when the unit or the caller's scope cannot be resolved
 * @throws ForbiddenError when the unit is outside the caller's scope
 */
export async function assertUnitInScope(
  donViId: string,
  userRole: string = ROLES.ADMIN,
  userQuanNhanId: string | null = null
): Promise<void> {
  if (!donViId) throw new ValidationError('don_vi_id là bắt buộc');

  // Đơn vị đích có thể là CQDV hoặc DVTT — thử lần lượt cả hai bảng để xác nhận tồn tại.
  const donVi =
    (await coQuanDonViRepository.findById(donViId)) ||
    (await donViTrucThuocRepository.findById(donViId));

  if (!donVi) throw new NotFoundError('Đơn vị');

  // ADMIN/SUPER_ADMIN truy cập mọi đơn vị, không cần soát phạm vi.
  if (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN) return;

  if ((userRole === ROLES.MANAGER || userRole === ROLES.USER) && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (!user) throw new NotFoundError('Thông tin người dùng');

    if (userRole === ROLES.MANAGER) {
      // Quy về CQDV của đơn vị đích: nếu là DVTT lấy CQDV cha, nếu là CQDV lấy chính nó.
      const targetCoQuanId =
        'co_quan_don_vi_id' in donVi && donVi.co_quan_don_vi_id
          ? donVi.co_quan_don_vi_id
          : donVi.id;
      // MANAGER chỉ được xem đơn vị thuộc đúng CQDV mà mình quản lý.
      if (!user.co_quan_don_vi_id || user.co_quan_don_vi_id !== targetCoQuanId) {
        throw new ForbiddenError('Không có quyền xem lịch sử khen thưởng của đơn vị này');
      }
    } else if (!user.don_vi_truc_thuoc_id || user.don_vi_truc_thuoc_id !== donViId) {
      // USER chỉ được xem đúng DVTT của chính mình.
      throw new ForbiddenError('Không có quyền xem lịch sử khen thưởng của đơn vị này');
    }
    return;
  }

  // Vai trò không xác định hoặc thiếu thông tin quân nhân → từ chối truy cập.
  throw new ForbiddenError('Không có quyền truy cập');
}

/**
 * Lấy toàn bộ lịch sử danh hiệu hằng năm của một đơn vị, sắp theo năm giảm dần.
 * @param donViId - Id đơn vị (CQDV hoặc DVTT)
 * @param userRole - Vai trò người gọi (để soát quyền truy cập đơn vị)
 * @param userQuanNhanId - Id quân nhân liên kết với người gọi (xác định phạm vi)
 * @returns Mảng bản ghi danh hiệu của đơn vị, mới nhất trước
 * @throws ForbiddenError khi đơn vị nằm ngoài phạm vi của người gọi
 */
export async function getUnitAnnualAwards(
  donViId: string,
  userRole: string = ROLES.ADMIN,
  userQuanNhanId: string | null = null
) {
  // Soát quyền trước khi truy vấn — ném lỗi nếu đơn vị ngoài phạm vi người gọi.
  await assertUnitInScope(donViId, userRole, userQuanNhanId);

  // Khớp cả hai cột FK vì đơn vị có thể lưu ở CQDV hoặc DVTT tùy loại.
  const danhHieuRecords = await danhHieuDonViHangNamRepository.findMany({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
    },
    orderBy: { nam: 'desc' },
  });

  return danhHieuRecords;
}
