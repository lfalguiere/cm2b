#!/bin/sh
set -e

SECRET_FILE=/app/data/.jwt_secret

if [ ! -f "$SECRET_FILE" ]; then
  echo "[cm2b] Génération du JWT secret..."
  openssl rand -hex 64 > "$SECRET_FILE"
fi

export JWT_SECRET=$(cat "$SECRET_FILE")

echo "[cm2b] Initialisation de la base de données..."
node dist/database/seed/create-admin.seed.js
node dist/database/seed/initial-metamodel.seed.js
node dist/database/seed/seed-structures.seed.js

exec node dist/main
