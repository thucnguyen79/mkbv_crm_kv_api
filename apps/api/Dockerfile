#syntax=docker/dockerfile:1.7
# ========== Builder ==========
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile=false --filter @mkbv/api...

COPY apps/api ./apps/api
WORKDIR /repo/apps/api
RUN pnpm prisma generate
RUN pnpm build

# ========== Runner ==========
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/dist ./dist

# Install deps with npm directly in runner — pnpm workspace symlinks không portable qua COPY.
# npm install --omit=dev tạo node_modules flat, deterministic.
# Thêm prisma CLI (dù devDep) để hỗ trợ migrate deploy lúc startup.
RUN npm install --omit=dev --no-audit --no-fund && \
    npm install prisma@5.20.0 --no-save --no-audit --no-fund && \
    npx prisma generate --schema=./prisma/schema.prisma && \
    npm cache clean --force

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
