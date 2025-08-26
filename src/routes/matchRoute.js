import express from 'express';
import { banMap, chooseSide, getAllMatches, getMapHistory, getMatchById, joinTeam, leaveTeam, pickMap, startMatch, toggleReadyStatus } from '../controllers/matchController.js';
import { protect, isAdmin, isCaptain } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getAllMatches);
router.get('/:id/maps', getMapHistory);
router.get('/:id', getMatchById);
router.post('/:id/join', protect, joinTeam);
router.post('/:id/leave', protect, leaveTeam);
router.post('/:id/ready', protect, toggleReadyStatus);
router.post('/:id/start', protect, isAdmin, startMatch);
router.post('/:id/ban', protect, isCaptain, banMap);
router.post('/:id/pick', protect, isCaptain, pickMap);
router.post('/:id/side', protect, isCaptain, chooseSide);

export default router;