# ── Stage 1 : build Angular ───────────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci --prefer-offline
COPY client/ .
RUN npm run build -- --configuration production

# ── Stage 2 : build NestJS ────────────────────────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --prefer-offline
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 3 : image de production ────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Backend compilé
COPY --from=server-builder /build/dist ./dist/

# Angular build — ServeStaticModule cherche :
#   join(__dirname, '..', 'client', 'dist', 'cm2b-app', 'browser')
#   __dirname = /app/dist  →  /app/client/dist/cm2b-app/browser  ✓
COPY --from=client-builder /build/client/dist ./client/dist/

RUN mkdir -p data

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production \
    DB_PATH=/app/data/cm2b.sqlite

EXPOSE 3000
ENTRYPOINT ["sh", "entrypoint.sh"]
