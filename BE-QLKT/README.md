# 🎖️ BE-QLKT - Backend Hệ thống Quản lý Khen thưởng

## 📋 Giới thiệu

**BE-QLKT** là phần backend của hệ thống Quản lý Khen thưởng cho Học viện Khoa học Quân sự, được xây dựng bằng Node.js, Express.js và PostgreSQL.

## 🚀 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js 4.18.2
- **Database**: PostgreSQL
- **ORM**: Prisma 6.17.1
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **File Processing**: exceljs, multer
- **Document Generation**: docx, pdfkit

## 📂 Cấu trúc Thư mục

```
BE-QLKT/
├── src/
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── routes/             # API routes
│   ├── middlewares/        # Express middlewares (auth, audit log)
│   ├── models/             # Prisma models
│   ├── helpers/            # Helper functions
│   ├── configs/            # Database config
│   ├── constants/          # Constants
│   └── scripts/            # Utility scripts
├── prisma/                 # Prisma schema & migrations
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── uploads/                # Uploaded files
└── storage/                # Storage for proposals
```

## 🛠️ Setup

### Yêu cầu Hệ thống

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm hoặc yarn

### Cài đặt

```bash
# Clone repository
git clone https://github.com/tranducbk/BE-QuanLyKhenThuong.git
cd BE-QuanLyKhenThuong

# Cài đặt dependencies
npm install

# Tạo file .env
cp .env.example .env
# Chỉnh sửa .env với thông tin database của bạn

# Generate Prisma Client
npx prisma generate

# Chạy migrations
npx prisma migrate dev

# Khởi tạo Super Admin (tùy chọn)
npm run init-super-admin

# Chạy development server
npm run dev
```

Server sẽ chạy tại `http://localhost:5000`

## 📝 Environment Variables

Tạo file `.env` với các biến sau:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/qlkt"

# JWT
JWT_SECRET="your-secret-key-here"
JWT_REFRESH_SECRET="your-refresh-secret-here"

# Server
PORT=5000
NODE_ENV=development

# Email (nếu có)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-password
```

## 🔧 Scripts

```bash
npm run dev              # Chạy development server (nodemon)
npm start                # Chạy production server
npm run init-super-admin # Khởi tạo Super Admin account
```

## 🗄️ Database

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Chạy migrations
npx prisma migrate dev

# Push schema lên database (không tạo migration)
npx prisma db push

# Mở Prisma Studio (GUI database)
npx prisma studio

# Reset database (XÓA TẤT CẢ DỮ LIỆU)
npx prisma migrate reset
```

## 🔐 Authentication

Hệ thống sử dụng JWT với 2 loại token:

- **Access Token**: Hết hạn sau 15 phút
- **Refresh Token**: Hết hạn sau 7 ngày

### API Endpoints

- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/refresh` - Làm mới access token
- `POST /api/auth/logout` - Đăng xuất

## 🎭 Phân quyền

### Roles

1. **SUPER_ADMIN**: Quản lý tài khoản + tất cả quyền ADMIN
2. **ADMIN**: Quản lý toàn bộ dữ liệu (đơn vị, chức vụ, quân nhân, khen thưởng)
3. **MANAGER**: Quản lý quân nhân và khen thưởng trong đơn vị được phân công
4. **USER**: Chỉ xem thông tin cá nhân

## 📚 API Documentation

Xem chi tiết API tại: [QLKT.md](../Document/QLKT.md)

## 🔍 Middleware

### Authentication

- `verifyToken`: Xác thực JWT token
- `requireAuth`: Yêu cầu đăng nhập
- `requireAdmin`: Yêu cầu quyền ADMIN trở lên
- `requireManager`: Yêu cầu quyền MANAGER trở lên

### Audit Log

Tất cả các thao tác CRUD quan trọng đều được ghi log tự động thông qua middleware `auditLog`.

## 📦 Dependencies Chính

- `express`: Web framework
- `@prisma/client`: Prisma ORM client
- `jsonwebtoken`: JWT authentication
- `bcrypt`: Password hashing
- `multer`: File upload
- `exceljs`: Excel file processing
- `docx`: Word document generation
- `pdfkit`: PDF generation

## 🐛 Troubleshooting

### Lỗi kết nối Database

```bash
# Kiểm tra kết nối
npx prisma db pull

# Reset và migrate lại
npx prisma migrate reset
npx prisma migrate dev
```

### Lỗi Prisma Client

```bash
# Generate lại Prisma Client
npx prisma generate
```

## 📄 License

This project is proprietary software for Vietnam Military Science Academy.

## 📞 Contact

- **Developer**: Trần Đức
- **Organization**: Học viện Khoa học Quân sự

---

**Built with ❤️ for Vietnam Military Science Academy**

