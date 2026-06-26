/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SYSTEM LOGS SERVICE — audit log visibility theo role (ATTT)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  3-TIER ACCESS CONTROL cho audit log:
 *
 *      MANAGER     → chỉ thấy log của USER + MANAGER cùng đơn vị mình
 *      ADMIN       → thấy thêm log của ADMIN và SYSTEM
 *      SUPER_ADMIN → thấy tất cả role + log resource trong SUPER_ADMIN_ONLY_RESOURCES
 *
 *  Phạm vi hiển thị (where + visibleRoles + canViewErrors) được dựng trong
 *  buildLogVisibilityScope (systemLog/logVisibility.ts); service này chỉ áp thêm
 *  các filter do người dùng chọn (actorRole, action, resource, search, ngày).
 *
 *  ATTT — RESOURCE-LEVEL RESTRICTION (SUPER_ADMIN_ONLY_RESOURCES, vd 'backup'):
 *  Log backup (CREATE/DELETE/RESTORE) chứa thông tin nhạy cảm về DB
 *  topology + tần suất backup → CHỈ SUPER_ADMIN xem được. Nếu kẻ tấn
 *  công có quyền ADMIN, vẫn không thể đoán được lịch backup để timing
 *  attack (vd: tấn công ngay trước backup để rollback).
 *
 *  IMPLEMENTATION FILTER:
 *  - userRole !== SUPER_ADMIN → scope.where mặc định loại các resource bị hạn chế.
 *  - Nếu user explicit filter một resource bị hạn chế + không phải SUPER_ADMIN
 *    → trả về EMPTY (không leak qua message error).
 *
 *  UNIT-SCOPED VIEW cho MANAGER:
 *  Manager xem log thì chỉ thấy action của user trong đơn vị mình.
 *  buildLogVisibilityScope query tất cả TaiKhoan có quan_nhan_id thuộc đơn vị
 *  manager → giới hạn where.nguoi_thuc_hien_id IN list.
 *
 *  WHY VISIBILITY MATRIX HARDCODE:
 *  Role hierarchy ít thay đổi, hardcode rõ ràng hơn config trong DB.
 *  Khi thêm role mới (vd: AUDITOR) → update logVisibility + audit log helper.
 *
 *  PAGINATION + STATS:
 *  getLogs trả về { logs, total, stats: {create, update, delete} } —
 *  stats là COUNT per action để hiển thị badge "5 tạo / 3 sửa" ở UI.
 *  Cần 4 query: findMany + count + 3 count theo action → Promise.all.
 *
 *  WHY KHÔNG log GET request:
 *  - GET không gây side effect → audit không cần.
 *  - Log GET tốn dung lượng (mỗi user mỗi giây 1 request → triệu log/ngày).
 *  - Trade-off: không truy được "ai xem data gì". Nếu cần compliance
 *    cao hơn (vd: GDPR + healthcare), phải bật log GET cho resource
 *    nhạy cảm (CCCD, ...).
 * ════════════════════════════════════════════════════════════════════════════
 */

import { systemLogRepository } from '../repositories/systemLog.repository';
import { ROLES } from '../constants/roles.constants';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS, SUPER_ADMIN_ONLY_RESOURCES } from '../constants/resourceSlugs.constants';
import { buildLogVisibilityScope } from './systemLog/logVisibility';

interface GetLogsParams {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  actorRole?: string;
  userRole: string;
  quanNhanId?: string;
}

class SystemLogsService {
  /**
   * Returns paginated system logs filtered by role and query params.
   * @param params - Filter and pagination params
   * @returns Logs, total count, and action stats
   */
  async getLogs(params: GetLogsParams) {
    const {
      page,
      limit,
      search,
      action,
      resource,
      startDate,
      endDate,
      actorRole,
      userRole,
      quanNhanId,
    } = params;

    // Dựng phạm vi xem theo role: điều kiện where mặc định + danh sách role được
    // thấy + có được xem log lỗi không. Trả null nếu role không có quyền xem log.
    const scope = await buildLogVisibilityScope(userRole, quanNhanId);
    if (!scope) return null; // role ngoài ma trận hiển thị (vd: USER) → cấm xem
    const { where, visibleRoles, canViewErrors } = scope;

    // Lọc thêm theo 1 role cụ thể chỉ khi role đó nằm trong phạm vi được thấy;
    // mặc định where (từ buildLogVisibilityScope) đã giới hạn về các role được phép.
    if (actorRole && visibleRoles.includes(actorRole)) {
      where.actor_role = actorRole;
    }

    // Quyền xem log lỗi (ERROR) bật/tắt theo role qua DevZone setting
    // (allow_view_errors_<role>, đã tính sẵn trong scope.canViewErrors). Không được
    // phép → luôn ẩn ERROR, kể cả khi user cố lọc action=ERROR (nhánh `{ not: ERROR }`).
    if (!canViewErrors) {
      where.action =
        action && action !== AUDIT_ACTIONS.ERROR ? action : { not: AUDIT_ACTIONS.ERROR };
    } else if (action) {
      where.action = action;
    }

    // Tìm trong nội dung log, không phân biệt hoa/thường.
    if (search) where.description = { contains: search, mode: 'insensitive' };

    // ATTT: resource trong SUPER_ADMIN_ONLY_RESOURCES (vd: 'backup') chỉ SUPER_ADMIN
    // xem được. Role thấp hơn nếu lọc đúng resource đó → trả EMPTY ngay, KHÔNG báo
    // lỗi (tránh leak sự tồn tại loại log đó). Mặc định loại bỏ đã nằm trong scope.where.
    if (userRole !== ROLES.SUPER_ADMIN) {
      if (resource) {
        if (SUPER_ADMIN_ONLY_RESOURCES.includes(resource))
          return { logs: [], total: 0, stats: { create: 0, delete: 0, update: 0 } };
        where.resource = resource;
      }
    } else if (resource) {
      where.resource = resource;
    }

    // Lọc theo khoảng thời gian tạo log: chỉ gắn cận nào có giá trị (gte/lte).
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    // 1 query lấy trang log (kèm người thực hiện) + 4 query đếm (tổng và theo nhóm
    // hành động CREATE/UPDATE/DELETE) cho badge thống kê — chạy song song.
    const [logs, total, createCount, deleteCount, updateCount] = await Promise.all([
      systemLogRepository.findManyRaw({
        skip: (page - 1) * limit,
        take: limit,
        where,
        include: {
          NguoiThucHien: {
            select: {
              id: true,
              username: true,
              role: true,
              QuanNhan: { select: { ho_ten: true } },
            },
          },
        },
        // createdAt is second-precision; CUID id (time-sortable) breaks ties so logs
        // created within the same second still display in true creation order.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      systemLogRepository.count(where),
      systemLogRepository.count({ ...where, action: { contains: 'CREATE' } }),
      systemLogRepository.count({ ...where, action: { contains: 'DELETE' } }),
      systemLogRepository.count({ ...where, action: { contains: 'UPDATE' } }),
    ]);

    return {
      logs,
      total,
      stats: { create: createCount, delete: deleteCount, update: updateCount },
    };
  }

  /**
   * Returns distinct action values from system logs.
   * @returns List of action strings
   */
  async getActions() {
    // Các giá trị action phân biệt (distinct) để đổ vào dropdown lọc trên UI.
    const actions = await systemLogRepository.findManyRaw({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return actions.map((item: { action: string }) => item.action);
  }

  /**
   * Returns distinct resource values from system logs, filtered by caller's role.
   * @param userRole - Role of the requesting user
   * @returns List of resource strings visible to that role
   */
  async getResources(userRole: string) {
    // Phải loại SUPER_ADMIN_ONLY_RESOURCES (vd: 'backup') cùng quy tắc như getLogs —
    // nếu không, dropdown filter ở UI sẽ vô tình hé lộ các resource này cho
    // ADMIN/MANAGER (leak ATTT).
    const where =
      userRole !== ROLES.SUPER_ADMIN ? { resource: { notIn: SUPER_ADMIN_ONLY_RESOURCES } } : {};
    const resources = await systemLogRepository.findManyRaw({
      select: { resource: true },
      distinct: ['resource'],
      where,
      orderBy: { resource: 'asc' },
    });
    return resources.map((item: { resource: string }) => item.resource);
  }

  /**
   * Deletes system logs by IDs.
   * @param ids - List of log IDs to delete
   * @returns Number of deleted records
   */
  async deleteLogs(ids: string[]) {
    // Xóa các log theo danh sách id được chọn; trả về số bản ghi thực sự đã xóa.
    const result = await systemLogRepository.deleteMany({ id: { in: ids } });
    return result.count;
  }

  /**
   * Deletes all system logs and writes an audit entry.
   * @param actorId - ID of the user performing the action
   * @param actorRole - Role of the user performing the action
   * @returns Number of deleted records
   */
  async deleteAllLogs(actorId: string, actorRole: string) {
    // Đếm trước để báo số lượng, xóa sạch, rồi tự ghi lại 1 log DELETE — vẫn truy
    // được "ai đã xóa toàn bộ nhật ký" dù mọi log cũ đã mất.
    const count = await systemLogRepository.count({});
    await systemLogRepository.deleteMany({});
    await systemLogRepository.create({
      nguoi_thuc_hien_id: actorId,
      actor_role: actorRole,
      action: AUDIT_ACTIONS.DELETE,
      resource: RESOURCE_SLUGS.SYSTEM_LOGS,
      description: `Xóa toàn bộ ${count} nhật ký hệ thống`,
    });
    return count;
  }
}

export default new SystemLogsService();
