#!/bin/sh
# Apply You Are Awesome token tables to the shared LPL Supabase.
# Needs: supabase CLI logged in, and either --linked or SUPABASE_ACCESS_TOKEN.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/sql/002_you_are_awesome_tokens.sql"
REF="${SUPABASE_PROJECT_REF:-uqhqulrqcygsmmzdzemx}"
echo "Applying $FILE to $REF"
npx --yes supabase@2.116.0 db query --linked --project-ref "$REF" -f "$FILE"
echo "Done. Probe: Presence /t/LOOKUP and Laser Admin → Tokens."
