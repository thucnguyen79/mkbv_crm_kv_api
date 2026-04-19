#!/bin/sh
# Dump PostgreSQL + rotate. Chạy trong container db_backup qua cron daily.
# Env: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_RETENTION_DAYS
set -eu

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/${PGDATABASE}-${TS}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +%FT%TZ)] backup → $FILE"
pg_dump --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$FILE"

# Hash để detect corruption / theo dõi
sha256sum "$FILE" > "$FILE.sha256"

# Rotate — xoá dump cũ hơn N ngày
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name "*.sha256" -mtime +"$RETENTION_DAYS" -delete

# Size report
SIZE="$(du -h "$FILE" | awk '{print $1}')"
echo "[$(date -u +%FT%TZ)] done. size=$SIZE retained<=${RETENTION_DAYS}d"
ls -lh "$BACKUP_DIR" | head -20
