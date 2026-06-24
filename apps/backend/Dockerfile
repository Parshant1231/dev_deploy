# ─────────────────────────────────────────────
# STAGE 1: BUILD
# Uses a full Node.js image to compile TypeScript.
# ─────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first — Docker layer caching.
# If package.json hasn't changed, npm install is skipped.
COPY package*.json ./
RUN npm ci --only=production=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─────────────────────────────────────────────
# STAGE 2: PRODUCTION
# Copies only compiled output + production dependencies.
# Final image is ~200MB smaller than building in one stage.
# ─────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]