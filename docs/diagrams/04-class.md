# Sơ đồ Lớp (Class Diagrams)

> Mermaid hỗ trợ `classDiagram` chuẩn UML. Các attribute được lấy đúng từ `prisma/schema.prisma` và method từ services thực tế trong code.

---

## C3.1 — Class diagram: module Quản lý quân nhân

```mermaid
classDiagram
    class QuanNhan {
        +String id
        +String cccd
        +String ho_ten
        +String gioi_tinh
        +Date ngay_sinh
        +String que_quan_2_cap
        +String que_quan_3_cap
        +String tru_quan
        +String cho_o_hien_nay
        +Json co_quan_don_vi
        +Date ngay_nhap_ngu
        +Date ngay_xuat_ngu
        +Date ngay_vao_dang
        +String so_the_dang_vien
        +String so_dien_thoai
        +String cap_bac
        +String co_quan_don_vi_id
        +String don_vi_truc_thuoc_id
        +String chuc_vu_id
        +Date createdAt
        +Date updatedAt
    }

    class CapBac {
        <<enumeration>>
        BINH_NHI
        BINH_NHAT
        HA_SI
        TRUNG_SI
        THUONG_SI
        THIEU_UY
        TRUNG_UY
        THUONG_UY
        DAI_UY
        THIEU_TA
        TRUNG_TA
        THUONG_TA
        DAI_TA
        THIEU_TUONG
        TRUNG_TUONG
        THUONG_TUONG
        DAI_TUONG
    }

    class GioiTinh {
        <<enumeration>>
        NAM
        NU
    }

    class PersonnelRoute {
        <<Route>>
        +GET /api/personnel
        +POST /api/personnel
        +GET /api/personnel/:id
        +PUT /api/personnel/:id
        +DELETE /api/personnel/:id
        +GET /api/personnel/export
        +POST /api/personnel/check-contribution-eligibility
    }

    class PersonnelController {
        -personnelService
        +getPersonnel(req, res)
        +getPersonnelById(req, res)
        +createPersonnel(req, res)
        +updatePersonnel(req, res)
        +deletePersonnel(req, res)
        +exportPersonnel(req, res)
        +checkContributionEligibility(req, res)
    }

    class PersonnelService {
        -quanNhanRepository
        -unitRepository
        +getPersonnel(filter, role, quanNhanId) PaginatedQuanNhan
        +getPersonnelById(id, userRole, userQuanNhanId) QuanNhan
        +createPersonnel(data) QuanNhan
        +updatePersonnel(id, data, role) QuanNhan
        +deletePersonnel(id, userRole, userQuanNhanId) void
        +exportPersonnel() QuanNhan[]
        +checkContributionEligibility(personnelIds) Result[]
    }

    class QuanNhanRepository {
        +findById(id, tx) QuanNhan
        +findByIdForDetail(id, tx) QuanNhanWithRelations
        +findByIdWithAccount(id, tx) QuanNhan
        +findIdByCccd(cccd, tx) String
        +findManyByIds(ids, tx) QuanNhan[]
        +findAllForExport(tx) QuanNhan[]
        +count(where, tx) Number
        +create(data, tx) QuanNhan
        +update(id, data, tx) QuanNhan
        +delete(id, tx) void
        +groupByCapBac(where, tx) Group[]
    }

    QuanNhan --> CapBac : sử dụng
    QuanNhan --> GioiTinh : sử dụng
    PersonnelRoute --> PersonnelController : routes to
    PersonnelController --> PersonnelService : uses
    PersonnelService --> QuanNhanRepository : uses
    QuanNhanRepository --> QuanNhan : manages
```

---

## C3.2 — Class diagram: module Đề xuất khen thưởng (Strategy pattern)

```mermaid
classDiagram
    class ProposalStrategy {
        <<interface>>
        +readonly type ProposalType
        +buildSubmitPayload(titleData, ctx) Promise SubmitValidationResult
        +validateApprove(editedData, ctx) Promise String[]
        +importInTransaction(editedData, ctx, decisions, pdfPaths, acc, prismaTx) Promise void
        +buildSuccessMessage(acc) String
    }

    class CaNhanHangNamStrategy {
        +type CA_NHAN_HANG_NAM
        +buildSubmitPayload()
        +validateApprove()
        +importInTransaction()
        +buildSuccessMessage()
    }

    class DonViHangNamStrategy {
        +type DON_VI_HANG_NAM
        +buildSubmitPayload()
        +validateApprove()
        +importInTransaction()
        +buildSuccessMessage()
    }

    class NienHanStrategy {
        +type NIEN_HAN
        +buildSubmitPayload()
        +validateApprove()
        +importInTransaction()
        +buildSuccessMessage()
    }

    class CongHienStrategy {
        +type CONG_HIEN
        +buildSubmitPayload()
        +validateApprove()
        +importInTransaction()
        +buildSuccessMessage()
    }

    class HcQkqtStrategy {
        +type HC_QKQT
        +buildSubmitPayload()
        +validateApprove()
        +importInTransaction()
        +buildSuccessMessage()
    }

    class KncStrategy {
        +type KNC_VSNXD_QDNDVN
        +buildSubmitPayload()
        +validateApprove()
        +importInTransaction()
        +buildSuccessMessage()
    }

    class NckhStrategy {
        +type NCKH
        +buildSubmitPayload()
        +validateApprove()
        +importInTransaction()
        +buildSuccessMessage()
    }

    class StrategyRegistry {
        -REGISTRY Record
        +getProposalStrategy(type) ProposalStrategy
        +requireProposalStrategy(type) ProposalStrategy
    }

    class SingleMedalImporter {
        <<helper>>
        +importSingleMedal(tx, payload, config) ImportResult
    }

    class ProposalService {
        -strategyRegistry
        -proposalRepository
        +submitProposal(data, userId, role) BangDeXuat
        +approveProposal(id, editedData, adminId, decisions, pdfFiles) BangDeXuat
        +rejectProposal(id, reason, adminId) BangDeXuat
        +getProposals(filters, role) PaginatedBangDeXuat
        +getProposalById(id, role) BangDeXuat
    }

    class ProposalController {
        -proposalService
        +submitProposal(req, res)
        +approveProposal(req, res)
        +rejectProposal(req, res)
        +getProposals(req, res)
        +getProposalById(req, res)
        +deleteProposal(req, res)
    }

    ProposalStrategy <|.. CaNhanHangNamStrategy
    ProposalStrategy <|.. DonViHangNamStrategy
    ProposalStrategy <|.. NienHanStrategy
    ProposalStrategy <|.. CongHienStrategy
    ProposalStrategy <|.. HcQkqtStrategy
    ProposalStrategy <|.. KncStrategy
    ProposalStrategy <|.. NckhStrategy

    StrategyRegistry --> ProposalStrategy : returns
    HcQkqtStrategy ..> SingleMedalImporter : uses
    KncStrategy ..> SingleMedalImporter : uses

    ProposalController --> ProposalService
    ProposalService --> StrategyRegistry : dispatch
```

**Điểm bán pattern (defend trong ĐATN)**:
- 7 strategy đều implement interface `ProposalStrategy` với 4 method
- `ProposalService` không biết về cụ thể từng loại — gọi qua `getStrategy(type)`
- Thêm loại mới: thêm 1 file strategy + register vào REGISTRY, không sửa controller/service
- 2 strategy "single-medal" (HC_QKQT + KNC) chia sẻ logic qua helper `SingleMedalImporter`

---

## C3.3 — Class diagram: module Eligibility (chain rule)

```mermaid
classDiagram
    class ChainAwardConfig {
        +String code
        +Number cycleYears
        +RequiredFlag[] requiredFlags
        +Boolean requiresNCKH
        +Boolean isLifetime
        +String flagColumn
        +String streakLabel
    }

    class RequiredFlag {
        +String code
        +Number count
    }

    class PersonalChainAwards {
        <<constant>>
        +BKBQP ChainAwardConfig
        +CSTDTQ ChainAwardConfig
        +BKTTCP ChainAwardConfig
    }

    class UnitChainAwards {
        <<constant>>
        +BKBQP ChainAwardConfig
        +BKTTCP ChainAwardConfig
    }

    class ChainContext {
        +Number chainStartYear
        +Number lastBkbqpYear
        +Number lastCstdtqYear
        +Number lastBkttcpYear
        +Number streakSinceLastBkbqp
        +Number streakSinceLastCstdtq
        +Number streakSinceLastBkttcp
        +Number missedBkbqp
        +Number missedCstdtq
    }

    class ChainEligibilityResult {
        +Boolean eligible
        +String reason
        +String code
        +String suggestion
    }

    class ChainEligibility {
        <<service>>
        +checkChainEligibility(award, streaks, hasReceived, flagsInWindow) EligibilityResult
        +buildInsufficientReason(award, streaks, flagsInWindow) String
        +checkAwardEligibility(personnelId, year, danhHieu) Promise~EligibilityResult~
    }

    class AnnualProfileService {
        +recalculateAnnualProfile(quanNhanId) HoSoHangNam
        +lastFlagYearInChain(records, code) Number
        +computeChainContext(records, year) ChainContext
        +computeEligibilityFlags(personnel, ctx, awards, nckh) EligibilityFlags
    }

    class UnitEligibilityService {
        +recalculateUnitProfile(unitId) HoSoDonViHangNam
        +checkUnitChainEligibility(unit, year, code) ChainEligibilityResult
    }

    class CongHienMonthsAggregator {
        <<module>>
        +classifyHeSoGroup(heSo) CongHienHeSoGroup
        +sumMonthsByGroup(histories) PositionMonthsByGroup
        +aggregatePositionMonthsByGroup(histories, cutoffDate) PositionMonthsByGroup
    }

    class ServiceYearsHelper {
        <<module>>
        +calculateServiceMonths(startDate, endDate) Number
        +calculateCoveredMonthsByMonth(startDate, endDate) Number
        +calculateTenureMonthsWithDayPrecision(startDate, endDate) Number
        +recalcPositionMonths(histories, cutoffDate) PositionHistory[]
        +buildCutoffDate(nam, thang) Date
        +formatServiceDuration(totalMonths) String
    }

    PersonalChainAwards o-- ChainAwardConfig
    UnitChainAwards o-- ChainAwardConfig
    ChainAwardConfig o-- RequiredFlag
    AnnualProfileService --> ChainEligibility : uses core
    UnitEligibilityService --> ChainEligibility : uses core
    AnnualProfileService --> ChainContext : computes
    AnnualProfileService --> ServiceYearsHelper : uses
    CongHienMonthsAggregator --> ServiceYearsHelper : uses
    ChainEligibility --> ChainEligibilityResult : returns
    ChainEligibility --> PersonalChainAwards : reads
    ChainEligibility --> UnitChainAwards : reads
```

**Defend**: `ChainEligibility` là **single source of truth** cho rule chuỗi — cả personal (`AnnualProfileService`) và unit (`UnitEligibilityService`) đều gọi cùng một hàm `checkChainEligibility()`, đảm bảo logic không bị lệch giữa hai bên.

---

## C3.4 — Class diagram: module Tài khoản và Phân quyền

```mermaid
classDiagram
    class TaiKhoan {
        +String id
        +String quan_nhan_id
        +String username
        +String password_hash
        +String role
        +String refreshToken
        +Date createdAt
        +Date updatedAt
    }

    class Role {
        <<enumeration>>
        SUPER_ADMIN
        ADMIN
        MANAGER
        USER
    }

    class AuthRoute {
        +POST /api/auth/login
        +POST /api/auth/refresh
        +POST /api/auth/logout
        +POST /api/auth/change-password
    }

    class AuthController {
        -authService
        +login(req, res)
        +refresh(req, res)
        +logout(req, res)
        +changePassword(req, res)
    }

    class AuthService {
        -accountRepository
        +login(username, password) LoginResult
        +refreshAccessToken(refreshToken) TokenPair
        +logout(refreshToken) Result
        +changePassword(userId, oldPwd, newPwd) void
    }

    class AccountController {
        -accountService
        +getAccounts(req, res)
        +getAccountById(req, res)
        +createAccount(req, res)
        +updateAccount(req, res)
        +resetPassword(req, res)
        +deleteAccount(req, res)
    }

    class AccountService {
        -accountRepository
        +getAccounts(filter, role) PaginatedTaiKhoan
        +getAccountById(id) TaiKhoan
        +createAccount(data) TaiKhoan
        +updateAccount(id, data) TaiKhoan
        +resetPassword(id) String
        +deleteAccount(id) void
    }

    class AccountRepository {
        +findByUsername(username) TaiKhoan
        +findById(id) TaiKhoan
        +create(data) TaiKhoan
        +update(id, data) TaiKhoan
        +delete(id) void
    }

    class VerifyTokenMiddleware {
        +verifyToken(req, res, next)
    }

    class RequireRoleMiddleware {
        +requireSuperAdmin
        +requireAdmin
        +requireManager
        +requireRole(roles)
    }

    TaiKhoan --> Role : has
    AuthRoute --> AuthController
    AuthController --> AuthService
    AuthService --> AccountRepository
    AccountController --> AccountService
    AccountService --> AccountRepository
    AccountRepository --> TaiKhoan : manages
    VerifyTokenMiddleware ..> AuthService : uses
    RequireRoleMiddleware ..> Role : checks
```

---

## C3.5 — Class diagram: module Audit Log + Notification

```mermaid
classDiagram
    class SystemLog {
        +String id
        +String nguoi_thuc_hien_id
        +String actor_role
        +String action
        +String resource
        +String tai_nguyen_id
        +String description
        +Json payload
        +String ip_address
        +String user_agent
        +Date createdAt
    }

    class ThongBao {
        +String id
        +String nguoi_nhan_id
        +String recipient_role
        +String type
        +String title
        +String message
        +String resource
        +String tai_nguyen_id
        +String link
        +Boolean is_read
        +String nhat_ky_he_thong_id
        +Date createdAt
        +Date readAt
    }

    class AuditAction {
        <<enumeration>>
        CREATE
        UPDATE
        DELETE
        LOGIN
        LOGOUT
        APPROVE
        REJECT
        IMPORT
        EXPORT
        BACKUP_SUCCESS
        BACKUP_FAILED
        RECALC
    }

    class NotificationType {
        <<enumeration>>
        NEW_PERSONNEL
        APPROVAL_PENDING
        ACHIEVEMENT_SUBMITTED
        PROPOSAL_APPROVED
        PROPOSAL_REJECTED
        BACKUP_FAILED
    }

    class AuditLogMiddleware {
        +auditLog(options) Middleware
        +writeSystemLog(data) void
    }

    class AuditLogHelpers {
        <<helper>>
        +getResourceId(req) String
        +getLogDescription(action, resource, payload) String
        +RESOURCE_VI Map
    }

    class NotificationService {
        -notificationRepository
        -socketService
        +createNotification(data) ThongBao
        +listForUser(userId, role) PaginatedThongBao
        +markAsRead(id, userId) void
        +countUnread(userId) Number
    }

    class NotificationHelpers {
        <<helper>>
        +buildAwardNotification(type, payload) NotificationData
        +RESOURCE_TO_PROPOSAL_TYPE Map
    }

    class SystemLogsController {
        -systemLogsService
        +list(req, res)
        +getResources(req, res)
    }

    class SystemLogsService {
        -systemLogRepository
        +getLogs(userRole, filters) PaginatedSystemLog
        +getResources(userRole) Resource[]
    }

    SystemLog --> AuditAction : has action
    ThongBao --> NotificationType : has type
    ThongBao --> SystemLog : optional ref
    AuditLogMiddleware --> AuditLogHelpers : uses
    AuditLogMiddleware --> SystemLog : creates
    NotificationService --> NotificationHelpers : uses
    NotificationService --> ThongBao : creates
    SystemLogsController --> SystemLogsService
    SystemLogsService --> SystemLog : reads with role filter
```

**Đặc thù**: `SystemLogsService.getLogs()` có **filter theo role** — `resource: 'backup'` chỉ trả về cho `SUPER_ADMIN`. ADMIN và MANAGER không xem được log backup. Khác với HRM mẫu không có visibility filter.

---

## Tổng kết

| # | Sơ đồ | Số class | Pattern thể hiện |
|---|---|---|---|
| C3.1 | Quản lý quân nhân | 6 + 2 enum | Layered architecture |
| C3.2 | Đề xuất khen thưởng | 11 | **Strategy pattern** (điểm bán) |
| C3.3 | Eligibility module | 11 | **Single source of truth** chain rule |
| C3.4 | Tài khoản phân quyền | 9 + 1 enum | Middleware chain |
| C3.5 | Audit log + Notification | 9 + 2 enum | Cross-cutting concern |

→ Báo cáo mẫu HRM chỉ có **1 class diagram** đơn giản. PM QLKT có **5 class diagram** thể hiện được Strategy pattern + Repository pattern + chain eligibility — đủ chuyên sâu để defend.
