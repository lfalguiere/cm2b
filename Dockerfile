# ── Stage 1 : build Angular ───────────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build -- --configuration production

# ── Stage 2 : build NestJS + prépare node_modules de production ───────────────
FROM node:20-alpine AS server-builder
# Outils requis pour compiler better-sqlite3 et bcrypt
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

# ── Stage 3 : image de production ────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

# node_modules déjà compilés et purgés des devDependencies
COPY --from=server-builder /build/node_modules ./node_modules/

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
    DB_PATH=/app/data/cm2b.sqlite \
    TYPEORM_SYNC=true

EXPOSE 3000
ENTRYPOINT ["sh", "entrypoint.sh"]
