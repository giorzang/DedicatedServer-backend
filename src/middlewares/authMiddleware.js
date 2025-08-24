import jwt from 'jsonwebtoken';

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

export { protect };