import express from 'express';
import { getAllMatches, getMatchById, joinTeam } from '../controllers/matchController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', getAllMatches);
router.get('/:id', getMatchById);
router.post('/:id/join', protect, joinTeam);

export default router;