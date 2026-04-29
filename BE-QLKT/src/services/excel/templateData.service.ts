import { MAX_DECISION_DROPDOWN } from '../../constants/excel.constants';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';

export interface PersonnelTemplateRecord {
  id: string;
  ho_ten: string | null;
  ngay_sinh: Date | null;
  cap_bac: string | null;
  ChucVu: { ten_chuc_vu: string } | null;
  CoQuanDonVi: { ten_don_vi: string } | null;
  DonViTrucThuoc: { ten_don_vi: string } | null;
}

/**
 * Fetches personnel records used to prefill Excel templates.
 * @param personnelIds - Personnel ID list
 * @returns Personnel records with rank/position/unit relations
 */
export async function fetchPersonnelForTemplate(
  personnelIds: string[]
): Promise<PersonnelTemplateRecord[]> {
  if (personnelIds.length === 0) return [];
  return quanNhanRepository.findManyRaw({
    where: { id: { in: personnelIds } },
    include: {
      ChucVu: true,
      CoQuanDonVi: { select: { ten_don_vi: true } },
      DonViTrucThuoc: { select: { ten_don_vi: true } },
    },
  });
}

/**
 * Fetches decision numbers used in the template's dropdown validation.
 * @param loaiKhenThuong - Optional award-type filter
 * @param take - Maximum number of records
 * @returns Decision number list ordered by year descending
 */
export async function fetchDecisionsForTemplate(
  loaiKhenThuong?: string,
  take: number = MAX_DECISION_DROPDOWN
): Promise<string[]> {
  const where: Record<string, unknown> = {};
  if (loaiKhenThuong) where.loai_khen_thuong = loaiKhenThuong;

  const existingDecisions = await decisionFileRepository.findManyRaw({
    where,
    select: { so_quyet_dinh: true },
    orderBy: { nam: 'desc' },
    take,
  });
  return existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean) as string[];
}

interface TemplateDataInput {
  personnelIds?: string[];
  loaiKhenThuong?: string;
  includeDecision?: boolean;
}

export interface TemplateDataBundle {
  personnelList: PersonnelTemplateRecord[];
  decisionNumbers: string[];
}

/**
 * Convenience wrapper that fetches both personnel and decision data in parallel.
 * @param input - Template data input
 * @returns Pre-fetched personnel and decision lists
 */
export async function fetchTemplateData(
  input: TemplateDataInput
): Promise<TemplateDataBundle> {
  const { personnelIds = [], loaiKhenThuong, includeDecision = true } = input;

  const [personnelList, decisionNumbers] = await Promise.all([
    fetchPersonnelForTemplate(personnelIds),
    includeDecision ? fetchDecisionsForTemplate(loaiKhenThuong) : Promise.resolve([]),
  ]);

  return { personnelList, decisionNumbers };
}
