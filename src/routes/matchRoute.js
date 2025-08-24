import express from 'express';
import { getAllMatches, getMatchById } from '../controllers/matchController.js';

const router = express.Router();

router.get('/', getAllMatches);
router.get('/:id', getMatchById);

export default router;