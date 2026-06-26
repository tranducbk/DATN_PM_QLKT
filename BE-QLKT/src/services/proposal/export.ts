import { promises as fs } from 'fs';
import path from 'path';
import { NotFoundError } from '../../middlewares/errorHandler';
import { STORAGE_PROPOSALS_DIR, UPLOADS_DECISIONS_DIR } from '../../configs/storagePaths';

/**
 * Resolves proposal PDFs from current and legacy storage paths.
 * @param {string} filename - PDF filename
 * @returns {Promise<Object>} Absolute file path info
 */
async function getPdfFile(filename) {
  const primaryFilePath = path.join(STORAGE_PROPOSALS_DIR, filename);
  try {
    await fs.access(primaryFilePath);
    return {
      filePath: primaryFilePath,
      filename,
    };
  } catch (error) {
    console.error('Failed to access proposal file at primary location:', error);
  }

  const fallbackFilePath = path.join(UPLOADS_DECISIONS_DIR, filename);
  try {
    await fs.access(fallbackFilePath);
    return {
      filePath: fallbackFilePath,
      filename,
    };
  } catch (error) {
    console.error('Failed to access proposal file at fallback location:', error);
    throw new NotFoundError('File PDF');
  }
}

export { getPdfFile };
