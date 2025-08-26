import { Rcon } from 'rcon-client';

const sendCommand = async (req, res) => {
    const { command } = req.body;

    if (!command) {
        return res.status(400).json({ message: 'Vui lòng cung cấp một lệnh' });
    }

    let rcon;
    try {
        // Khởi tạo kết nối RCON
        rcon = new Rcon({
            host: process.env.RCON_HOST,
            port: process.env.RCON_PORT,
            password: process.env.RCON_PASSWORD,
        });

        await rcon.connect();
        console.log('RCON connected!');

        const response = await rcon.send(command);
        console.log('RCON response:', response);

        res.status(200).json({ response });

    } catch (error) {
        console.error('RCON Error:', error);
        res.status(500).json({ message: 'Lỗi khi gửi lệnh RCON', error: error.message });
    } finally {
        // Đảm bảo kết nối luôn được đóng
        if (rcon) {
            await rcon.end();
            console.log('RCON connection closed.');
        }
    }
};

export { sendCommand };
