import { prisma } from '../models';
import { FileQuyetDinh } from '../generated/prisma';

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
    return null;
  }
}

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
    return null;
  }
}

export { getDecisionFilePath, getDecisionInfo };
