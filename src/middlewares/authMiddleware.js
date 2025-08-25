import jwt from 'jsonwebtoken';
import pool from '../config/db.js'

const protect = (req, res, next) => {
    let token;

    // Kiểm tra header 'Authorization'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Lấy token từ header (format: "Bearer <token>")
            token = req.headers.authorization.split(' ')[1];

            // Xác thực token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Gắn thông tin người dùng đã được giải mã vào request
            req.user = decoded.user;

            // Hợp lệ, cho đi tiếp
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Xác thực thất bại, token không hợp lệ' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Xác thực thất bại, không tìm thấy token' });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        // Middleware này chạy sau 'protect', nên ta có req.user.id
        const [rows] = await pool.query(`
            SELECT is_admin
            FROM users
            WHERE steamid64 = ?`, [req.user.id]
        );
        if (rows.length > 0 && rows[0].is_admin === 1) {
            next();
        } else {
            res.status(403).json({ message: 'Yêu cầu quyền Admin' }); // 403 Forbidden - Cấm truy cập
        }
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi kiểm tra quyền Admin' });
    }
};

export { protect, isAdmin };