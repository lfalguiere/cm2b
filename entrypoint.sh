#!/bin/sh
set -e

SECRET_FILE=/app/data/.jwt_secret

if [ ! -f "$SECRET_FILE" ]; then
  echo "[cm2b] Génération du JWT secret..."
  openssl rand -hex 64 > "$SECRET_FILE"
fi

export JWT_SECRET=$(cat "$SECRET_FILE")

exec node dist/main
