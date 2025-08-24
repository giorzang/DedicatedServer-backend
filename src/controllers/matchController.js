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

// @desc    Người dùng tham gia một đội trong trận đấu
// @route   POST /api/matches/:id/join
// @access  Private (giả lập)
const joinTeam = async (req, res) => {
    const { id: matchId } = req.params;
    const { teamId } = req.body;
    const userId = req.user.id;

    if (!teamId) {
        return res.status(400).json({ message: 'Vui lòng cung cấp teamId' });
    }

    try {
        // 1. Kiểm tra trận đấu có tồn tại và đang ở trạng thái "waiting" không
        const [matchRows] = await pool.query(`
            SELECT match_status
            FROM matches
            WHERE id = ?`, [matchId]
        );
        if (matchRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận đấu' });
        }
        if (matchRows[0].match_status !== 'waiting') {
            return res.status(400).json({ message: 'Trận đấu không còn ở trạng thái chờ' });
        }

        // 2. Kiểm tra đội có tồn tại và chưa đầy (giả sử mỗi đội 5 người)
        const [teamRows] = await pool.query(`
            SELECT COUNT(*) AS playerCount
            FROM players
            WHERE team_id = ?`, [teamId]
        );
        if (teamRows[0].playerCount >= 5) {
            res.status(400).json({ message: 'Đội đã đủ thành viên' });
        }

        // 3. Kiểm tra người dùng đã ở trong một đội khác của trận này chưa
        const teamIdsInMatch = [matchId*2-1, matchId*2];
        const [existingPlayer] = await pool.query(`
            SELECT *
            FROM players 
            WHERE user_id = ? AND team_id IN(?, ?)`, [userId, ...teamIdsInMatch]
        );
        if (existingPlayer.length > 0) {
            return res.status(400).json({ message: 'Bạn đã ở trong một đội của trận này rồi' });
        }

        // Nếu tất cả điều kiện hợp lệ, thêm người chơi vào đội
        await pool.query(`
            INSERT INTO players (user_id, team_id)
            VALUES (?, ?)`, [userId, teamId]
        );

        // Kiểm tra và xét đội trưởng nếu đây là người đầu tiên
        const [captainRows] = await pool.query(`
            SELECT captain_id
            FROM teams
            WHERE id = ?`, [teamId]
        );
        if (captainRows[0].captain_id === null) {
            await pool.query(`
                UPDATE teams
                SET captain_id = ?
                WHERE id = ?`, [userId, teamId]
            );
        }
        res.status(201).json({ message: 'Tham gia đội thành công' });
    } catch (error) {
        console.error('Lỗi khi tham gia đội:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};


export { getAllMatches, getMatchById, joinTeam };
