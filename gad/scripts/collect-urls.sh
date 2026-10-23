#!/usr/bin/env bash
# Collect every URL from the Yoast sitemaps into scripts/urls.txt (deduped).
set -euo pipefail

SITE="https://www.germantownadvanceddentistry.com"
UA="Mozilla/5.0"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/urls.txt"

extract_locs() {
  curl -sfL -A "$UA" "$1" | grep -o '<loc>[^<]*</loc>' | sed -e 's#<loc>##' -e 's#</loc>##'
}

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for sitemap in $(extract_locs "$SITE/sitemap_index.xml"); do
  echo "Fetching $sitemap" >&2
  extract_locs "$sitemap" >> "$tmp"
done

# Make sure the homepage is included
grep -qxF "$SITE/" "$tmp" || echo "$SITE/" >> "$tmp"

sort -u "$tmp" > "$OUT"
echo "Wrote $(wc -l < "$OUT" | tr -d ' ') URLs to $OUT" >&2
