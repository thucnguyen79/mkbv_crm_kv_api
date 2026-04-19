# Deployment — MKBV CRM

## 1. VPS yêu cầu

| Resource | Min | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Ports | 80, 443 (Caddy) | + 22 (SSH) |

Docker Engine ≥ 24, Docker Compose ≥ 2.20.

## 2. Chuẩn bị

### 2.1 DNS

Trỏ 2 record A về IP VPS:
```
crm.your-domain.com        → 1.2.3.4    # web dashboard
api.crm.your-domain.com    → 1.2.3.4    # backend
```

### 2.2 `.env` production

Copy từ `.env.example` → `.env`, chỉnh:

```bash
NODE_ENV=production
LOG_LEVEL=info

# Domains (trỏ về IP VPS)
API_DOMAIN=api.crm.your-domain.com
WEB_DOMAIN=crm.your-domain.com
ACME_EMAIL=ops@your-domain.com
CORS_ORIGINS=https://crm.your-domain.com

# Database — sinh password mạnh
POSTGRES_PASSWORD=<openssl rand -hex 24>
DATABASE_URL=postgresql://crm:<password>@postgres:5432/crm?schema=public

# JWT — mỗi secret ≥ 32 ký tự ngẫu nhiên
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
NEXTAUTH_SECRET=<openssl rand -base64 48>

# KiotViet (lấy từ dashboard kiotviet)
KIOTVIET_RETAILER=<retailer-name>
KIOTVIET_CLIENT_ID=<uuid>
KIOTVIET_CLIENT_SECRET=<secret>
KIOTVIET_WEBHOOK_SECRET=<openssl rand -hex 32>

# Admin mặc định — sẽ tạo khi seed, đổi password sau
SEED_ADMIN_EMAIL=admin@your-domain.com
SEED_ADMIN_PASSWORD=<strong-password>
```

## 3. Triển khai

```bash
# Clone
git clone <repo> /opt/mkbv-crm
cd /opt/mkbv-crm
cp .env.example .env   # rồi edit như trên

# Build + start
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Migrate + seed
docker compose exec api npx prisma migrate deploy
docker compose exec api node ./node_modules/ts-node/dist/bin.js prisma/seed.ts
# (hoặc nếu image runner không có ts-node, build seed riêng trước deploy)

# Log
docker compose logs -f api
```

Caddy sẽ tự xin Let's Encrypt cert trong ~30 giây sau request đầu tiên tới domain.

## 4. Xác minh

```bash
# Liveness
curl https://api.crm.your-domain.com/api/v1/health

# Readiness (DB + Redis)
curl https://api.crm.your-domain.com/api/v1/health/ready

# Metrics (chỉ từ internal — bên ngoài sẽ 403)
docker compose exec caddy wget -qO- http://api:3000/api/v1/metrics | head

# Swagger docs (chỉ khi NODE_ENV != production; production đóng mặc định)
# Nếu cần, tạm mở: set NODE_ENV=development, restart, chỉ cho IP văn phòng
```

Web: `https://crm.your-domain.com` → login `admin@your-domain.com` / `SEED_ADMIN_PASSWORD`. **Đổi password ngay** (qua `UPDATE "User" SET "passwordHash"=...` — chưa có UI đổi password).

## 5. Đăng ký webhook KiotViet

Trên KiotViet dashboard → Cài đặt → Webhook → thêm:
```
URL: https://api.crm.your-domain.com/api/v1/webhooks/kiotviet
Event: customer.update, order.update, invoice.update, product.update
Secret: <giá trị KIOTVIET_WEBHOOK_SECRET trong .env>
```

Test: sửa 1 customer ở KiotViet → xem log:
```bash
docker compose logs api | grep webhook
```

## 6. Backup

Container `db_backup` chạy cron `0 3 * * *` (3h sáng UTC), dump `pg_dump | gzip` vào volume `backups`.

Rotate tự động sau 14 ngày (`BACKUP_RETENTION_DAYS`).

### Restore test (định kỳ)
```bash
# Copy dump ra host
docker compose cp db_backup:/backups/crm-<timestamp>.sql.gz ./restore-test.sql.gz

# Restore vào DB phụ để test (không đụng prod)
docker run --rm -v ./restore-test.sql.gz:/dump.sql.gz postgres:16-alpine \
  sh -c 'gunzip -c /dump.sql.gz | psql -h <test-host> -U crm -d crm_restore_test'
```

### Copy ra S3 (khuyến nghị)
Thêm 1 service `s3-sync` chạy `aws s3 sync /backups s3://your-bucket/mkbv-backups/` daily sau backup. Hoặc dùng `rclone` cho Google Drive / Dropbox.

## 7. Monitoring (optional)

Prometheus scrape endpoint `http://api:3000/api/v1/metrics`. Chạy Prometheus + Grafana riêng (compose hoặc ngoài).

Metric quan trọng theo dõi:
- `mkbv_message_failed_24h` — alert khi > 10
- `mkbv_sync_failed_entities` — alert khi > 0 quá 30 phút
- `mkbv_low_stock_records` — dashboard-only
- `nodejs_eventloop_lag_seconds` (built-in) — alert khi p95 > 0.1s

## 8. Upgrade / rollback

```bash
cd /opt/mkbv-crm
git pull

# Build image mới
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Migrate trước — có thể fail, chưa ảnh hưởng runtime
docker compose run --rm api npx prisma migrate deploy

# Swap container
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate api web

# Smoke test
curl https://api.crm.your-domain.com/api/v1/health/ready
```

**Rollback**: `git checkout <previous-tag>` + rebuild + `migrate resolve --rolled-back`. Luôn backup DB trước upgrade.

## 9. Scale giới hạn

1 VPS 4 vCPU / 8GB theo architecture hiện tại xử lý tốt ~50 chi nhánh, ~500k customer, ~2M message/tháng. Nếu vượt:

- **Tăng API replicas**: BullMQ worker chạy cùng container API → tách `docker compose scale api=3`, nhưng chú ý: `SyncScheduler` (cron) **chỉ nên chạy 1 instance** → tách role `api` và `worker` (TODO: flag `SCHEDULER_ENABLED` cho từng instance)
- **Redis persistent**: hiện dùng AOF; dữ liệu chỉ là token cache + BullMQ queue → có thể mất mà không sao
- **PostgreSQL HA**: 1 primary + 1 read replica đủ cho tối ưu đọc; write vẫn dồn về primary
