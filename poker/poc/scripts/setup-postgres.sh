#!/bin/sh
set -e
HOST="${DB_HOST:-localhost}"
USER="${DB_USER:-postgres}"
DB="${DB_NAME:-poker}"
export PGPASSWORD="${DB_PASSWORD:-Joker0328}"

if ! psql -h "$HOST" -U "$USER" -d postgres -tAc "SELECT 1" >/dev/null; then
  echo "Could not connect to PostgreSQL as $USER@$HOST"
  exit 1
fi

exists=$(psql -h "$HOST" -U "$USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'")
if [ "$exists" != "1" ]; then
  createdb -h "$HOST" -U "$USER" "$DB"
  echo "Created database $DB"
else
  echo "Database $DB already exists"
fi
