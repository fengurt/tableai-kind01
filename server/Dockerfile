# syntax=docker/dockerfile:1
# Optimized for linux/amd64 (typical cloud / AMD servers).
# Build: docker build --platform linux/amd64 -f server/Dockerfile -t tableai-kind01-api:latest .

FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS builder
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json server/drizzle.config.ts ./
COPY server/src ./src
RUN npm run build

FROM --platform=linux/amd64 node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    API_PORT=8788 \
    SQLITE_PATH=/app/data/kind.sqlite

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r kind && useradd -r -g kind kind \
  && mkdir -p /app/data && chown -R kind:kind /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER kind
VOLUME ["/app/data"]
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
