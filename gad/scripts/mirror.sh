#!/usr/bin/env bash
# Mirror the rendered site into mirror/, crawling from the homepage and seeding from urls.txt.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/../mirror"

wget --mirror --page-requisites --convert-links --adjust-extension \
  --no-parent --wait=0.5 --random-wait \
  --domains=www.germantownadvanceddentistry.com \
  --reject-regex='(wp-json|wp-admin|xmlrpc|/feed/|\?s=|\?replytocom|/wp-login)' \
  --user-agent="Mozilla/5.0" \
  -i ../scripts/urls.txt https://www.germantownadvanceddentistry.com/ \
  > ../scripts/wget.log 2>&1
echo "wget exited with $?" >> ../scripts/wget.log
