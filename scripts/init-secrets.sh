#!/usr/bin/env bash
# init-secrets.sh — sinh .env cho prod với secret mạnh
# Chạy 1 LẦN trên server. Nếu .env đã tồn tại → exit (an toàn, tránh ghi đè).
#
# Use: ./scripts/init-secrets.sh
#       hoặc: ./scripts/init-secrets.sh --force (ghi đè, dùng khi rotate secret)
set -euo pipefail

ENV_FILE=".env"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

if [[ -f "$ENV_FILE" && $FORCE -eq 0 ]]; then
  echo "⚠  .env đã tồn tại. Dùng --force để ghi đè (mọi user phải login lại)."
  exit 1
fi

# Sinh secret mạnh — base64, 48 byte = 64 ký tự
gen() { openssl rand -base64 48 | tr -d '\n='; }

POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(gen)
JWT_REFRESH_SECRET=$(gen)
NEXTAUTH_SECRET=$(gen)
KIOTVIET_WEBHOOK_SECRET=$(openssl rand -hex 32)
SEED_ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-16)

# Domain — bạn sửa sau khi mua domain thật.
# Trong lần đầu test, dùng IP nip.io: <ip>.nip.io tự resolve về IP đó.
PUBLIC_IP=$(curl -s -m 5 ifconfig.me 2>/dev/null || echo "127.0.0.1")
DEFAULT_API_DOMAIN="api-${PUBLIC_IP}.nip.io"
DEFAULT_WEB_DOMAIN="${PUBLIC_IP}.nip.io"

cat > "$ENV_FILE" <<EOF
# === RUNTIME ===
NODE_ENV=production
API_PORT=3000
WEB_PORT=3001
LOG_LEVEL=info

# === DOMAINS ===
# Đổi sau khi có domain thật + DNS record A trỏ về IP VM
API_DOMAIN=${DEFAULT_API_DOMAIN}
WEB_DOMAIN=${DEFAULT_WEB_DOMAIN}
ACME_EMAIL=ops@example.com
CORS_ORIGINS=https://${DEFAULT_WEB_DOMAIN}

# === POSTGRES ===
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=crm
POSTGRES_USER=crm
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://crm:${POSTGRES_PASSWORD}@postgres:5432/crm?schema=public

# === REDIS ===
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# === JWT ===
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# === NEXTAUTH (web) ===
NEXTAUTH_URL=https://${DEFAULT_WEB_DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXT_PUBLIC_API_URL=https://${DEFAULT_API_DOMAIN}/api/v1

# === KIOTVIET ===
# Để trống — admin sẽ nhập qua UI Cấu hình sau khi login lần đầu
KIOTVIET_RETAILER=
KIOTVIET_CLIENT_ID=
KIOTVIET_CLIENT_SECRET=
KIOTVIET_BASE_URL=https://public.kiotapi.com
KIOTVIET_TOKEN_URL=https://id.kiotviet.vn/connect/token
KIOTVIET_SCOPE=PublicApi.Access
KIOTVIET_WEBHOOK_SECRET=${KIOTVIET_WEBHOOK_SECRET}

# === SYNC ===
SYNC_ENABLED=true
SYNC_CRON=*/5 * * * *

# === MESSAGING ===
MESSAGING_DEFAULT_PROVIDER=stub
ZNS_PROVIDER=stub
SMS_PROVIDER=stub

# === LOYALTY ===
LOYALTY_POINT_PER_VND=10000
LOYALTY_TIER_MEMBER=300
LOYALTY_TIER_SILVER=1000
LOYALTY_TIER_TITAN=2500
LOYALTY_TIER_GOLD=5000
LOYALTY_TIER_PLATINUM=10000

# === INVENTORY ===
UPLOAD_DIR=/app/uploads
INVENTORY_LEAD_TIME_DAYS=7
INVENTORY_SAFETY_DAYS=3
INVENTORY_FAST_MOVER_DAILY=1
INVENTORY_SLOW_MOVER_DAILY=0.1
INVENTORY_DEAD_AGING_DAYS=60
INVENTORY_VELOCITY_WINDOW_DAYS=30
INVENTORY_VELOCITY_CRON=0 2 * * *
INVENTORY_LOW_STOCK_CRON=0 8 * * *

# === SEED ADMIN — đổi sau khi login lần đầu ===
SEED_ADMIN_EMAIL=admin@mkbv.local
SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}
EOF

chmod 600 "$ENV_FILE"

echo "✓ Đã tạo .env với secret strong"
echo ""
echo "📝 GHI LẠI THÔNG TIN SAU (chỉ hiện 1 lần):"
echo "   ─────────────────────────────────────────"
echo "   Admin email:      admin@mkbv.local"
echo "   Admin password:   ${SEED_ADMIN_PASSWORD}"
echo "   Web domain:       https://${DEFAULT_WEB_DOMAIN}"
echo "   API domain:       https://${DEFAULT_API_DOMAIN}"
echo "   ─────────────────────────────────────────"
echo ""
echo "Bước tiếp theo:"
echo "  1. (optional) Đổi API_DOMAIN, WEB_DOMAIN, ACME_EMAIL trong .env nếu có domain thật"
echo "  2. docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
echo "  3. docker compose exec api npx prisma migrate deploy"
echo "  4. docker compose exec api node -e \"require('./prisma/seed.js')\" || dùng image có ts-node"
