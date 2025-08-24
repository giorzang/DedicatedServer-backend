import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = express.Router();

// @desc    Giả lập đăng nhập và trả về token
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    const { steamid64 } = req.body;

    if (!steamid64) {
        return res.status(400).json({ message: 'Vui lòng cung cấp steamid64' });
    }
    const [users] = await pool.query(`
        SELECT *
        FROM users
        WHERE steamid64 = ?`, [steamid64]
    );
    if (users.length === 0) {
        return res.status(401).json({ message: 'Người dùng không tồn tại' });
    }

    const payload = {
        user: {
            id: users[0].steamid64,
            name: users[0].profile_name,
            avatar: users[0].avatar
        }
    };
    jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN },
        (err, token) => {
            if (err) throw err;
            res.json({ token });
        }
    );
});

export default router;