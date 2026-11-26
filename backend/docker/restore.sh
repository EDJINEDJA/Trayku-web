#!/bin/bash
# Restores a backup into the database, replacing what's there: `npm run db:restore -- traiku-….dump --confirmer`.
set -euo pipefail
file="${1:-}"
if [ -z "$file" ] || [ "${2:-}" != "--confirmer" ]; then
  echo "Usage : npm run db:restore -- <fichier dans backups/> --confirmer"
  echo "La base actuelle est remplacée par la sauvegarde. Sauvegardes disponibles :"
  docker exec traiku-backup sh -c 'ls -1t /backups/*.dump 2>/dev/null | xargs -n1 basename' || true
  exit 1
fi
name="$(basename "$file")"
# A backup of the current state first, in case the restore was a mistake.
docker exec traiku-backup bash /backup.sh once
docker exec traiku-backup pg_restore --clean --if-exists --single-transaction --dbname=traiku "/backups/$name"
echo "Base restaurée depuis $name. Redémarrez le serveur."
