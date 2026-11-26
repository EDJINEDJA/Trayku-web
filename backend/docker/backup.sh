#!/bin/bash
# The backup container: `backup.sh` loops (a dump, then wait); `backup.sh once` makes one now.
set -euo pipefail
umask 077
export PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"

dump() {
  local file="/backups/traiku-$(date -u +%Y%m%d-%H%M%S).dump"
  # Written under a temporary name: a half-written file is never taken for a backup.
  if pg_dump --format=custom --file="$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "sauvegarde : $(basename "$file") ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.tmp"
    echo "échec de la sauvegarde" >&2
    return 1
  fi
  find /backups -name 'traiku-*.dump' -mtime "+${BACKUP_KEEP_DAYS:-14}" -delete
}

if [ "${1:-}" = "once" ]; then
  dump
  exit
fi

while true; do
  dump || true
  sleep "$(( ${BACKUP_EVERY_HOURS:-24} * 3600 ))"
done
