#!/usr/bin/env bash
# Nightly PostgreSQL dump (TR-23). Writes backups/buru-<UTC time>.sql.gz, keeps 14 days locally,
# and copies it off the server when BACKUP_REMOTE is set (an rclone destination, e.g. r2:buru-backups).
# Cron on the VPS: 0 3 * * * cd /opt/buru && make backup >> backups/backup.log 2>&1
set -euo pipefail

dir=backups
mkdir -p "$dir"
file="$dir/buru-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

docker compose exec -T postgres pg_dump -U buru -d buru --no-owner | gzip > "$file"
echo "wrote $file ($(du -h "$file" | cut -f1))"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$file" "$BACKUP_REMOTE"
  echo "copied to $BACKUP_REMOTE"
else
  echo "BACKUP_REMOTE not set: dump is on this server only" >&2
fi

find "$dir" -name 'buru-*.sql.gz' -mtime +14 -delete
