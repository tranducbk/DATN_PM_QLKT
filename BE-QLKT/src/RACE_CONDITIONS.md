# Race Condition Handling — PM QLKT

Tổng hợp các điểm xử lý concurrent/race condition trong hệ thống. File này
là tài liệu tham khảo — code thực ở các vị trí được trỏ tới.

## 1. APPROVE PROPOSAL — Optimistic Locking

**Vị trí:** `services/proposal/approve/import.ts` (trong `runImportTransaction`)

**Vấn đề:** 2 ADMIN cùng bấm "Phê duyệt" 1 đề xuất → double import + duplicate
award records.

**Giải pháp:**
```ts
const updateResult = await prismaTx.bangDeXuat.updateMany({
  where: { id: proposalId, status: PROPOSAL_STATUS.PENDING },
  // ─── compare-and-swap: chỉ update nếu status VẪN là PENDING ───
  data: updateData,
});
if (updateResult.count === 0) {
  throw new ValidationError('Đề xuất đã bị thay đổi bởi người khác...');
}
```

- Admin đầu tiên: `count=1` → transaction commit.
- Admin thứ hai: status đã thành APPROVED → `count=0` → throw → rollback toàn bộ.
- KHÔNG dùng `update({where: {id}})` vì sẽ thành công cả khi status đổi.

## 2. REFRESH TOKEN — Single-Flight Pattern (FE)

**Vị trí:** `FE-QLKT/src/lib/axiosInstance.ts`

**Vấn đề:** Nhiều request đồng thời cùng nhận 401 → refresh 3-5 lần lãng phí
+ rotation token gây mismatch.

**Giải pháp:**
```ts
let isRefreshing = false;
let failedQueue = [];

// Request đầu tiên trigger refresh
// Các request sau enqueue + chờ token mới qua promise
if (isRefreshing) {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  }).then(token => /* retry với token mới */);
}
isRefreshing = true;
// ... gọi /refresh
processQueue(null, newToken);  // unblock tất cả request chờ
```

## 3. REFRESH TOKEN ROTATION — Reuse Detection (BE)

**Vị trí:** `services/auth.service.ts:refreshAccessToken`

**Vấn đề:** Refresh token sống 7 ngày → nếu bị steal, attacker dùng được lâu.

**Giải pháp:**
- Mỗi lần refresh → cấp pair MỚI + ghi đè token cũ trong DB.
- Lần dùng lại refresh cũ → mismatch DB → reject.
- Nếu user thật + attacker cùng có refresh → ai dùng trước thắng, user còn lại
  phải re-login = **tín hiệu phát hiện hack**.

## 4. SO_LUONG COUNTER — Atomic Increment

**Vị trí:** `services/personnel/unitCount.ts`

**Vấn đề:** Lost update khi 2 admin cùng thêm quân nhân vào 1 đơn vị.

**Giải pháp:** Prisma `{ increment: 1 }` → SQL `SET so_luong = so_luong + 1`
→ DB row-level lock đảm bảo atomic.

## 5. LOGIN — Force Logout Cũ

**Vị trí:** `services/auth.service.ts:login`

**Vấn đề:** Single-session policy — không cho dùng 1 tài khoản trên 2 device.

**Giải pháp:**
```ts
// Trước khi update refresh token mới:
emitToUser(account.id, 'force_logout', {...});
await accountRepository.update(account.id, { refreshToken: newToken });
```

- Session cũ nhận socket event → tự logout.
- Refresh token cũ trong DB bị ghi đè → session cũ không refresh được.

## 6. PROPOSAL SUBMIT — Duplicate Detection

**Vị trí:** `services/proposal/validation.ts:checkDuplicateAward`

**Vấn đề:** 2 manager cùng submit đề xuất trùng key (cùng quân nhân, năm,
danh hiệu).

**Giải pháp:**
- Check duplicate trước insert.
- Có race window: cả 2 check thấy "không trùng" → cả 2 insert.
- **Mitigation:** unique constraint ở DB level (vd: `DanhHieuHangNam` có
  unique `(quan_nhan_id, nam)`) → 1 trong 2 insert sẽ throw P2002.
- Service bắt P2002 → return validation error.

## 7. DECISION FILE SYNC — Idempotent Insert

**Vị trí:** `services/proposal/approve/decisionMappings.ts:syncDecisionFiles`

**Vấn đề:** 2 đề xuất cùng dùng 1 số quyết định → sync 2 lần → unique violation.

**Giải pháp:**
- `upsert({where: {so_quyet_dinh}, create, update: {}})` — create-if-absent
  atomic ở mức DB: nếu đề xuất song song đã tạo, nhánh update no-op thay vì
  throw P2002. FK của insert award sau đó vẫn trỏ được vào row.
- Lazy file_path: chỉ UPDATE khi row đã có nhưng `file_path` null (không ghi
  đè path sẵn có).
- Best-effort: try/catch giữ lại cho lỗi transient khác → log + skip, không throw.

## 8. PROPOSAL DUPLICATE CHECK — Self-Match Bug (đã fix)

**Vị trí:** `services/proposal/validation.ts:checkDuplicateUnitAward`

**Bug từng có:** Duplicate check query PENDING proposals nhưng KHÔNG exclude
chính proposal đang duyệt → đề xuất match chính nó → throw sai.

**Fix:** Thêm param `excludeProposalId` + `where.id: { not: proposalId }`.

**Test lock-in:** `tests/approve/unit-annual.test.ts:381` — verify
`bangDeXuat.findMany` được gọi với `id: { not }` clause.

## 9. PROFILE RECALC — Fire-and-Forget

**Vị trí:** `helpers/profileRecalcHelper.ts:safeRecalculateAnnualProfile`

**Vấn đề:** Recalc có thể fail (race, transient error) — không được block
business operation.

**Giải pháp:** Catch silent + log. Recalc lại được trigger manual qua DevZone
nếu cần.

## 10. SOCKET RECONNECT — Reconnect with Refreshed Token

**Vị trí:** `FE-QLKT/src/hooks/useSocket.ts`

**Vấn đề:** Socket disconnect khi access token expire mid-session.

**Giải pháp:**
- Lắng nghe `connect_error` với code `TOKEN_EXPIRED`.
- Tự gọi /refresh để xin token mới.
- Update `socket.auth.token` + reconnect.
- Emit `tokenRefreshed` event cho axios cùng sync.

## 11. AXIOS + SOCKET TOKEN SYNC — Event Bus

**Vấn đề:** Axios refresh token TRƯỚC socket → 2 channel không đồng bộ token.

**Giải pháp:**
- Axios sau khi refresh: `window.dispatchEvent('tokenRefreshed', {token})`.
- Socket listener: nhận event → update `socket.auth.token` cho lần connect kế.

## 12. NCKH SCIENTIFIC ACHIEVEMENT — Composite Unique

**Vị trí:** `services/proposal/strategies/nckhStrategy.ts`

**Vấn đề:** 2 đề xuất NCKH trùng (personnel_id, năm, mô tả).

**Giải pháp:** Check duplicate qua `(quan_nhan_id, nam, mo_ta)` composite key
trong `approve/validation.ts:collectNckhDuplicates`. Bảng
`ScientificAchievement` không có unique constraint trên 3 field này
(chỉ ở app layer) — đây là điểm có thể siết thêm bằng DB unique.

## 13. BULK APPROVE — All-or-Nothing Transaction

**Vị trí:** `services/proposal/approve/import.ts`

**Vấn đề:** 1 đề xuất có 100 items → import 50 thành công, item 51 lỗi → DB
mất tính nhất quán.

**Giải pháp:** Wrap toàn bộ trong `prisma.$transaction` với timeout 60s.
Bất kỳ throw nào → rollback tất cả 50 inserts trước đó.

## 14. FILE UPLOAD — Collision-Free Filename

**Vị trí:** `services/proposal/attachedFiles.ts`

**Vấn đề:** 2 user cùng upload "QuyetDinh.pdf" → ghi đè.

**Giải pháp:** Prefix `<timestamp>_<uuid8>_` → xác suất trùng ≈ 0. KHÔNG dùng
`fs.existsSync` + `fs.writeFile` vì non-atomic.

---

## NHỮNG ĐIỂM CHƯA TỐI ƯU

1. **NCKH unique constraint chưa ở DB level** — nên thêm composite unique.
2. **Profile recalc** chạy nhiều lần khi bulk approve → có thể debounce/queue.
3. **Decision sync** đã dùng `upsert` (atomic create-if-absent) — không còn
   race P2002 ở bước tạo; nhánh lazy file_path UPDATE vẫn last-write-wins.
4. **Backup** dùng `Promise.all` load full DB vào RAM → OOM với DB lớn.
5. **Excel import** parse toàn bộ vào RAM, không streaming.
