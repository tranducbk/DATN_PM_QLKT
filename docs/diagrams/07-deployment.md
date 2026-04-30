# Sơ đồ Triển khai (Deployment Diagram)

> Mermaid không có syntax UML Deployment thuần — dùng `flowchart` với `subgraph` để biểu diễn các node (server/máy chủ/thiết bị).

---

## C8.1 — Deployment diagram tổng thể

```mermaid
flowchart TB
    subgraph CLIENT[Thiết bị người dùng]
        direction TB
        PC[PC laptop ADMIN MANAGER USER]
        BR[Trình duyệt: Chrome Edge Firefox]
        PC --> BR
    end

    subgraph LAN[Mạng nội bộ Học viện]
        direction TB

        subgraph SERVER[Máy chủ ứng dụng Linux Ubuntu 22.04 LTS]
            direction TB
            NX[Nginx reverse proxy SSL termination port 443]
            subgraph PM2[PM2 cluster]
                FE[Next.js process port 3000]
                BE[Express API process port 5000]
                CRON[Cron jobs: daily backup recalc batch]
            end
            UPLOADS[/uploads excel pdf attachments/]
            BACKUPS[/backups daily sql/]
            NX --> FE
            NX --> BE
            BE --> UPLOADS
            BE --> BACKUPS
            CRON --> BE
        end

        subgraph DBSRV[Máy chủ CSDL]
            PG[(PostgreSQL 14 23 bảng)]
        end

        SERVER --> DBSRV
    end

    BR -->|HTTPS port 443| NX
    BR <-->|WebSocket wss| BE

    classDef client fill:#e6f2ff,stroke:#0066cc
    classDef server fill:#fff4e6,stroke:#ff8c00
    classDef db fill:#ffe6e6,stroke:#cc0000

    class PC,BR client
    class NX,FE,BE,CRON,UPLOADS,BACKUPS server
    class PG db
```

---

## C8.2 — Mô tả thành phần

### Thiết bị người dùng
- **PC / laptop**: Thiết bị nội bộ của các vai trò SUPER_ADMIN / ADMIN / MANAGER / USER trong Phòng QLKT
- **Trình duyệt**: Khuyến nghị Chrome 120+, Edge 120+, Firefox 120+ (hỗ trợ ES2020 + WebSocket)

### Máy chủ ứng dụng (App Server)
- **OS**: Ubuntu 22.04 LTS (giả định)
- **Nginx**: Reverse proxy + SSL termination (cấp cert nội bộ hoặc Let's Encrypt nếu domain public)
  - Public port 443 (HTTPS) + 80 (redirect)
  - Forward request `/` → Next.js (port 3000)
  - Forward request `/api/*` và `/socket.io/*` → Express (port 5000)
- **PM2**: Process manager với `ecosystem.config.js` (file đã có ở root project)
  - **Next.js process**: render UI, server components, route groups `app/{admin,manager,user}/*`
  - **Express API process**: REST endpoints + Socket.IO server + audit log + notification
  - **Cron jobs**: chạy bằng `node-cron` trong cùng process Express (hoặc tách thành process riêng nếu workload tăng)
- **File system**:
  - `uploads/`: Excel template, file đính kèm đề xuất, file PDF quyết định
  - `backups/`: file SQL backup hằng ngày (giữ N ngày theo `SystemSetting.BACKUP_RETENTION_DAYS`)

### Máy chủ CSDL (DB Server)
- **PostgreSQL 14+**: 23 bảng theo `prisma/schema.prisma`
- Có thể deploy cùng máy với App Server (single-node) hoặc tách máy riêng (cluster) tùy quy mô
- Backup file `.sql` được lưu trên App Server qua `pg_dump`

### Mạng
- **HTTPS port 443**: kết nối client ↔ Nginx
- **WebSocket WSS**: kết nối client ↔ Express qua Socket.IO (cho thông báo realtime)
- Toàn bộ chạy trong **mạng nội bộ Học viện** (LAN), không expose ra internet để đáp ứng yêu cầu bảo mật quân đội

---

## C8.3 — Tùy chọn deploy nâng cao (Docker Compose)

> Đây là **option** nếu bạn muốn defend thêm phần "deploy production-ready". Không bắt buộc.

```mermaid
flowchart LR
    subgraph DOCKER[Docker host Ubuntu 22.04]
        direction TB

        subgraph COMPOSE[docker-compose.yml]
            direction LR
            CFE[fe-qlkt container Next.js]
            CBE[be-qlkt container Express]
            CDB[postgres container]
            CNX[nginx container]
        end

        VOL1[(volume: postgres-data)]
        VOL2[(volume: uploads)]
        VOL3[(volume: backups)]

        CDB --> VOL1
        CBE --> VOL2
        CBE --> VOL3
    end

    USER[Browser người dùng] -->|HTTPS 443| CNX
    CNX --> CFE
    CNX --> CBE
    CBE --> CDB
```

**Lợi ích**:
- One-command deploy: `docker compose up -d`
- Isolation: mỗi service trong container riêng
- Dễ backup: copy volume `postgres-data`, `uploads`, `backups`
- Dễ migrate: pull image mới + `docker compose up -d --no-deps fe-qlkt be-qlkt`

**Trade-off**:
- Thêm overhead bộ nhớ ~200MB (4 container)
- Cần học Docker (có thể là lợi thế khi defend "biết DevOps cơ bản")

---

## C8.4 — Mô tả file `ecosystem.config.js` (PM2)

Bạn đã có sẵn file này ở root. Trong báo cáo, có thể trích nội dung minh họa:

```javascript
module.exports = {
  apps: [
    {
      name: 'be-qlkt',
      cwd: './BE-QLKT',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
    {
      name: 'fe-qlkt',
      cwd: './FE-QLKT',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
```

Khởi động:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup     # tự khởi động khi reboot máy
```

---

## Tổng kết

| # | Sơ đồ | Mục đích |
|---|---|---|
| C8.1 | Deployment tổng thể | Cho hội đồng thấy hệ thống deploy thực tế thế nào |
| C8.2 | Mô tả thành phần | Giải thích từng node/server |
| C8.3 | Docker Compose option | Defend khả năng DevOps |
| C8.4 | PM2 ecosystem | Trích minh họa file cấu hình |

→ Báo cáo mẫu HRM **không có** Deployment diagram. Phần này là **điểm cộng** cho thesis của bạn.
