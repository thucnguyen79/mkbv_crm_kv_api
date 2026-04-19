#!/usr/bin/env bash
# init-poc.sh — sinh .env cho POC trên local server (mkmsg.ddns.net:60080)
# HTTP plain, no TLS. Khác init-secrets.sh ở chỗ:
#  - PUBLIC_HOST + PUBLIC_PORT thay cho domain
#  - NEXTAUTH_URL http:// (không https://)
#  - Không có ACME_EMAIL
set -euo pipefail

ENV_FILE=".env"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

if [[ -f "$ENV_FILE" && $FORCE -eq 0 ]]; then
  echo "⚠  .env đã tồn tại. Dùng --force để ghi đè."
  exit 1
fi

PUBLIC_HOST="${PUBLIC_HOST:-mkmsg.ddns.net}"
PUBLIC_PORT="${PUBLIC_PORT:-60080}"

gen() { openssl rand -base64 48 | tr -d '\n='; }

POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(gen)
JWT_REFRESH_SECRET=$(gen)
NEXTAUTH_SECRET=$(gen)
KIOTVIET_WEBHOOK_SECRET=$(openssl rand -hex 32)
SEED_ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-16)

cat > "$ENV_FILE" <<EOF
# === POC config — HTTP plain ===
NODE_ENV=production
API_PORT=3000
WEB_PORT=3001
LOG_LEVEL=info

# === Public access ===
PUBLIC_HOST=${PUBLIC_HOST}
PUBLIC_PORT=${PUBLIC_PORT}

# === Postgres (internal docker network — không expose ra host) ===
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=crm
POSTGRES_USER=crm
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://crm:${POSTGRES_PASSWORD}@postgres:5432/crm?schema=public

# === Redis ===
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# === JWT ===
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# === NextAuth (cookie không secure vì HTTP plain) ===
NEXTAUTH_URL=http://${PUBLIC_HOST}:${PUBLIC_PORT}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXT_PUBLIC_API_URL=http://${PUBLIC_HOST}:${PUBLIC_PORT}/api/v1

# === KiotViet — admin nhập qua UI Cấu hình ===
KIOTVIET_RETAILER=
KIOTVIET_CLIENT_ID=
KIOTVIET_CLIENT_SECRET=
KIOTVIET_BASE_URL=https://public.kiotapi.com
KIOTVIET_TOKEN_URL=https://id.kiotviet.vn/connect/token
KIOTVIET_SCOPE=PublicApi.Access
KIOTVIET_WEBHOOK_SECRET=${KIOTVIET_WEBHOOK_SECRET}

# === Sync ===
SYNC_ENABLED=true
SYNC_CRON=*/5 * * * *

# === Messaging stub ===
MESSAGING_DEFAULT_PROVIDER=stub
ZNS_PROVIDER=stub
SMS_PROVIDER=stub

# === Loyalty ===
LOYALTY_POINT_PER_VND=10000
LOYALTY_TIER_MEMBER=300
LOYALTY_TIER_SILVER=1000
LOYALTY_TIER_TITAN=2500
LOYALTY_TIER_GOLD=5000
LOYALTY_TIER_PLATINUM=10000

# === Inventory ===
UPLOAD_DIR=/app/uploads
INVENTORY_LEAD_TIME_DAYS=7
INVENTORY_SAFETY_DAYS=3
INVENTORY_FAST_MOVER_DAILY=1
INVENTORY_SLOW_MOVER_DAILY=0.1
INVENTORY_DEAD_AGING_DAYS=60
INVENTORY_VELOCITY_WINDOW_DAYS=30
INVENTORY_VELOCITY_CRON=0 2 * * *
INVENTORY_LOW_STOCK_CRON=0 8 * * *

# === Seed admin ===
SEED_ADMIN_EMAIL=admin@mkbv.local
SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}

# === GHCR image tag ===
IMAGE_TAG=latest
GHCR_REPO=thucnguyen79/mkbv_crm_kv_api
EOF

chmod 600 "$ENV_FILE"

cat <<INFO

═══════════════════════════════════════════════════════════════
  ✓ Đã tạo .env cho POC
═══════════════════════════════════════════════════════════════

📝 GHI LẠI THÔNG TIN ĐĂNG NHẬP (chỉ hiện 1 lần):

   URL:              http://${PUBLIC_HOST}:${PUBLIC_PORT}
   Admin email:      admin@mkbv.local
   Admin password:   ${SEED_ADMIN_PASSWORD}

═══════════════════════════════════════════════════════════════
INFO
