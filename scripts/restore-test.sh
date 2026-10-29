#!/usr/bin/env bash
# Proves a dump restores: loads it into a scratch database, counts rows in key tables, drops the database.
# Usage: scripts/restore-test.sh [backups/buru-<time>.sql.gz]   (default: newest dump)
set -euo pipefail

file=${1:-$(ls -t backups/buru-*.sql.gz 2>/dev/null | head -1)}
[ -n "$file" ] && [ -f "$file" ] || { echo "no dump found in backups/ (run make backup)" >&2; exit 1; }
scratch=buru_restore_test

psql() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U buru "$@"; }

psql -d buru -qc "DROP DATABASE IF EXISTS $scratch" -c "CREATE DATABASE $scratch"
trap 'psql -d buru -qc "DROP DATABASE IF EXISTS $scratch"' EXIT

gunzip -c "$file" | psql -d "$scratch" -q > /dev/null
echo "restored $file into $scratch:"
psql -d "$scratch" -c "SELECT
  (SELECT count(*) FROM personas)      AS personas,
  (SELECT count(*) FROM conversations) AS conversations,
  (SELECT count(*) FROM messages)      AS messages,
  (SELECT count(*) FROM entities)      AS entities"
