# POC deploy trên local Ubuntu server (mkmsg.ddns.net)

POC test với truy cập internet qua port forward — HTTP plain, không TLS.

## Yêu cầu

- Ubuntu 22.04+ với Docker đã cài
- Port forward: `60080 → VM:80` (Modem + Vigor)
- DDNS hoạt động (mkmsg.ddns.net resolve về IP public)

## Setup lần đầu

```bash
# 1. Clone repo
sudo mkdir -p /opt/mkbv-crm
sudo chown $USER:$USER /opt/mkbv-crm
git clone https://github.com/thucnguyen79/mkbv_crm_kv_api.git /opt/mkbv-crm
cd /opt/mkbv-crm

# 2. Sinh .env (script in ra admin password — chụp lại)
bash scripts/init-poc.sh

# 3. Login GHCR (cần GitHub PAT với scope read:packages)
#    Tạo token tại: https://github.com/settings/tokens/new?scopes=read:packages
echo <YOUR_GH_PAT> | docker login ghcr.io -u thucnguyen79 --password-stdin

# 4. Pull image (~200 MB tổng)
docker compose -f docker-compose.yml \
               -f docker-compose.poc.yml \
               -f docker-compose.deploy.yml pull

# 5. Start stack
docker compose -f docker-compose.yml \
               -f docker-compose.poc.yml \
               -f docker-compose.deploy.yml up -d

# 6. Đợi 15-20s rồi migrate DB
sleep 15
docker compose exec api npx prisma migrate deploy

# 7. Seed admin + permissions
docker compose exec api node -e "require('./dist/seed.js')" 2>/dev/null \
  || docker compose exec api npx prisma db seed
```

## Truy cập

```
http://mkmsg.ddns.net:60080
```

- Email: `admin@mkbv.local`
- Password: (từ output của `init-poc.sh`)

Sau khi login → vào **Cấu hình** → nhập KiotViet credentials → Test.

## Vận hành

### Xem log

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f caddy
```

### Restart 1 service

```bash
docker compose restart api
```

### Update lên image mới (sau khi GitHub Actions push)

```bash
cd /opt/mkbv-crm
git pull origin main
docker compose -f docker-compose.yml \
               -f docker-compose.poc.yml \
               -f docker-compose.deploy.yml pull
docker compose -f docker-compose.yml \
               -f docker-compose.poc.yml \
               -f docker-compose.deploy.yml up -d
```

### Backup DB

```bash
docker compose exec postgres pg_dump -U crm crm | gzip > ~/crm-backup-$(date +%F).sql.gz
```

### Reset hoàn toàn (xoá tất cả data)

```bash
docker compose -f docker-compose.yml -f docker-compose.poc.yml down -v
# Xoá luôn volume → mất hết DB + uploads
```

## Hạn chế POC

| Hạn chế | Workaround prod |
|---|---|
| Không TLS (HTTP plain) | Dùng Cloudflare Tunnel hoặc cấp domain + Caddy auto-TLS |
| Cookie không secure | OK với HTTP, không gửi link cho khách hàng |
| 1 vCPU + 3.3 GB RAM — sync chậm | Upgrade VM hoặc deploy cloud |
| Office mất điện = down | Cloud VPS hoặc UPS office |
| Office upload chậm = user load chậm | Cloudflare cache CDN hoặc cloud VPS |

## Troubleshooting

### Truy cập http://mkmsg.ddns.net:60080 không lên trang

1. Check Caddy log: `docker compose logs caddy`
2. Check forward port: từ máy 4G hoặc https://yougetsignal.com — port 60080 phải `open`
3. Check container: `docker compose ps` — `caddy`, `api`, `web` phải `running`

### Login fail

- Mở DevTools → Network → check request `/api/auth/callback/credentials`
- Nếu 500 → API down: `docker compose logs api`
- Nếu 401 → password sai, dùng đúng password từ `init-poc.sh`

### Sync KiotViet fail

- Vào **Cấu hình** → check credential đã nhập đúng → bấm **Test API**
- Nếu OK mà sync vẫn fail → check `docker compose logs api | grep -i sync`
