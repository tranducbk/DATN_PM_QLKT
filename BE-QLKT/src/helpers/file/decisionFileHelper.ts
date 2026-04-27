import { prisma } from '../../models';
import { FileQuyetDinh } from '../../generated/prisma';

/**
 * Gets the stored file path for a decision number.
 * @param soQuyetDinh - Decision number
 * @returns File path when found, otherwise null
 */
async function getDecisionFilePath(soQuyetDinh: string | null | undefined): Promise<string | null> {
  if (!soQuyetDinh || soQuyetDinh.trim() === '') {
    return null;
  }

  try {
    const decision = await prisma.fileQuyetDinh.findUnique({
      where: { so_quyet_dinh: soQuyetDinh.trim() },
      select: { file_path: true },
    });

    return decision?.file_path || null;
  } catch (error) {
    console.error('DecisionFileHelper.getDecisionFilePath failed', { soQuyetDinh, error });
    return null;
  }
}

/**
 * Gets decision metadata by decision number.
 * @param soQuyetDinh - Decision number
 * @returns Decision record when found, otherwise null
 */
async function getDecisionInfo(
  soQuyetDinh: string | null | undefined
): Promise<FileQuyetDinh | null> {
  if (!soQuyetDinh || soQuyetDinh.trim() === '') {
    return null;
  }

  try {
    const decision = await prisma.fileQuyetDinh.findUnique({
      where: { so_quyet_dinh: soQuyetDinh.trim() },
    });

    return decision;
  } catch (error) {
    console.error('DecisionFileHelper.getDecisionInfo failed', { soQuyetDinh, error });
    return null;
  }
}

export { getDecisionFilePath, getDecisionInfo };
