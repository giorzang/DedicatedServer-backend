import express from 'express';
import { sendCommand } from '../controllers/rconController.js';
import { protect, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// API này yêu cầu phải đăng nhập và là Admin
router.post('/', protect, isAdmin, sendCommand);

export default router;