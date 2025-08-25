import express from 'express';
import { getAllMatches, getMatchById, joinTeam, leaveTeam, startMatch, toggleReadyStatus } from '../controllers/matchController.js';
import { protect, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getAllMatches);
router.get('/:id', getMatchById);
router.post('/:id/join', protect, joinTeam);
router.post('/:id/leave', protect, leaveTeam);
router.post('/:id/ready', protect, toggleReadyStatus);
router.post('/:id/start', protect, isAdmin, startMatch);

export default router;