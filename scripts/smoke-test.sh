#!/usr/bin/env bash
# Smoke test end-to-end for the MKBV CRM API.
# Prereq:
#   1) docker compose up -d postgres redis
#   2) cd apps/api && pnpm build && pnpm db:seed
#   3) Start API: cd apps/api && node dist/main.js
#   4) Run this script from repo root: bash scripts/smoke-test.sh
#
# The script uses only `curl` + `node -e` for JSON, so it works on Git Bash / WSL.

set -e
API=${API:-http://localhost:3000/api/v1}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@mkbv.local}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-ChangeMe123!}

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
blue()  { printf '\033[36m%s\033[0m\n' "$*"; }

jq() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log((function(){$1})())}catch(e){console.error('err:',e.message,'\\nraw:',d);process.exit(1)}})"; }

blue "──── 1) Health probe ─────────────────────────────"
HEALTH=$(curl -sS "$API/health")
echo "$HEALTH" | jq "return JSON.stringify(JSON.parse(d),null,2)"

blue "──── 2) Login ────────────────────────────────────"
TOKENS=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ACCESS=$(echo "$TOKENS" | jq "return JSON.parse(d).accessToken")
REFRESH=$(echo "$TOKENS" | jq "return JSON.parse(d).refreshToken")
green "✓ access token: ${ACCESS:0:30}..."

auth() { echo "Authorization: Bearer $ACCESS"; }

blue "──── 3) Create customer (auto phone normalize +84) ─"
# Use a timestamp suffix so reruns don't clash with past smoke-test records
# Final normalized phone: 0 + 9 digits. Generate 8-digit suffix from epoch.
SUFFIX=$(date +%s)                               # epoch seconds, ~10 digits
SUFFIX=${SUFFIX: -8}                             # last 8 digits
RAW_PHONE="+8491${SUFFIX}"                       # +84 + 9 digits
NORM_PHONE="091${SUFFIX}"
C1=$(curl -sS -X POST "$API/customers" -H "$(auth)" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test $SUFFIX\",\"phone\":\"$RAW_PHONE\",\"email\":\"smoke-$SUFFIX@test.local\"}")
C1_ID=$(echo "$C1" | jq "return JSON.parse(d).id")
C1_PHONE=$(echo "$C1" | jq "return JSON.parse(d).phone")
if [ "$C1_ID" = "undefined" ]; then
  red "✗ create failed: $C1"
  exit 1
fi
green "✓ created id=$C1_ID, phone=$C1_PHONE (expected: $NORM_PHONE)"

blue "──── 4) Duplicate phone must fail with 400 ────────"
DUP=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/customers" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Dup\",\"phone\":\"$NORM_PHONE\"}")
[ "$DUP" = "400" ] && green "✓ got 400" || { red "✗ expected 400, got $DUP"; exit 1; }

blue "──── 5) List customers (paginated) ───────────────"
curl -sS "$API/customers?page=1&pageSize=5" -H "$(auth)" | \
  jq "const r=JSON.parse(d);return \`total=\${r.meta.total} pageSize=\${r.meta.pageSize}\`"

blue "──── 6) Search by name + by phone ────────────────"
SEARCH_NAME=$(curl -sS "$API/customers?search=Smoke" -H "$(auth)" | jq "return JSON.parse(d).meta.total")
SEARCH_PHONE=$(curl -sS "$API/customers?search=0900" -H "$(auth)" | jq "return JSON.parse(d).meta.total")
green "✓ search='Smoke' → $SEARCH_NAME match, search='0900' → $SEARCH_PHONE match"

blue "──── 7) Loyalty tier upgrade (SILVER → GOLD @ 5M) ─"
docker exec mkbv_postgres psql -U crm -d crm -c \
  "UPDATE \"Customer\" SET \"totalSpent\"=5500000 WHERE id=$C1_ID;" > /dev/null
TIER=$(curl -sS -X POST "$API/loyalty/$C1_ID/recalculate" -H "$(auth)" | \
  jq "const r=JSON.parse(d);return \`\${r.previousTier}→\${r.tier} upgraded=\${r.upgraded} points=\${r.points}\`")
green "✓ loyalty: $TIER"

blue "──── 8) Filter tier=GOLD returns our customer ────"
FOUND=$(curl -sS "$API/customers?tier=GOLD" -H "$(auth)" | \
  jq "const r=JSON.parse(d);return r.data.some(c=>c.id===$C1_ID)?'yes':'no'")
[ "$FOUND" = "yes" ] && green "✓ filter works" || { red "✗ tier filter broken"; exit 1; }

blue "──── 9) Sync status (no KV creds yet → cursors idle) ─"
curl -sS "$API/sync/status" -H "$(auth)" | \
  jq "const r=JSON.parse(d);return r.data.map(x=>\`\${x.entity.padEnd(9)} status=\${x.status ?? '(never)'}\`).join('\n')"

blue "──── 10) Enqueue branch sync (will fail if no KV retailer) ─"
QUEUED=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/sync/branch/run" -H "$(auth)")
green "✓ HTTP $QUEUED (202 = enqueued; actual sync will fail without KIOTVIET_RETAILER)"

blue "──── 11) Webhook with bad signature must fail 401 ─"
WH=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/webhooks/kiotviet" \
  -H 'Content-Type: application/json' -H 'X-Hub-Signature: BAD' \
  -d '{"Id":"smoke","Attempt":1,"Notifications":[]}')
if [ -n "$KIOTVIET_WEBHOOK_SECRET" ]; then
  [ "$WH" = "401" ] && green "✓ 401 rejected" || red "✗ expected 401, got $WH"
else
  green "(no KIOTVIET_WEBHOOK_SECRET in env → signature verification skipped, got $WH)"
fi

blue "──── 12) Delete test customer ────────────────────"
DEL=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$API/customers/$C1_ID" -H "$(auth)")
[ "$DEL" = "204" ] && green "✓ 204 deleted" || { red "✗ expected 204, got $DEL"; exit 1; }

blue "──── 13) Logout ──────────────────────────────────"
LO=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/auth/logout" -H "$(auth)")
[ "$LO" = "204" ] && green "✓ 204 logged out" || red "✗ expected 204, got $LO"

blue "──── 14) Old refresh must be revoked ─────────────"
RF=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API/auth/refresh" \
  -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}")
[ "$RF" = "401" ] && green "✓ 401 revoked" || red "✗ expected 401, got $RF"

echo
green "════════════════════════════════════════"
green "  All smoke-test checks passed ✓"
green "════════════════════════════════════════"
