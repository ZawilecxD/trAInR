#!/usr/bin/env bash
# Re-run scripts/seed-dev-users.sql without a full db reset.
# On reset, this file also runs automatically after supabase/seed.sql (config.toml db.seed.sql_paths).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="$(docker ps --filter "name=supabase_db" --format '{{.Names}}' | head -1)"

if [[ -z "$CONTAINER" ]]; then
  echo "No local Supabase DB container found. Run: npx supabase start" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - \
  < "$ROOT/scripts/seed-dev-users.sql"
