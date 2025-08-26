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

// @desc    Người dùng rời khỏi đội trong trận đấu
// @route   POST /api/matches/:id/leave
// @access  Private
const leaveTeam = async (req, res) => {
    const { id: matchId } = req.params;
    const userId = req.user.id;

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
            return res.status(400).json({ message: 'Không thể rời đội khi trận đấu đã bắt đầu' });
        }

        // 2. Tìm xem người dùng đang ở đội nào trong trận này
        const teamIdsInMatch = [matchId*2-1, matchId*2];
        const [playerRows] = await pool.query(`
            SELECT *
            FROM players
            WHERE user_id = ? AND team_id IN (?, ?)`, [userId, ...teamIdsInMatch]
        );
        if (playerRows.length === 0) {
            return res.status(404).json({ message: 'Bạn không ở trong đội nào của trận này' });
        }
        const { team_id: teamId } = playerRows[0];

        // 3. Xử lý logic chuyển đội trưởng (nếu cần)
        const [teamRows] = await pool.query(`
            SELECT captain_id
            FROM teams
            WHERE id = ?`, [teamId]
        );
        const isCaptain = teamRows[0].captain_id == userId;

        if (isCaptain) {
            // Tìm người chơi khác trong đội để chuyển quyền
            const [otherPlayers] = await pool.query(`
                SELECT user_id
                FROM players
                WHERE team_id = ? AND user_id != ?
                ORDER BY joined_at
                ASC LIMIT 1`, [teamId, userId]
            );

            if (otherPlayers.length === 0) {
                // Không còn ai, reset đội trưởng
                await pool.query(`
                    UPDATE teams
                    SET captain_id = NULL
                    WHERE id = ?`, [teamId]
                );
            } else {
                // Có người chơi khác, chuyển quyền cho người vào sớm nhất
                const newCaptainId = otherPlayers[0].user_id;
                await pool.query(`
                    UPDATE teams
                    SET captain_id = ?
                    WHERE id = ?`, [newCaptainId, teamId]
                );
            }
        }

        // 4. Xóa người chơi khỏi bảng `players`
        await pool.query(`
            DELETE FROM players
            WHERE user_id = ? AND team_id = ?`, [userId, teamId]
        );

        res.status(200).json({ message: 'Rời đội thành công' });
    } catch (error) {
            console.error('Lỗi khi rời đội:', error);
            res.status(500).json({ message: 'Lỗi' });
    }
};

// @desc    Bật/tắt trạng thái sẵn sàng của người chơi
// @route   POST /api/matches/:id/ready
// @access  Private
const toggleReadyStatus = async (req, res) => {
    const { id: matchId } = req.params;
    const userId = req.user.id;

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
            return res.status(400).json({ message: 'Không thể rời đội khi trận đấu đã bắt đầu' });
        }

        // 2. Tìm xem người dùng đang ở đội nào trong trận này
        const teamIdsInMatch = [matchId*2-1, matchId*2];
        const [playerRows] = await pool.query(`
            SELECT *
            FROM players
            WHERE user_id = ? AND team_id IN (?, ?)`, [userId, ...teamIdsInMatch]
        );
        if (playerRows.length === 0) {
            return res.status(404).json({ message: 'Bạn không ở trong đội nào của trận này' });
        }

        // 3. Cập nhật trạng thái is_ready (đảo ngược giá trị hiện tại)
        const currentPlayerRecord = playerRows[0];
        const newReadyState = !currentPlayerRecord.is_ready;

        await pool.query(`
            UPDATE players
            SET is_ready = ?
            WHERE user_id = ? AND team_id = ?`, [newReadyState, userId, currentPlayerRecord.team_id]
        );

        res.status(200).json({
            message: 'Trạng thái sẵn sàng đã được cập nhật',
            isReady: newReadyState
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái sẵn sàng:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// @desc    Admin bắt đầu trận đấu
// @route   POST /api/matches/:id/start
// @access  Admin
const startMatch = async (req, res) => {
    const { id: matchId } = req.params;

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
            return res.status(400).json({ message: 'Trận đấu không ở trạng thái chờ' });
        }

        // 2. Kiểm tra tất cả người chơi đã sẵn sàng chưa
        const teamIdsInMatch = [matchId*2-1, matchId*2];
        const [captainRows] = await pool.query(`
            SELECT captain_id
            FROM teams
            WHERE id IN (?, ?)`, teamIdsInMatch
        );
        console.log(captainRows.length);
        if (captainRows[0].captain_id === null || captainRows[1].captain_id === null) {
            return res.status(404).json({ message: 'Có đội của trận này chưa có captain' });
        }
        const [playerRows] = await pool.query(`
            SELECT is_ready
            FROM players
            WHERE team_id IN (?, ?)`, teamIdsInMatch
        );
        const allReady = playerRows.every(p => p.is_ready === 1);
        if (!allReady) {
            return res.status(400).json({ message: 'Tất cả người chơi chưa sẵn sàng' });
        }
        await pool.query(`
            UPDATE matches
            SET match_status = "in_progress"
            WHERE id = ?`, [matchId]
        );
        res.status(200).json({ message: 'Trận đấu đã bắt đầu thành công!' });
    } catch (error) {
        console.error('Lỗi khi bắt đầu trận đấu:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// @desc    Đội trưởng cấm một map
// @route   POST /api/matches/:id/ban
// @access  Captain
const banMap = async (req, res) => {
    const { id: matchId } = req.params;
    const { map_name } = req.body;
    const captain_id = req.user.id;

    try {
        // 1. Kiểm tra trạng thái trận đấu phải là 'in_progress'
        const [matchRows] = await pool.query(`
            SELECT bo_mode, match_status
            FROM matches
            WHERE id = ?`, [matchId]
        );
        if (matchRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận đấu' });
        }
        if (matchRows[0].match_status !== 'in_progress') {
            return res.status(400).json({ message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' });
        }

        // 2. Lấy lịch sử ban/pick và thông tin đội của captain
        const [mapHistory] = await pool.query(`
            SELECT *
            FROM maps
            WHERE match_id = ?
            ORDER BY action_time ASC`, [matchId]
        );
        const [captainTeam] = await pool.query(`
            SELECT id
            FROM teams
            WHERE captain_id = ?`, [captain_id]
        );
        const teamId = captainTeam[0].id;
        const teamIdentifier = (teamId % 2 !== 0) ? 'team1' : 'team2';

        // 3. Logic xác định lượt (đơn giản hóa cho BO3)
        // BO3 sequence: Ban(T1), Ban(T2), Pick(T1), Pick(T2), Ban(T1), Ban(T2), Decider
        const turn = mapHistory.length;
        let expectedTurnTeam, expectedAction;

        if (matchRows[0].bo_mode === 'bo1') {
            switch (turn) {
                case 0: expectedTurnTeam = 'team1'; expectedAction = 'ban'; break; // Lượt 1: team1 ban
                case 1: expectedTurnTeam = 'team2'; expectedAction = 'ban'; break; // Lượt 2: team2 ban
                case 2: expectedTurnTeam = 'team1'; expectedAction = 'ban'; break; // Lượt 3: team1 ban
                case 3: expectedTurnTeam = 'team2'; expectedAction = 'ban'; break; // Lượt 4: team2 ban
                case 4: expectedTurnTeam = 'team1'; expectedAction = 'ban'; break; // Lượt 5: team1 ban
                case 5: expectedTurnTeam = 'team2'; expectedAction = 'ban'; break; // Lượt 6: team2 ban
                default: return res.status(400).json({ message: 'Không phải lượt cấm map hoặc Veto đã kết thúc' });
            }
        } else if (matchRows[0].bo_mode === 'bo3') {
            switch (turn) {
                case 0: expectedTurnTeam = 'team1'; expectedAction = 'ban'; break; // Lượt 1: team1 ban
                case 1: expectedTurnTeam = 'team2'; expectedAction = 'ban'; break; // Lượt 2: team2 ban
                // ... các lượt pick sẽ được xử lý ở API pick
                case 4: expectedTurnTeam = 'team1'; expectedAction = 'ban'; break; // Lượt 5: team1 ban
                case 5: expectedTurnTeam = 'team2'; expectedAction = 'ban'; break; // Lượt 6: team2 ban
                default: return res.status(400).json({ message: 'Không phải lượt cấm map hoặc Veto đã kết thúc' });
            }
        } else if (matchRows[0].bo_mode === 'bo5') {
            switch (turn) {
                case 0: expectedTurnTeam = 'team1'; expectedAction = 'ban'; break; // Lượt 1: team1 ban
                case 1: expectedTurnTeam = 'team2'; expectedAction = 'ban'; break; // Lượt 2: team2 ban
                // ... các lượt pick sẽ được xử lý ở API pick
                default: return res.status(400).json({ message: 'Không phải lượt cấm map hoặc Veto đã kết thúc' });
            }
        }
        if (teamIdentifier !== expectedTurnTeam) {
            return res.status(400).json({ message: 'Chưa đến lượt của đội bạn' });
        }

        // 4. Kiểm tra map có hợp lệ và chưa được sử dụng không
        if (!map_name) {
            return res.status(400).json({ message: 'Vui lòng cung cấp tên map' });
        }
        const isMapUsed = mapHistory.some(m => m.map_name === map_name);
        if (isMapUsed) {
            return res.status(400).json({ message: 'Map này đã được cấm hoặc chọn' });
        }

        // 5. Thêm hành động vào DB
        await pool.query(`
            INSERT INTO maps (match_id, map_name, action_type, team_action)
            VALUES (?, ?, ?, ?)`, [matchId, map_name, 'ban', teamIdentifier]
        );
        res.status(200).json({ message: `Đội ${teamIdentifier} đã cấm map ${map_name}` });
    } catch (error) {
        console.error('Lỗi khi cấm map:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// @desc    Đội trưởng chọn một map
// @route   POST /api/matches/:id/pick
// @access  Captain
const pickMap = async (req, res) => {
    const { id: matchId } = req.params;
    const { map_name } = req.body;
    const captainId = req.user.id;

    try {
        // 1. Kiểm tra trạng thái trận đấu phải là 'in_progress'
        const [matchRows] = await pool.query(`
            SELECT bo_mode, match_status
            FROM matches
            WHERE id = ?`, [matchId]
        );
        if (matchRows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy trận đấu' });
        }
        if (matchRows[0].match_status !== 'in_progress') {
            return res.status(400).json({ message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' });
        }

        // 2. Lấy lịch sử ban/pick và thông tin đội của captain
        const [mapHistory] = await pool.query(`
            SELECT *
            FROM maps
            WHERE match_id = ?
            ORDER BY action_time ASC`, [matchId]
        );
        const [captainTeam] = await pool.query(`
            SELECT id
            FROM teams
            WHERE captain_id = ?`, [captain_id]
        );
        const teamId = captainTeam[0].id;
        const teamIdentifier = (teamId % 2 !== 0) ? 'team1' : 'team2';
        
        // 3. Logic xác định lượt
        // BO1 sequence: Ban(T1), Ban(T2), Ban(T1), Ban(T2), Ban(T1), Ban(T2), Decider
        // BO3 sequence: Ban(T1), Ban(T2), Pick(T1), Pick(T2), Ban(T1), Ban(T2), Decider
        // BO5 sequence: Ban(T1), Ban(T2), Pick(T1), Pick(T2), Pick(T1), Pick(T2), Decider
        const turn = mapHistory.length;
        let expectedTurnTeam, expectedAction;

        if (matchRows[0].bo_mode === 'bo1') {
            return res.status(400).json({ message: 'Không phải lượt chọn map hoặc Veto đã kết thúc' });
        } else if (matchRows[0].bo_mode === 'bo3') {
            switch (turn) {
                // ... các lượt ban sẽ được xử lý ở API ban
                case 2: expectedTurnTeam = 'team1'; expectedAction = 'pick'; break; // Lượt 1: team1 pick
                case 3: expectedTurnTeam = 'team2'; expectedAction = 'pick'; break; // Lượt 2: team2 pick
                default: return res.status(400).json({ message: 'Không phải lượt chọn map hoặc Veto đã kết thúc' });
            }
        } else if (matchRows[0].bo_mode === 'bo5') {
            switch (turn) {
                // ... các lượt ban sẽ được xử lý ở API bam
                case 2: expectedTurnTeam = 'team1'; expectedAction = 'pick'; break; // Lượt 3: team1 pick
                case 3: expectedTurnTeam = 'team2'; expectedAction = 'pick'; break; // Lượt 4: team2 pick
                case 4: expectedTurnTeam = 'team1'; expectedAction = 'pick'; break; // Lượt 5: team1 pick
                case 5: expectedTurnTeam = 'team2'; expectedAction = 'pick'; break; // Lượt 6: team2 pick
                default: return res.status(400).json({ message: 'Không phải lượt chọn map hoặc Veto đã kết thúc' });
            }
        }
        if (teamIdentifier !== expectedTurnTeam) {
            return res.status(400).json({ message: 'Chưa đến lượt của đội bạn' });
        }
        
        // 4. Kiểm tra map có hợp lệ và chưa được sử dụng không
        if (!map_name) {
            return res.status(400).json({ message: 'Vui lòng cung cấp tên map' });
        }
        const isMapUsed = mapHistory.some(m => m.map_name === map_name);
        if (isMapUsed) {
            return res.status(400).json({ message: 'Map này đã được cấm hoặc chọn' });
        }

        // 5. Thêm hành động vào DB
        await pool.query(`
            INSERT INTO maps (match_id, map_name, action_type, team_action)
            VALUES (?, ?, ?, ?)`, [matchId, map_name, 'pick', teamIdentifier]
        );
        res.status(200).json({ message: `Đội ${teamIdentifier} đã chọn map ${map_name}` });
    } catch (error) {
        console.error('Lỗi khi chọn map:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// @desc    Đội trưởng chọn phe cho map đối phương đã pick
// @route   POST /api/matches/:id/side
// @access  Captain
const chooseSide = async (req, res) => {
    const { id: matchId } = req.params;
    const { map_name, side } = req.body;
    const captainId = req.user.id;

    try {
        // 1. Validate input
        if (!map_name || !side) {
            return res.status(400).json({ message: 'Vui lòng cung cấp map_name và side' });
        }
        if (!['ct', 't'].includes(side.toLowerCase())) {
            return res.status(400).json({ message: 'Side không hợp lệ, phải là "ct" hoặc "t"' });
        }

        // 2. Lấy thông tin map đã được pick
        const [mapRows] = await pool.query(`
            SELECT *
            FROM maps
            WHERE match_id = ? AND map_name = ? AND action_type = "pick"`, [matchId, map_name]
        );
        if (mapRows.length === 0) {
            return res.status(404).json({ message: 'Map này chưa được pick trong trận đấu' });
        }
        if (mapRows[0].side_team !== null) {
            return res.status(400).json({ message: 'Phe của map này đã được chọn' });
        }
        const teamThatPicked = mapRows[0].team_action; // Ví dụ: 'team1'

        // 3. Kiểm tra quyền: người chọn side phải là captain của đội đối phương
        const [captainTeam] = await pool.query(`
            SELECT id
            FROM teams
            WHERE captain_id = ?`, [captainId]
        );
        const captainTeamId = captainTeam[0].id;
        const captainTeamIdentifier = (captainTeam % 2 !== 0) ? 'team1' : 'team2';

        if (captainTeamIdentifier === teamThatPicked) {
            return res.status(403).json({ message: 'Đội của bạn không có quyền chọn phe cho map này' });
        }

        // 4. Cập nhật phe đã chọn vào DB
        await pool.query(`
            UPDATE maps
            SET side_team = ?
            WHERE match_id = ? AND map_name = ?`, [side.toLowerCase(), matchId, map_name]
        );

        res.status(200).json({ message: `Đội ${captainTeamIdentifier} đã chọn phe ${side.toUpperCase()} cho map ${map_name}` });
    } catch (error) {
        console.error('Lỗi khi chọn phe:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// @desc    Lấy lịch sử cấm/chọn map của một trận đấu
// @route   GET /api/matches/:id/maps
// @access  Public
const getMapHistory = async (req, res) => {
    const { id: matchId } = req.params;

    try {
        const [mapHistory] = await pool.query(`
            SELECT * 
            FROM maps 
            WHERE match_id = ? 
            ORDER BY action_time ASC`, [matchId]
        );
    
        // Luôn trả về một mảng, kể cả khi rỗng
        res.status(200).json(mapHistory);
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử map:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

export { getAllMatches, getMatchById, joinTeam, leaveTeam, toggleReadyStatus, startMatch, banMap, pickMap, chooseSide, getMapHistory };
