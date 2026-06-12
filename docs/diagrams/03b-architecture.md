# Sơ đồ kiến trúc & module chi tiết

> Mermaid (render qua VS Code Mermaid Preview). Bổ trợ cho sơ đồ gói chuẩn UML ở `03-architecture.md`.

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
        FEComp[AntD + Tailwind CSS]
        FESocket[Socket.IO Client - hooks/useSocket]
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
        PG[(PostgreSQL 23 bảng)]
        FS[/File system: uploads decisions backups sql/]
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
    Services -.node-cron in-process.-> Services
```

**Điểm khác biệt với báo cáo mẫu**: Có thêm Socket.IO Server (realtime), Repository layer (decouple Prisma), `node-cron` in-process cho backup tự động (chạy trong cùng Express process, kích hoạt qua DevZone API thay vì process scheduler riêng), file system tách biệt.

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
            S3[hccsvvStrategy - NIEN_HAN]
            S4[hcbvtqStrategy - CONG_HIEN]
            S5[hcqkqtStrategy]
            S6[kncStrategy]
            S7[nckhStrategy]
            HELP[singleMedalImporter shared logic for HCQKQT and KNC]
            HELP2[nienHanPayloadHelper]
            HELP3[personnelLabel]
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
    ANNUAL --> CHAINELIG
    UNITELIG --> CHAINELIG
    ANNUAL --> CONGHIEN
    ANNUAL --> SERVICEYR
    HCBVTQ --> CONTRIB
    SERVICEYR --> TENURE
    BULKVAL --> CHAINELIG
    DECNUM --> CHAINELIG

    classDef coreNode fill:#ffe6e6,stroke:#cc0000,stroke-width:2px
    class CHAINELIG coreNode
    class ANNUAL coreNode
```

**Điểm chuyên sâu**: `chainEligibility.checkChainEligibility()` là **single source of truth** dùng chung cho cả personal (qua `profile/annual.ts`) và unit (qua `unitAnnualAward/eligibility.ts`). Thay vì duplicate logic chuỗi hai chỗ.
