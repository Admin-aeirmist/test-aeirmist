# ==============================================================================
# Aeirmist 24/7 Production Multi-Stage Dockerfile
# Combines:
# 1. Vite & Tailwind Frontend SPA Build -> /app/dist
# 2. TypeScript Backend API Build -> /app/backend/dist
# 3. High-Performance Node.js 20 Alpine Production Server with Drizzle ORM
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend SPA
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build assets
COPY src/ ./src/
COPY public/ ./public/
COPY index.html vite.config.ts server.ts tsconfig*.json ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build Backend API
# ------------------------------------------------------------------------------
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend/src/ ./src/
COPY backend/tsconfig.json backend/drizzle.config.ts ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app/backend

# Install netcat for database connection readiness check
RUN apk add --no-cache netcat-openbsd

ENV NODE_ENV=production \
    PORT=4000 \
    DIST_PATH=/app/dist

# Install production dependencies only + drizzle-kit for auto-migration
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev && npm install drizzle-kit

# Copy compiled backend from Stage 2
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/drizzle.config.ts ./
COPY --from=backend-builder /app/backend/src/db ./src/db

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/dist /app/dist

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Persistent storage mount point for uploaded videos, images, and audio
RUN mkdir -p /app/backend/storage/uploads /app/storage/uploads

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
