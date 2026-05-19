# Astah Java Import — Class Diagrams cho ĐATN PM QLKT

## Cách import vào Astah

1. Astah → menu **Tools → Java → Import Java...**
2. Chọn thư mục `astah-import/` (hoặc từng subfolder per module)
3. Astah parse Java files → tự sinh class diagram

## Cấu trúc thư mục

| Folder | Module | Class chính |
|---|---|---|
| `personnel/` | Quản lý quân nhân | QuanNhan, PersonnelController, PersonnelService + 2 enum |
| `account/` | Tài khoản + xác thực | TaiKhoan, AccountController, AuthController, AccountService, AuthService + 1 enum |
| `proposal/` | Đề xuất khen thưởng + Strategy pattern | BangDeXuat, ProposalController, ProposalService + interface + 7 strategy + 2 enum |
| `award/` | Quản lý khen thưởng (split theo controller thật) | AnnualRewardController + Service, TenureMedalController + Service, AwardBulkController + Service + Entity + enum |
| `notification/` | Thông báo + nhật ký | ThongBao, SystemLog, NotificationController + Service, SystemLogController + Service + 2 enum |

## Lưu ý

- Mỗi class trong 1 file riêng (Astah Java parser yêu cầu)
- Package = `vn.qlkt.<module>`
- Field tiếng Việt (`ho_ten`, `cap_bac`) giữ snake_case khớp DB
- Method name tiếng Anh khớp source code (`getPersonnel`, `submitProposal`)
- Type giản lược: `String`, `Date`, `Integer`, `Boolean`, `Map` (Json), `List`
- Quan hệ tự suy ra qua field type (vd: `private CapBac capBac` → Astah vẽ association)
- Interface implementation: `implements ProposalStrategy` → Astah vẽ realization

## Sau khi import

Trong Astah, vào **Project View** → tìm class trong package → drag vào diagram để vẽ. Hoặc Astah có thể tự sinh diagram qua menu **Diagram → Create Class Diagram from Project**.
