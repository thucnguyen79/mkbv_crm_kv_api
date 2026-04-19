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
# Copy CẢ root node_modules (pnpm symlinks ở apps/api/node_modules trỏ về /repo/node_modules/.pnpm)
COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/apps/api/node_modules ./node_modules

# Prisma CLI nằm ở devDependencies — install riêng vào runner để hỗ trợ `prisma migrate deploy` lúc start
RUN npm install --global --no-save prisma@5.20.0 && npm cache clean --force

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
