import pool from '../config/db.js';

// @desc    Lấy tất cả các trận đấu
// @route   GET /api/matches
// @access  Public
const getAllMatches = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT *
            FROM matches
            ORDER BY created_at DESC
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách trận đấu:', error);
        res.status(500).json({ message: 'Lỗi' });
    }
};

// @desc    Lấy thông tin chi tiết một trận đấu
// @route   GET /api/matches/:id
// @access  Public
const getMatchById = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Lấy thông tin cơ bản của trận đấu
        const [matchRows] = await pool.query(`
            SELECT *
            FROM matches
            WHERE id = ?`, [id]
        );
        
        if (matchRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận đấu' });
        }
        const match = matchRows[0];

        // 2. Lấy thông tin 2 đội của trận đấu này
        const teamIds = [id*2-1, id*2];
        const [teams] = await pool.query(`
            SELECT *
            FROM teams
            WHERE id IN (?, ?)`, teamIds
        );
        
        // 3. Với mỗi đội, lấy danh sách người chơi
        for (const team of teams) {
            const [players] = await pool.query(`
                SELECT u.steamid64, u.profile_name, u.avatar, p.is_ready
                FROM players p
                JOIN users u ON p.user_id = u.steamid64
                WHERE p.team_id = ?`, [team.id]
            );
            team.players = players;
        }

        // 4. Gắn danh sách đội vào object match và trả về
        match.teams = teams;
        res.status(200).json(match);
    } catch (error) {
        console.error(`Lỗi khi lấy trận đấu ID ${id}:`, error);
        res.status(500).json({ message: 'Lỗi' });
    }
};

export { getAllMatches, getMatchById };
