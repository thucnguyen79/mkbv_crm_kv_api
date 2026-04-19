#!/usr/bin/env bash
# oracle-vm-setup.sh
# Chạy 1 LẦN trên Oracle Ampere A1 VM Ubuntu 22.04 sau khi SSH vào.
# Cài Docker, mở firewall, clone repo, sinh .env, kéo ảnh, start stack.
set -euo pipefail

if [[ "$EUID" -eq 0 ]]; then
  echo "⚠  Đừng chạy bằng root. Tạo user thường rồi sudo."
  exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/thucnguyen79/mkbv_crm_kv_api.git}"
INSTALL_DIR="/opt/mkbv-crm"
GHCR_USER="${GHCR_USER:-thucnguyen79}"

echo "═══════════════════════════════════════════════════════"
echo "  MKBV CRM — Oracle VM setup"
echo "  Repo:       $REPO_URL"
echo "  Install to: $INSTALL_DIR"
echo "═══════════════════════════════════════════════════════"

# 1. System update + base tools
echo "[1/7] System update..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git ufw openssl ca-certificates

# 2. Firewall — chỉ mở 22, 80, 443
echo "[2/7] Firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 3. Docker
if ! command -v docker &>/dev/null; then
  echo "[3/7] Cài Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "⚠  Vừa add user $USER vào group docker. Logout + login lại sau khi script xong."
else
  echo "[3/7] Docker đã có: $(docker --version)"
fi

# 4. Iptables fix cho Oracle (chặn FORWARD chain default)
# Oracle Ubuntu image có iptables rules drop FORWARD → docker container không network ngoài được
echo "[4/7] Iptables forward chain..."
if ! sudo iptables -L FORWARD -n | head -1 | grep -qi accept; then
  sudo iptables -P FORWARD ACCEPT
  sudo apt-get install -y -qq iptables-persistent
  sudo netfilter-persistent save
fi

# 5. Clone repo
echo "[5/7] Clone repo..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$USER":"$USER" "$INSTALL_DIR"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# 6. Sinh .env nếu chưa có
echo "[6/7] Sinh .env..."
if [[ ! -f .env ]]; then
  bash scripts/init-secrets.sh
else
  echo "    .env đã tồn tại, skip (dùng --force để regenerate)"
fi

# 7. Login GHCR + pull + start
echo "[7/7] Pull image + start..."
echo ""
echo "Cần GitHub Personal Access Token với scope 'read:packages' để pull image GHCR private."
echo "Tạo token tại: https://github.com/settings/tokens/new?scopes=read:packages"
echo "Nếu repo public → bỏ qua bước này, ấn Enter."
read -r -p "GITHUB_TOKEN (Enter để bỏ qua): " GH_TOKEN
if [[ -n "${GH_TOKEN:-}" ]]; then
  echo "$GH_TOKEN" | sudo docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

# Pull và start với compose deploy override
sg docker -c "docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml pull"
sg docker -c "docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml up -d"

# Migrate + seed
echo "Đợi DB ready..."
sleep 10
sg docker -c "docker compose exec -T api npx prisma migrate deploy"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✓ Setup xong"
echo "═══════════════════════════════════════════════════════"
echo "Dashboard: $(grep ^WEB_DOMAIN .env | cut -d= -f2)"
echo "Admin login info ở .env (đã in ra ở bước trước)"
echo ""
echo "Tiếp theo:"
echo "  1. Caddy tự xin TLS sau ~30s request đầu"
echo "  2. Login → Settings → nhập KiotViet credentials"
echo "  3. Sync KiotViet → Chạy toàn bộ pipeline"
