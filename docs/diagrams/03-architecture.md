# Sơ đồ Kiến trúc & Gói (Architecture & Package)

> Sử dụng `flowchart` cho kiến trúc tổng thể và package diagram (Mermaid không có syntax UML Package thuần). Để render đẹp, dùng VSCode Mermaid Preview.

---

## C1.1 — Kiến trúc tổng thể Client-Server + REST API + WebSocket

```mermaid
flowchart LR
    subgraph CLIENT[Trình duyệt]
        Browser[Chrome / Edge / Firefox]
    end

    subgraph FE[Frontend Next.js 14]
        FENext[Next.js App Router]
        FEPages[Pages SSR + Client Components]
        FEComp[AntD + Tailwind + shadcn-ui]
        FESocket[Socket.IO Client]
        FEApi[lib/api/apiClient]
    end

    subgraph BE[Backend Express + TypeScript]
        Routes[Routes]
        Middleware[Middlewares: verifyToken requireRole validate auditLog]
        Controllers[Controllers]
        Services[Services]
        Repos[Repositories]
        Strategy[Strategy registry: 7 loại proposal]
        Eligibility[Eligibility engine]
        Audit[helpers/auditLog]
        Notif[helpers/notification]
        SocketSrv[Socket.IO Server]
        Prisma[Prisma Client]
    end

    subgraph DB[Cơ sở dữ liệu]
        PG[(PostgreSQL 22 bảng)]
        FS[/File system: uploads excel pdf backups sql/]
    end

    subgraph CRON[Cron Jobs]
        BackupCron[Daily backup pg_dump]
        RecalcCron[Recalc batch eligibility]
    end

    Browser <-->|HTTPS| FENext
    FENext --> FEPages --> FEComp
    FEPages --> FEApi
    FEPages --> FESocket
    FEApi -->|REST JSON + JWT| Routes
    FESocket <-->|WebSocket| SocketSrv
    Routes --> Middleware --> Controllers --> Services
    Services --> Repos --> Prisma --> PG
    Services --> Strategy
    Services --> Eligibility
    Services --> Audit
    Services --> Notif
    Notif --> SocketSrv
    Services --> FS
    BackupCron --> PG
    BackupCron --> FS
    RecalcCron --> Services
```

**Điểm khác biệt với báo cáo mẫu**: Có thêm Socket.IO Server (realtime), Repository layer (decouple Prisma), Cron Jobs (backup + recalc), file system tách biệt.

---

## C1.2 — Mô hình Layered Architecture (Route → Middleware → Controller → Service → Repository → Prisma)

```mermaid
flowchart TD
    Client[Client Request]
    R[Routes layer<br/>routes/*.route.ts]
    M[Middleware layer<br/>verifyToken requireRole validate auditLog]
    C[Controller layer<br/>controllers/*.controller.ts<br/>catchAsync + ResponseHelper]
    S[Service layer<br/>services/*.service.ts<br/>Business logic]
    SS[Sub-services<br/>proposal strategies<br/>eligibility engine<br/>excel helpers]
    Rep[Repository layer<br/>repositories/*.repository.ts<br/>Prisma access]
    P[Prisma Client]
    DB[(PostgreSQL)]
    H[Helpers<br/>pure functions<br/>no DB access]

    Client --> R --> M --> C --> S
    S --> SS
    S --> Rep
    S --> H
    Rep --> P --> DB
    SS --> Rep

    classDef layerR fill:#fff4e6,stroke:#ff8c00
    classDef layerM fill:#e6f2ff,stroke:#0066cc
    classDef layerC fill:#fff5cc,stroke:#cc9900
    classDef layerS fill:#e6ffe6,stroke:#009900
    classDef layerR2 fill:#ffe6f0,stroke:#cc0066
    classDef layerP fill:#e6e6ff,stroke:#3333cc

    class R layerR
    class M layerM
    class C layerC
    class S,SS layerS
    class Rep layerR2
    class P,DB layerP
```

**So sánh với MVC truyền thống**: Báo cáo mẫu HRM dùng MVC 3 lớp (Model-View-Controller). PM QLKT dùng Layered 6 lớp với:
- Tách **Middleware chain** thành lớp riêng
- Thêm **Service** cho business logic (controller mỏng)
- Thêm **Repository** decouple Prisma (commit `9bd12f6`)
- Tách **Helpers** pure (không gọi DB)

→ Đây là điểm chuyên sâu cần defend khi bảo vệ.

---

## C1.3 — Luồng request-response (1 use case mẫu: Tạo đề xuất CA_NHAN_HANG_NAM)

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client (Browser)
    participant Route as proposal.route.ts
    participant Auth as verifyToken
    participant Role as requireManager
    participant Validate as validate(joi)
    participant Audit as auditLog middleware
    participant Ctrl as proposal.controller
    participant Svc as proposal.service
    participant Reg as Strategy REGISTRY
    participant Strat as caNhanHangNamStrategy
    participant Elig as chainEligibility
    participant Repo as proposal.repository
    participant DB as PostgreSQL
    participant Notif as notification.service
    participant Sock as Socket.IO

    Client->>Route: POST /api/proposals (loai=CA_NHAN_HANG_NAM, body)
    Route->>Auth: Check JWT
    Auth->>Route: req.user attached
    Route->>Role: Role MANAGER hoặc ADMIN?
    Role->>Route: OK
    Route->>Validate: Joi validate body
    Validate->>Route: OK
    Route->>Audit: prepare audit (chưa write)
    Route->>Ctrl: createProposal(req)
    Ctrl->>Svc: createProposal(data, userId)
    Svc->>Reg: getStrategy('CA_NHAN_HANG_NAM')
    Reg->>Strat: instance
    Svc->>Strat: buildSubmitPayload(data)
    Strat->>Elig: checkChainEligibility(personnel, year, code)
    Elig->>Repo: lấy danh hiệu hằng năm
    Repo->>DB: SELECT
    DB->>Repo: rows
    Repo->>Elig: data
    Elig->>Strat: { eligible, reason }
    Strat->>Svc: payload
    Svc->>Repo: insertProposal(payload)
    Repo->>DB: INSERT BangDeXuat
    DB->>Repo: id
    Repo->>Svc: proposal
    Svc->>Notif: notifyAdmins(proposal)
    Notif->>DB: INSERT ThongBao
    Notif->>Sock: emit notification:new
    Svc->>Audit: write log CREATE
    Audit->>DB: INSERT SystemLog
    Svc->>Ctrl: proposal
    Ctrl->>Client: 201 Created (ResponseHelper.created)
```

---

## C2.1 — Package diagram phía Client (FE-QLKT)

```mermaid
flowchart TB
    subgraph FE[FE-QLKT/src]
        direction TB

        subgraph APP[app - Next.js App Router]
            APPROOT[layout.tsx + page.tsx + globals.css]
            APPAUTH[auth route group: login]
            APPADMIN[admin]
            APPMANAGER[manager]
            APPUSER[user]
            APPSA[super-admin]
            APPDEV[dev_zone]
        end

        subgraph COMP[components]
            CACC[accounts]
            CADHOC[adhoc-awards]
            CAUTH[auth]
            CCAT[categories]
            CCHART[charts]
            CDASH[dashboard]
            CDEC[decisions]
            CIMP[import-review]
            CPER[personnel]
            CPRO[profile]
            CPROP[proposals]
            CSHARE[shared]
            CSA[super-admin]
            CSL[system-logs]
            CUI[ui shadcn]
            CMAIN[MainLayout.tsx + ThemeProvider.tsx]
        end

        subgraph LIB[lib]
            LIBAPI[api: accounts auth awards personnel proposals notifications systemLogs units profiles dashboard decisions adhocAwards annualAwards unitAnnualAwards]
            LIBAWARD[award]
            LIBPROP[proposal]
            LIBFILE[file]
            LIBTYPES[types]
            LIBCLIENT[apiClient.ts apiError.ts axiosInstance.ts]
            LIBAUTH[authStorage.ts]
            LIBTHEME[antdTheme.ts chartConfig.ts navigation.tsx]
            LIBSCHEMA[schemas.ts]
            LIBUTILS[utils.ts]
        end

        subgraph CONST[constants]
            CONST1[roles awardSlugs danhHieu eligibilityStatus proposalTypes]
        end

        subgraph HOOKS[hooks]
            HOOK1[useAuthGuard]
            HOOK2[useFetch]
            HOOK3[useMobile]
            HOOK4[useProposalListFilters]
            HOOK5[useSocket]
            HOOK6[useToast]
        end

        subgraph CTX[contexts]
            CTX1[AuthContext.tsx]
            CTX2[DevZoneContext.tsx]
        end

        subgraph CONFIG[configs]
            CONFIG1[Next.js + Tailwind + AntD theme]
        end
    end

    APP --> COMP
    APP --> CTX
    APP --> HOOKS
    COMP --> LIB
    COMP --> CONST
    COMP --> HOOKS
    LIB --> CONFIG
    LIB --> CONST
    HOOKS --> LIB
    CTX --> LIB
```

**Đối chiếu code thực tế**: 15 folder `components/` (accounts, adhoc-awards, auth, categories, charts, dashboard, decisions, import-review, personnel, profile, proposals, shared, super-admin, system-logs, ui) + 5 route group `app/` (auth, admin, manager, user, super-admin, dev_zone) + 15 file API trong `lib/api/`.

---

## C2.2 — Package diagram phía Server (BE-QLKT)

```mermaid
flowchart TB
    subgraph BE[BE-QLKT/src]
        direction TB

        ENTRY[index.ts entry]

        subgraph ROUTES[routes]
            R1[auth account personnel unit position]
            R2[annualReward unitAnnualAward tenureMedal contributionMedal]
            R3[commemorativeMedal militaryFlag scientificAchievement adhocAward]
            R4[proposal awards decision profile dashboard]
            R5[notification systemLogs devZone]
            RIDX[index.ts aggregator]
        end

        subgraph MID[middlewares]
            MID1[auth: verifyToken requireRole]
            MID2[validate Joi]
            MID3[auditLog]
            MID4[unitFilter]
            MID5[errorHandler]
        end

        subgraph VAL[validations Joi schemas]
            V1[*.validation.ts each entity]
        end

        subgraph CTRL[controllers]
            C1[*.controller.ts each entity catchAsync ResponseHelper]
        end

        subgraph SVC[services]
            SVC1[entity-level: account auth personnel unit ...]
            subgraph SVCEXT[Extended subfolders]
                SVC2[proposal: core submit approve helpers strategies]
                SVC3[eligibility: chainEligibility hcbvtq congHienMonths serviceYears]
                SVC4[profile: annual contribution tenure]
                SVC5[unitAnnualAward: crud eligibility]
                SVC6[awardBulk: handlers]
                SVC7[excel: import templates]
                SVC8[backup]
                SVC9[notification systemLogs]
            end
        end

        subgraph REP[repositories]
            REP1[*.repository.ts each entity Prisma access]
        end

        subgraph HEL[helpers]
            H1[catchAsync responseHelper paginationHelper]
            H2[auditLog: builders by domain]
            H3[notification: builders by domain]
            H4[award awardValidation excel file]
            H5[serviceYears profileRecalc settings systemLog unit cccd datetime]
        end

        subgraph CONST[constants]
            K1[roles awardSlugs danhHieu chainAwards proposalTypes proposalStatus eligibilityStatus excel]
        end

        subgraph TYPES[types]
            T1[api express.d.ts]
        end

        subgraph MODEL[models]
            MD1[Prisma client singleton]
        end

        subgraph CONFIG[configs]
            CFG1[cors multer rateLimiter]
        end

        subgraph UTIL[utils]
            U1[socketService singleton]
        end

        subgraph SCRIPT[scripts]
            SC1[initSuperAdmin migration helpers]
        end
    end

    ENTRY --> CONFIG
    ENTRY --> ROUTES
    ENTRY --> MID
    ENTRY --> UTIL
    ROUTES --> MID
    ROUTES --> VAL
    ROUTES --> CTRL
    CTRL --> SVC
    SVC --> REP
    SVC --> HEL
    SVC --> CONST
    REP --> MODEL
    MID --> HEL
    MID --> TYPES
    HEL --> CONST
    HEL --> TYPES
    SVC --> UTIL
```

---

## C2.3 — Sơ đồ chi tiết gói: module Đề xuất khen thưởng (Strategy pattern)

```mermaid
flowchart TB
    subgraph PROP[services/proposal]
        Core[core.ts orchestration]
        Submit[submit.ts]
        Approve[approve.ts]
        Helpers[helpers.ts]
        Types[types.ts]

        subgraph APV[approve subfolder]
            APV1[validation.ts]
            APV2[decisionMappings.ts]
            APV3[import.ts]
            APV4[types.ts]
        end

        subgraph STG[strategies]
            ISTG[proposalStrategy.ts INTERFACE]
            REG[index.ts REGISTRY map]
            S1[caNhanHangNamStrategy]
            S2[donViHangNamStrategy]
            S3[nienHanStrategy]
            S4[congHienStrategy]
            S5[hcQkqtStrategy]
            S6[kncStrategy]
            S7[nckhStrategy]
            HELP[singleMedalImporter shared logic for HCQKQT and KNC]
            HELP2[nienHanPayloadHelper]
            HELP3[quanNhanLabel]
        end
    end

    Core --> Submit
    Core --> Approve
    Approve --> APV1
    Approve --> APV2
    Approve --> APV3
    Submit --> REG
    Approve --> REG
    REG --> ISTG
    REG -. registers .-> S1
    REG -. registers .-> S2
    REG -. registers .-> S3
    REG -. registers .-> S4
    REG -. registers .-> S5
    REG -. registers .-> S6
    REG -. registers .-> S7
    S1 -.-> ISTG
    S2 -.-> ISTG
    S3 -.-> ISTG
    S4 -.-> ISTG
    S5 -.-> ISTG
    S6 -.-> ISTG
    S7 -.-> ISTG
    S5 --> HELP
    S6 --> HELP
    S3 --> HELP2
    S1 --> HELP3
    S2 --> HELP3
```

**Điểm bán pattern**: 7 strategy implement chung `ProposalStrategy` interface với 4 method (`buildSubmitPayload`, `validateApprove`, `importInTransaction`, `buildSuccessMessage`). Caller gọi `getStrategy(type).method(...)` thay vì 7 nhánh `if/else`. Thêm loại đề xuất mới = thêm 1 file strategy + register vào REGISTRY.

---

## C2.4 — Sơ đồ chi tiết gói: module Eligibility (chain rule)

```mermaid
flowchart TB
    subgraph CONST[constants]
        CHAIN[chainAwards.constants.ts<br/>PERSONAL_CHAIN_AWARDS<br/>UNIT_CHAIN_AWARDS<br/>cycleYears thresholds]
        DANH[danhHieu.constants.ts<br/>BKBQP CSTDTQ BKTTCP]
        ELIG[eligibilityStatus.constants.ts]
    end

    subgraph CORE[services/eligibility]
        CHAINELIG[chainEligibility.ts<br/>checkChainEligibility CORE]
        HCBVTQ[hcbvtqEligibility.ts]
        CONGHIEN[congHienMonthsAggregator.ts]
        SERVICEYR[serviceYearsEligibility.ts]
        DUPCHECK[personnelDuplicateCheck.ts]
        BULKVAL[annualBulkValidation.ts]
        DECNUM[decisionNumberValidation.ts]
    end

    subgraph PROFILE[services/profile]
        ANNUAL[annual.ts<br/>recalculateAnnualProfile<br/>computeChainContext<br/>computeEligibilityFlags<br/>checkAwardEligibility]
        CONTRIB[contribution.ts]
        TENURE[tenure.ts]
        TYPES[types.ts ChainContext]
    end

    subgraph UNIT[services/unitAnnualAward]
        UNITELIG[eligibility.ts<br/>parallel pattern with annual]
        UNITCRUD[crud.ts]
    end

    CHAIN --> CHAINELIG
    DANH --> CHAINELIG
    CHAINELIG --> ANNUAL
    CHAINELIG --> UNITELIG
    ANNUAL --> CONGHIEN
    ANNUAL --> SERVICEYR
    UNITELIG --> CHAINELIG
    HCBVTQ --> CONTRIB
    SERVICEYR --> TENURE
    BULKVAL --> CHAINELIG
    DECNUM --> CHAINELIG

    classDef coreNode fill:#ffe6e6,stroke:#cc0000,stroke-width:2px
    class CHAINELIG coreNode
    class ANNUAL coreNode
```

**Điểm chuyên sâu**: `chainEligibility.checkChainEligibility()` là **single source of truth** dùng chung cho cả personal (qua `profile/annual.ts`) và unit (qua `unitAnnualAward/eligibility.ts`). Thay vì duplicate logic chuỗi hai chỗ.

---

## Tổng kết

| # | Sơ đồ | Mục đích | Điểm cộng cho thesis |
|---|---|---|---|
| C1.1 | Kiến trúc tổng thể | Cho hội đồng thấy bức tranh hệ thống | Có Socket + Cron, không chỉ REST đơn thuần |
| C1.2 | Layered architecture | Defend lý do tách Repository | Khác MVC mẫu — chuyên sâu hơn |
| C1.3 | Luồng request-response 1 use case | Giải thích middleware chain + Strategy | Chứng minh hiểu sâu request lifecycle |
| C2.1 | Package FE | Mô tả module hóa Next.js | Next.js App Router là khác biệt với CRA mẫu |
| C2.2 | Package BE | Mô tả module hóa Express | Có Repository + Helpers pure tách bạch |
| C2.3 | Strategy pattern proposal | Defend "easy to extend" | 7 loại đề xuất qua REGISTRY |
| C2.4 | Eligibility module | Defend "single source of truth" | chainEligibility dùng chung personal + unit |
