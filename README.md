# MKBV CRM & Messaging (KiotViet API)

[![CI](https://github.com/thucnguyen79/mkbv_crm_kv_api/actions/workflows/ci.yml/badge.svg)](https://github.com/thucnguyen79/mkbv_crm_kv_api/actions/workflows/ci.yml)
[![Deploy](https://github.com/thucnguyen79/mkbv_crm_kv_api/actions/workflows/deploy.yml/badge.svg)](https://github.com/thucnguyen79/mkbv_crm_kv_api/actions/workflows/deploy.yml)

Hệ thống CRM + Messaging (SMS/ZNS) cho chuỗi phòng khám mắt / cửa hàng kính, đồng bộ với KiotViet POS qua Public API.

## Kiến trúc

Monolith NestJS với module rõ ràng:

- **integration** — KiotViet OAuth2 client, sync engine (polling + webhook)
- **customer / order / loyalty** — domain modules
- **messaging** — queue gửi SMS/ZNS với retry + fallback ZNS → SMS
- **automation** — rule engine + campaign scheduler

Stack: NestJS 10 + PostgreSQL 16 + Prisma + Redis + BullMQ. Frontend Next.js 14 (App Router).

## Cấu trúc repo

```
apps/
  api/       — NestJS backend
  web/       — Next.js 14 dashboard
packages/
  shared/    — shared TS types
```

## Quickstart

```bash
# 1) Cài pnpm (nếu chưa) rồi cài deps
corepack enable && corepack prepare pnpm@10.33.0 --activate
pnpm install

# 2) Copy env
cp .env.example .env

# 3) Khởi động infra (postgres + redis)
docker compose up -d postgres redis

# 4) Migrate + seed
pnpm db:migrate
pnpm db:seed

# 5) Chạy dev
pnpm dev
# API: http://localhost:3000/api/v1
# Web: http://localhost:3001
```

## Triển khai

- **Local prod test**: xem [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Oracle Cloud Free + CI/CD GitHub**: xem [docs/DEPLOYMENT-ORACLE.md](docs/DEPLOYMENT-ORACLE.md)
- **Architecture & data flow**: xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

CI/CD flow: push lên `main` → GitHub Actions build multi-arch image (amd64 + arm64) → push GHCR → SSH vào VM → pull + restart container. Thấy thay đổi production trong ~5 phút.

## Lệnh hữu ích

| Lệnh | Mô tả |
|---|---|
| `pnpm dev` | Chạy API + Web song song |
| `pnpm build` | Build toàn bộ |
| `pnpm lint` | Lint toàn bộ |
| `pnpm test` | Test toàn bộ |
| `pnpm db:migrate` | Prisma migrate dev |
| `pnpm db:seed` | Seed DB |
| `pnpm docker:up` | Khởi động full stack Docker |
