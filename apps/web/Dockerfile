#syntax=docker/dockerfile:1.7
# ========== Builder ==========
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile=false --filter @mkbv/web...

COPY apps/web ./apps/web
WORKDIR /repo/apps/web

# NEXT_PUBLIC_* cần ở build time (inline vào client bundle)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm build

# ========== Runner ==========
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat tini
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
# public/ không tồn tại thì bỏ qua — ở phase builder ta cần có folder public rỗng
RUN mkdir -p ./apps/web/public
COPY --from=builder /repo/apps/web/public ./apps/web/public

ENV PORT=3001 HOSTNAME=0.0.0.0
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
