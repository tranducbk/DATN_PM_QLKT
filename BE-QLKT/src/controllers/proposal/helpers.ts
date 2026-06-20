import type { Response } from 'express';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../constants/auditActions.constants';
import { ROLES } from '../../constants/roles.constants';
import type {
  ApproveProposalBody,
  AwardFilterInput,
  NotifyContext,
  ParsedApproveBody,
} from './types';

/**
 * DVTT takes priority over CQDV — CQDV is the parent unit, filtering by it
 * would include all sub-units.
 */
export function managerUnitFilterId(qn: {
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
}): string | undefined {
  return qn.don_vi_truc_thuoc_id ?? qn.co_quan_don_vi_id ?? undefined;
}

/** Parses a "year" query value that may arrive as string, number, or array. */
export function parseYearQuery(value: unknown): number | null {
  const yearValue = Array.isArray(value) ? value[0] : value;
  if (typeof yearValue !== 'string' && typeof yearValue !== 'number') {
    return null;
  }
  const year = Number(yearValue);
  return Number.isFinite(year) ? year : null;
}

/**
 * Parses multipart approve body — JSON-encoded data fields plus uploaded PDFs.
 * @param body - Raw multipart text fields
 * @param files - Multer file map
 */
export function parseApproveBody(
  body: ApproveProposalBody,
  files: Record<string, Express.Multer.File[]> | undefined
): ParsedApproveBody {
  const editedData = {
    data_danh_hieu: JSON.parse(body.data_danh_hieu || '[]'),
    data_thanh_tich: JSON.parse(body.data_thanh_tich || '[]'),
    data_nien_han: JSON.parse(body.data_nien_han || '[]'),
    data_cong_hien: JSON.parse(body.data_cong_hien || '[]'),
  };
  const decisions = {
    so_quyet_dinh_ca_nhan_hang_nam: body.so_quyet_dinh_ca_nhan_hang_nam,
    so_quyet_dinh_don_vi_hang_nam: body.so_quyet_dinh_don_vi_hang_nam,
    so_quyet_dinh_nien_han: body.so_quyet_dinh_nien_han,
    so_quyet_dinh_cong_hien: body.so_quyet_dinh_cong_hien,
    so_quyet_dinh_dot_xuat: body.so_quyet_dinh_dot_xuat,
    so_quyet_dinh_nckh: body.so_quyet_dinh_nckh,
  };
  const pdfFiles = {
    file_pdf_ca_nhan_hang_nam: files?.file_pdf_ca_nhan_hang_nam?.[0],
    file_pdf_don_vi_hang_nam: files?.file_pdf_don_vi_hang_nam?.[0],
    file_pdf_nien_han: files?.file_pdf_nien_han?.[0],
    file_pdf_cong_hien: files?.file_pdf_cong_hien?.[0],
    file_pdf_dot_xuat: files?.file_pdf_dot_xuat?.[0],
    file_pdf_nckh: files?.file_pdf_nckh?.[0],
  };
  const adminAttachedFiles = files?.admin_attached_files ?? [];
  return { editedData, decisions, pdfFiles, adminAttachedFiles };
}

/**
 * Sends an Excel buffer as a file download response.
 * @param res - Express response instance
 * @param buffer - Excel file content (Buffer or ExcelJS Workbook output)
 * @param filenamePrefix - Prefix used in the Content-Disposition filename
 */
export function sendExcelResponse(res: Response, buffer: unknown, filenamePrefix: string): void {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx"`
  );
  res.status(200).send(buffer);
}

/**
 * Builds the award list/export filter map from query params, omitting empty values.
 * @param query - Award filter query (don_vi_id / nam / danh_hieu)
 * @returns Filter map ready for the service layer
 */
export function buildAwardFilters(query: AwardFilterInput): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (query.don_vi_id) filters.don_vi_id = query.don_vi_id;
  if (query.nam) filters.nam = query.nam;
  if (query.danh_hieu) filters.danh_hieu = query.danh_hieu;
  return filters;
}

/**
 * Applies a MANAGER-role unit filter to the filters object in place.
 * Returns 'forbidden' when the manager's unit cannot be resolved.
 * @param user - Authenticated user
 * @param filters - Mutable filter map to apply the unit restriction to
 * @param getUserWithUnit - Resolver function that fetches the user's QuanNhan record
 */
export async function applyManagerUnitFilter(
  user: { role: string; id: string },
  filters: Record<string, unknown>,
  getUserWithUnit: (id: string) => Promise<{
    QuanNhan?: {
      co_quan_don_vi_id?: string | null;
      don_vi_truc_thuoc_id?: string | null;
    } | null;
  } | null>
): Promise<'ok' | 'forbidden'> {
  if (user.role !== ROLES.MANAGER) return 'ok';
  const userWithUnit = await getUserWithUnit(user.id);
  if (!userWithUnit?.QuanNhan) return 'forbidden';
  filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
  return 'ok';
}

/**
 * Best-effort wrapper for fire-and-forget notification calls — logs a system
 * error if the notifier throws but never propagates the error.
 */
export async function safeNotify(ctx: NotifyContext, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    void writeSystemLog({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: AUDIT_ACTIONS.ERROR,
      resource: ctx.resource,
      description: ctx.description,
      payload: { error: String(error) },
    });
  }
}
