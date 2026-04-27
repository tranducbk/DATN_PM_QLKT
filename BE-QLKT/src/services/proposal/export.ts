import { promises as fs } from 'fs';
import path from 'path';
import { NotFoundError } from '../../middlewares/errorHandler';

/**
 * Resolves proposal PDFs from current and legacy storage paths.
 * @param {string} filename - PDF filename
 * @returns {Promise<Object>} Absolute file path info
 */
async function getPdfFile(filename) {
  const storagePath = path.join(__dirname, '..', '..', '..', 'storage', 'proposals');
  const primaryFilePath = path.join(storagePath, filename);
  try {
    await fs.access(primaryFilePath);
    return {
      filePath: primaryFilePath,
      filename,
    };
  } catch (error) {
    console.error('Failed to access proposal file at primary location:', error);
  }

  const decisionsPath = path.join(__dirname, '..', '..', '..', 'uploads', 'decisions');
  const fallbackFilePath = path.join(decisionsPath, filename);
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
