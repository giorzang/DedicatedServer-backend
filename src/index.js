import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './config/db.js';

import matchRoute from './routes/matchRoute.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());


// Route thu nghiem
app.get('/', (req, res) => {
    res.send('<h1>🎉 CS2 Scrim Backend is running!</h1>');
});

// Su dung routes
app.use('/api/matches', matchRoute);

// Khoi dong server
app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`)
})