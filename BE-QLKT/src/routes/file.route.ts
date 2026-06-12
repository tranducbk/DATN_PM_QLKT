import { Router } from 'express';
import fileController from '../controllers/file.controller';
import { verifyToken } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/files/sign
 * @desc    Issue a short-lived signed view URL for an internal file
 * @access  Private - All authenticated users
 */
router.get('/sign', verifyToken, fileController.signFile);

/**
 * @route   GET /api/files/view
 * @desc    Stream an internal file via a signed URL (signature is the credential)
 * @access  Public (signature-validated)
 */
router.get('/view', fileController.viewSignedFile);

export default router;
