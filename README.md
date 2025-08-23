# giORZang's Dedicated Server

## Backend

**1. Auth APIs**
| **Method** | **Endpoint** | **Mô tả** |
|------------|--------------|-----------|
| `GET` | `/api/steam` | Redirect sang Steam login |
| `GET` | `/api/logout` | Đăng xuất tài khoản Steam |

**2. Match APIs**
| **Method** | **Endpoint** | **Mô tả** |
|------------|--------------|-----------|
| `GET` | `/api/matches` | Lấy danh sách tất cả matches (hiển thị ở trang matches) |
| `POST` | `/api/matches` | (only Admin) Tạo match mới (match_name, bo_mode, passwd, descri, teams.teamname) |
| `GET` | `/api/matches/:id` | Lấy chi tiết 1 match |
| `POST` | `/api/matches/:id/edit` | Sửa thông tin match (match_name, bo_mode, passwd, descri, teams.teamname) |
| `POST` | `/api/matches/:id/start` | (only Admin) bắt đầu match (check captain already exists per team, check all players ready, chuyển `waiting` sang `in_progress`)

**3. Team/Player APIs**
| **Method** | **Endpoint** | **Mô tả** |
|------------|--------------|-----------|
| `POST` | `/api/matches/:id/join` | Người chơi tham gia team1/team2 (nếu là player đầu tiên join team thì là captain |
| `POST` | `/api/matches/:id/leave` | Người chơi rời khỏi team (nếu player là captain thì chuyển captain cho người vào team sớm nhất, sau đó xóa record trong bảng `players`) |
| `POST` | `/api/matches/:id/ready` | Người chơi toggle ready/unready (`isready`) |

**4. Ban/Pick Map APIs (sau khi start)**
| **Method** | **Endpoint** | **Mô tả** |
|------------|--------------|-----------|
| `POST` | `/api/matches/:id/ban` | (only Captain) ban map |
| `POST` | `/api/matches/:id/pick` | (only Captain) pick map |
| `POST` | `/api/matches/:id/side` | (only Captain) chọn side (CT/T) cho map đã pick |
| `GET` | `/api/matches/:id/maps` | Lấy thông tin ban/pick trong match |

**5. Server Interaction APIs**
| **Method** | **Endpoint** | **Mô tả** |
|------------|--------------|-----------|
| `POST` | `/api/rcon` | (only Admin) Gửi lệnh RCON tới CS2 server |
