# Triển khai trên Oracle Cloud Free + CI/CD GitHub Actions

Hướng dẫn step-by-step để chạy CRM trên Oracle Ampere A1 (free vĩnh viễn) với CI/CD tự động từ GitHub.

## Yêu cầu

- GitHub account (đã có repo `thucnguyen79/mkbv_crm_kv_api`)
- Credit card (verify Oracle, không bị charge nếu giữ trong Always Free)
- Domain (optional — có thể dùng `<ip>.nip.io` để test trước)

## Phase B — Tạo Oracle Cloud VM

### 1. Đăng ký Oracle Cloud Free

- Vào https://www.oracle.com/cloud/free/ → Start for free
- Verify email + credit card (chỉ check, không charge)
- Chọn **Home Region**: ưu tiên Singapore / Tokyo (gần VN)
  - **Lưu ý**: home region không đổi được sau này. Always Free quota tính trên home region.

### 2. Tạo VM Ampere A1

1. Console → **Compute** → **Instances** → **Create Instance**
2. Image: **Canonical Ubuntu 22.04 — Ampere ARM**
3. Shape:
   - **Change shape** → **Specialty and previous generation**
   - Chọn `VM.Standard.A1.Flex`
   - **2 OCPU + 12 GB RAM** (để dành 2 OCPU + 12 GB cho VM khác sau)
4. Networking:
   - Tạo VCN mới với public IP
   - Tải SSH public key (paste content từ `~/.ssh/id_ed25519.pub`)
5. Boot volume: **50 GB** (có thể nâng tới 200 GB sau)
6. **Create**

Đợi ~2 phút → ghi lại **public IP**.

### 3. Mở port firewall ở VCN

Console → Networking → Virtual Cloud Networks → VCN của bạn → Security Lists → Default Security List

Thêm Ingress Rules:
- Source `0.0.0.0/0` · Protocol TCP · Port **80**
- Source `0.0.0.0/0` · Protocol TCP · Port **443**
- Source `0.0.0.0/0` · Protocol UDP · Port **443** (cho HTTP/3)

(Port 22 đã mở mặc định.)

### 4. SSH vào VM

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<public-ip>
```

## Phase C — Setup repo trên VM

```bash
# Trong SSH session
curl -fsSL https://raw.githubusercontent.com/thucnguyen79/mkbv_crm_kv_api/main/scripts/oracle-vm-setup.sh | bash
```

Script này sẽ:
1. Cài Docker + ufw + git
2. Mở port 80/443
3. Fix iptables FORWARD chain (Oracle Ubuntu image cần)
4. Clone repo `/opt/mkbv-crm`
5. Sinh `.env` với secret strong (ghi info admin ra console — **chụp lại**)
6. Hỏi GitHub PAT để login GHCR (nếu repo private)
7. Pull image + start stack
8. Migrate DB

Sau khi chạy xong, **logout + SSH lại** để Docker group có hiệu lực.

### Đăng nhập lần đầu

URL hiện ở console khi setup xong (mặc định `https://<ip>.nip.io`):

- Email: `admin@mkbv.local`
- Password: (random, in ra ở console — copy lại)

→ Vào **Cấu hình** → nhập KiotViet credentials → **Test API**

## Phase D — CI/CD wiring

### 1. Tạo GitHub deploy key

Trên máy local:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/mkbv_deploy -N "" -C "github-actions-deploy"
```

Copy public key vào VM:
```bash
ssh ubuntu@<public-ip> "cat >> ~/.ssh/authorized_keys" < ~/.ssh/mkbv_deploy.pub
```

### 2. Cấu hình GitHub Secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Value |
|---|---|
| `SSH_HOST` | Public IP Oracle VM |
| `SSH_USER` | `ubuntu` |
| `SSH_PRIVATE_KEY` | Content của `~/.ssh/mkbv_deploy` (private key, KHÔNG `.pub`) |
| `SSH_PORT` | `22` (optional, default 22) |

### 3. Cấu hình GitHub Variables

Repo → Settings → Secrets and variables → Actions → **Variables** tab:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api-<ip>.nip.io/api/v1` (hoặc domain thật) |
| `DEPLOY_ENABLED` | `true` |

### 4. Test workflow

Push 1 commit nhỏ vào branch `main`:

```bash
git commit --allow-empty -m "test: trigger deploy"
git push origin main
```

→ Vào tab **Actions** xem workflow:
1. **build-push**: build multi-arch image (~5-10 phút lần đầu, ~2-3 phút sau khi cache hot)
2. **deploy**: SSH vào VM, pull image, restart container (~30 giây)

Sau khi xong, refresh dashboard → version mới đã chạy.

## Phase E — Domain thật (optional)

Nếu mua domain (Cloudflare, Namecheap, ~$10/năm):

1. DNS:
   - `crm.your-domain.com` → A record → IP Oracle VM
   - `api.crm.your-domain.com` → A record → IP Oracle VM
2. Trên VM: edit `.env`:
   ```
   API_DOMAIN=api.crm.your-domain.com
   WEB_DOMAIN=crm.your-domain.com
   NEXTAUTH_URL=https://crm.your-domain.com
   NEXT_PUBLIC_API_URL=https://api.crm.your-domain.com/api/v1
   CORS_ORIGINS=https://crm.your-domain.com
   ACME_EMAIL=ops@your-domain.com
   ```
3. Update GitHub Variable `NEXT_PUBLIC_API_URL` thành domain thật
4. Restart stack:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml up -d --force-recreate
   ```
5. Caddy tự xin Let's Encrypt cert

## Vận hành

### Xem log

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f caddy
```

### Backup thủ công

```bash
docker compose exec postgres pg_dump -U crm crm | gzip > backup-$(date +%F).sql.gz
```

(Backup tự động đã có qua container `db_backup` mỗi 3am, retention 14 ngày — xem `docker-compose.prod.yml`.)

### Rotate secret (khi nghi ngờ leak)

```bash
cd /opt/mkbv-crm
./scripts/init-secrets.sh --force
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml up -d --force-recreate
```

→ Mọi user phải login lại.

### Rollback nhanh

```bash
# Pull image cũ (theo SHA tag từ commit cũ)
IMAGE_TAG=<old-short-sha> \
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.deploy.yml up -d --force-recreate
```

Migration ngược chỉ làm thủ công (Prisma không support auto rollback).

## Troubleshooting

### "Out of capacity" khi tạo VM

- Đổi region (Mumbai, Tokyo, Singapore thường có capacity tốt hơn US/EU)
- Hoặc tạo capacity request ở Console → Limits, Quotas and Usage

### Container chạy được nhưng không truy cập được từ ngoài

- Check Security List ở Oracle Console (port 80/443)
- `sudo ufw status` — port phải ALLOW
- `sudo iptables -L FORWARD -n | head -1` — phải là `ACCEPT`. Nếu DROP, chạy lại bước 4 trong setup script

### GitHub Actions deploy fail "Permission denied (publickey)"

- Verify SSH key paste đúng (cả `-----BEGIN ... END-----`)
- Public key đã append vào `~/.ssh/authorized_keys` của user `ubuntu` chưa
- Check `~/.ssh/authorized_keys` permission `chmod 600`

### Image pull fail "denied: denied"

- Repo private + chưa login GHCR trên VM
- Login lại: `echo $GH_TOKEN | docker login ghcr.io -u thucnguyen79 --password-stdin`

### Container ARM64 báo "exec format error"

- Image build cho amd64 nhưng deploy ARM. Verify GitHub Actions build dùng `platforms: linux/amd64,linux/arm64`
- Trên VM: `docker manifest inspect ghcr.io/thucnguyen79/mkbv_crm_kv_api/api:latest | jq '.manifests[].platform'` — phải có cả 2 architectures
