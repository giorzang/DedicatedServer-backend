import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors()); // Cho phép các domain khác gọi API
app.use(express.json()); // Giúp server đọc được dữ liệu JSON từ request


// Route thu nghiem
app.get('/', (req, res) => {
    res.send('<h1>🎉 CS2 Scrim Backend is running!</h1>');
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`)
})