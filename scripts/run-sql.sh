#!/usr/bin/env bash
set -euo pipefail

SQL_FILE="${1:-}"

if [[ -z "$SQL_FILE" ]]; then
  echo "Usage: pnpm db:sql <path-to-sql-file>"
  echo "Example: pnpm db:sql supabase/phase4.sql"
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL file not found: $SQL_FILE"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed."
  echo "Install PostgreSQL client first, for example: brew install libpq"
  echo "Then add it to PATH if needed:"
  echo '  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"'
  exit 1
fi

DB_URL="${SUPABASE_DB_URL:-}"

if [[ -z "$DB_URL" && -f ".env.local" ]]; then
  DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | tail -n 1 | sed 's/^SUPABASE_DB_URL=//' | sed 's/^"//' | sed 's/"$//')"
fi

if [[ -z "$DB_URL" ]]; then
  echo "Missing SUPABASE_DB_URL."
  echo "Add it to .env.local or pass it inline:"
  echo '  SUPABASE_DB_URL="postgresql://..." pnpm db:sql supabase/phase4.sql'
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
