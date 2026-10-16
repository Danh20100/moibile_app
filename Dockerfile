# syntax=docker/dockerfile:1

FROM node:22.22.3-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.8.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --allow-build=esbuild --allow-build=@scarf/scarf

COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22.22.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable && corepack prepare pnpm@12.8.1 --activate \
  && apk add --no-cache wget

COPY package.json pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY database ./database
COPY scripts/database/migrate.ts ./scripts/database/migrate.ts
COPY scripts/config/verify-runtime.cjs ./scripts/config/verify-runtime.cjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
