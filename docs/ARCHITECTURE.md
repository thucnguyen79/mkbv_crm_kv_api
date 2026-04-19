# Architecture — MKBV CRM & Messaging

## 1. Bối cảnh

Chuỗi phòng khám mắt / cửa hàng kính dùng **KiotViet** làm POS. Hệ thống này bổ sung:
- Kho dữ liệu khách hàng tập trung, phân hạng thành viên
- Kênh messaging ZNS/SMS chủ động (với fallback)
- Automation chăm sóc khách hàng (inactive, birthday, tier-upgrade, segment tuỳ chỉnh)
- Quản lý tồn kho nâng cao (velocity, reorder point, dead stock, transfer suggestion)

Quy mô: 50 chi nhánh, hàng chục nghìn khách hàng.

## 2. Stack

| Layer | Công nghệ |
|---|---|
| Backend | NestJS 10 (monolith, modules) |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache / Queue | Redis 7 + BullMQ |
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui + React Query |
| Auth | JWT access (15m) + refresh (7d, rotation, Redis blacklist) |
| Deploy | Docker Compose trên VPS + Caddy reverse proxy auto-TLS |

## 3. Module map

```
apps/api/src/
├── auth/           JWT + RBAC (ADMIN / MANAGER / STAFF)
├── common/         Prisma, Redis, pagination, filters
├── config/         AppConfig typed + joi validation
├── integration/    KiotViet client, sync engine, webhook
├── customer/       CRUD khách hàng, dedupe phone
├── order/          Đọc đơn hàng (ORDER + INVOICE)
├── loyalty/        Tính điểm + tier (6 bậc: GUEST → PLATINUM)
├── messaging/      Queue gửi ZNS/SMS (+ slot ZALO_OA), retry + fallback
├── automation/     Rule engine + Campaign + CampaignRun (approval workflow)
├── inventory/      Product ext, Stock, Variant group, Attribute, Image, Velocity, Notification
└── health/         /health /health/ready /metrics (Prometheus)
```

## 4. Luồng dữ liệu chính

### 4.1 Sync từ KiotViet
```
┌────────────┐    cron 5'      ┌─────────────┐  BullMQ  ┌──────────────┐
│  Scheduler ├─enqueuePipeline→│   sync Q    ├────────→ │  Processor   │
└────────────┘                 └─────────────┘          └──────┬───────┘
     ▲                                                         │
     │webhook                                                  │
┌────┴────────┐  HMAC verify   ┌─────────────┐                 ▼
│   KiotViet  ├───────────────→│  Webhook    │          ┌───────────────┐
└─────────────┘                │ Controller  │          │ Sync Strategy │
                               └─────────────┘          │  (branch,     │
                                                        │  customer,    │
                                                        │  order, ...)  │
                                                        └──────┬────────┘
                                                               ↓
                                                         PostgreSQL
                                                         ↓  emit
                                                   `order.synced` event
                                                         ↓
                                                   Automation TRIGGERED
                                                   campaigns run
```

**Entity sync order (dependency):** branch → user → category → product → customer → order → invoice.

Dedupe customer theo `phone` (normalize VN): `+84X / 84X → 0X`, 9-11 digits.

### 4.2 Messaging flow
```
AutomationService.runCampaign → match rule → snapshot → CampaignRun
    ├─ skip-approval (RECURRING auto / TRIGGERED) → executeRun ngay
    └─ PENDING_APPROVAL → MANAGER approve → executeRun

executeRun:
  for each matched customer:
    messaging.enqueue(template, variables) → BullMQ messaging Q → MessageLog QUEUED
                                                                        ↓
                                            MessagingProcessor (concurrency 5)
                                                  ↓               ↓
                                              ZNS send       SMS send
                                               success          ↓ (on ProviderFallbackError)
                                                ↓            fallback
                                              SENT              ↓
                                                          new MessageLog SMS
```

### 4.3 Inventory & velocity
```
Product sync pull `inventories[]` from KiotViet → upsert ProductStock per CN.
  `lastStockIncreaseAt` update ONLY khi onHand tăng → aging chính xác.

Cron daily 2am (InventoryVelocityScheduler):
  SELECT SUM(qty) FROM OrderItem × Order
  GROUP BY (productId, branchId)
  WHERE purchasedAt > now - 30d
  → cập nhật velocity30d, reorderPoint, velocityTag (FAST / NORMAL / SLOW / DEAD)

Cron daily 8am (LowStockScheduler):
  SELECT ProductStock WHERE onHand < product.minStock
  → tạo Notification targetRole=MANAGER (dedupe 24h)
```

## 5. Authentication & authorization

- **Access token**: JWT HS256, 15 phút, chứa `{ sub, email, role }`
- **Refresh token**: JWT, 7 ngày, có `jti` lưu Redis → rotation khi refresh
- **Logout** xoá toàn bộ refresh key theo userId (`auth:refresh:<userId>:*`)
- **Roles**:
  - `ADMIN` — full quyền
  - `MANAGER` — duyệt campaign run, edit product/variant/attribute
  - `STAFF` — read-only + tạo campaign run + gửi tin

Frontend dùng NextAuth credentials provider, proactive refresh 30s trước khi token hết hạn trong JWT callback.

## 6. Database schema highlights

- `Customer.phone` UNIQUE (dedupe key), `Customer.externalId` UNIQUE (KiotViet id)
- `Order.raw` JSONB — snapshot payload KiotViet, giữ để re-process nếu cần
- `MessageLog.payload` JSONB — lưu `body` đã bind + variables → replay retry không cần template lookup
- `ProductStock` UNIQUE (productId, branchId)
- `Product.tags[]` với GIN index, `attributes` JSONB filter qua path
- `CampaignRun.snapshot` JSONB — danh sách customer match tại thời điểm trigger, ổn định cho approval

## 7. Integration points

| Hệ thống ngoài | Protocol | Ghi chú |
|---|---|---|
| KiotViet Public API | OAuth2 + REST | Token TTL ~24h, cache Redis, in-flight dedupe |
| KiotViet webhook | POST HMAC-SHA256 | Verify `x-hub-signature`, enqueue sync async, trả 200 <5s |
| Zalo ZNS provider | Plug-in qua `MessageProvider` interface | Stub cho dev, swap adapter thật khi có credential |
| SMS provider (ESMS/Stringee/Incom) | Plug-in qua `MessageProvider` | Stub + fallback target cho ZNS fail |
| Zalo OA (future) | Slot sẵn trong enum + provider throws `NotImplementedException` | |

## 8. Quan sát

- **Logging**: pino JSON, redact `authorization`, `password*`, `*Token`
- **Metrics**: `/metrics` (Prometheus) — default process metrics + app gauges (customer, order, queue, failed sync, low stock)
- **Health**: `/api/v1/health` (liveness), `/api/v1/health/ready` (DB + Redis check)
- **Tracing**: chưa (T8+: OpenTelemetry nếu cần)

## 9. Trade-offs & điểm cần biết

1. **Monolith chọn có chủ đích** — 8 tuần 1 team nhỏ không đủ ngân sách cho microservice + K8s
2. **Poll + webhook kết hợp** — webhook miss event thỉnh thoảng, poll là safety net 5 phút
3. **Messaging là ngu** — policy (cooldown, anti-spam) ở Automation layer, messaging chỉ dispatch
4. **Snapshot approval** — UX ổn định cho manager; nếu cần tươi, bật `Campaign.refreshOnApprove=true`
5. **Aging không lô (FIFO)** — track `lastStockIncreaseAt` là approximation đủ dùng; lô chính xác cần nhập phiếu thủ công
6. **Không durable TRIGGERED** — EventEmitter2 in-process; mất event khi crash giữa chừng, polling sync kế tiếp sẽ match lại → không mất data, chỉ trễ
