# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
LABEL org.opencontainers.image.source="https://github.com/ee58594/ag_test"
LABEL org.opencontainers.image.description="PDFTranslate — PDF 翻译网站"

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy application source
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Uploads directory (writable by app user)
RUN mkdir -p /app/backend/uploads && chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/languages || exit 1

CMD ["node", "backend/server.js"]
