#!/bin/bash
# Supabase migration'larını sırayla çalıştır
# Kullanım: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bash supabase/run_migrations.sh

set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Hata: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli."
  echo "Kullanım: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=ey... bash $0"
  exit 1
fi

MIGRATIONS_DIR="$(dirname "$0")/migrations"

for file in "$MIGRATIONS_DIR"/*.sql; do
  echo "Çalıştırılıyor: $(basename "$file")"
  SQL_CONTENT=$(cat "$file")

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -ge 400 ]; then
    echo "  HATA ($HTTP_CODE): $BODY"
    exit 1
  else
    echo "  OK ($HTTP_CODE)"
  fi
done

echo ""
echo "Tüm migration'lar başarıyla tamamlandı!"
