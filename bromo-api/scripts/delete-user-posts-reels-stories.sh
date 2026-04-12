#!/usr/bin/env bash
# Bulk soft-delete (API) all posts, reels, and stories for one user via curl.
#
# Auth: Bromo /posts routes expect a Firebase **ID token** in Authorization: Bearer …
#       (same token the mobile app sends). This is NOT the admin JWT from JWT_SECRET.
#
# Usage:
#   export BEARER_TOKEN='eyJhbGciOiJSUzI1NiIs...'   # Firebase ID token from client / REST
#   export MONGO_USER_ID='64abc...'                 # Your User document _id (Mongo ObjectId hex)
#   export BROMO_API_BASE='https://bromo.darkunde.in'   # optional; default below
#
#   bash scripts/delete-user-posts-reels-stories.sh
#
# Requires: curl, jq
#
# Note: DELETE /posts/:id only works for posts **you authored**. Orphan files under
#       uploads/ are not removed by this API (only DB isActive=false).

set -euo pipefail

API="${BROMO_API_BASE:-https://bromo.darkunde.in}"
TOKEN="${BEARER_TOKEN:-${FIREBASE_ID_TOKEN:-}}"
UID="${MONGO_USER_ID:-${BROMO_USER_ID:-}}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (brew install jq)" >&2
  exit 1
fi

if [[ -z "$TOKEN" ]]; then
  echo "Set BEARER_TOKEN (or FIREBASE_ID_TOKEN) to your Firebase ID token." >&2
  exit 1
fi

if [[ -z "$UID" ]]; then
  echo "Set MONGO_USER_ID (or BROMO_USER_ID) to your MongoDB User _id hex string." >&2
  exit 1
fi

deleted=0
failed=0
body_file=$(mktemp)
trap 'rm -f "$body_file"' EXIT

for TYPE in post reel story; do
  page=1
  while true; do
    url="${API}/posts/user/${UID}?type=${TYPE}&page=${page}"
    if ! resp=$(curl -fsS "$url" -H "Authorization: Bearer ${TOKEN}"); then
      echo "[${TYPE}] page ${page}: GET failed" >&2
      exit 1
    fi

    count=$(echo "$resp" | jq '.posts | length')
    if [[ "$count" -eq 0 ]]; then
      break
    fi

    while read -r id; do
      [[ -z "$id" || "$id" == "null" ]] && continue
      code=$(curl -sS -o "$body_file" -w "%{http_code}" -X DELETE "${API}/posts/${id}" -H "Authorization: Bearer ${TOKEN}" || true)
      if [[ "$code" == "200" ]]; then
        echo "OK DELETE ${TYPE} ${id}"
        deleted=$((deleted + 1))
      else
        echo "FAIL DELETE ${TYPE} ${id} HTTP ${code} $(tr -d '\n' <"$body_file" 2>/dev/null | head -c 200)" >&2
        failed=$((failed + 1))
      fi
    done < <(echo "$resp" | jq -r '.posts[]._id | tostring')

    has_more=$(echo "$resp" | jq -r '.hasMore')
    if [[ "$has_more" != "true" ]]; then
      break
    fi
    page=$((page + 1))
  done
done

echo "Done. deleted=${deleted} failed=${failed}"
