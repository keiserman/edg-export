# Germantown Advanced Dentistry — site snapshot

A full snapshot of <https://www.germantownadvanceddentistry.com/> (server-rendered WordPress, Yoast SEO), captured for migration and reference.

**Captured:** 2026-10-23

## Layout

```
gad/
  mirror/     browsable static copy of the rendered site (wget)
    www.germantownadvanceddentistry.com/index.html   ← open this
  export/     structured export from the public WP REST API
    json/     pages, posts, ufaq, media (raw REST responses + slimmed records)
    html/     rendered HTML for every page/post, by URL path
    media/    original uploads from wp-content/uploads
  scripts/    the scripts used to produce the above
```

## How it was captured

```bash
cd gad/scripts

# 1. Collect every URL from the Yoast sitemaps → scripts/urls.txt (158 URLs)
./collect-urls.sh

# 2. Mirror the rendered site into mirror/ (crawl from homepage + seed from urls.txt)
./mirror.sh            # wraps the wget command below; logs to scripts/wget.log
#   wget --mirror --page-requisites --convert-links --adjust-extension \
#     --no-parent --wait=0.5 --random-wait \
#     --domains=www.germantownadvanceddentistry.com \
#     --reject-regex='(wp-json|wp-admin|xmlrpc|/feed/|\?s=|\?replytocom|/wp-login)' \
#     --user-agent="Mozilla/5.0" \
#     -i ../scripts/urls.txt https://www.germantownadvanceddentistry.com/

# 3. Fetch lazy-loaded images wget doesn't follow (data-src, data-bkg, data-mobile, ...)
#    and rewrite them to local relative paths
node fetch-lazy-assets.mjs

# 4. Structured export via the WP REST API → export/
node scrape-gad.mjs
```

Result: 289 HTML files in `mirror/` (all 158 sitemap URLs present), 34 pages, 59 posts, 54 FAQs and 265 media files in `export/`.

## Known gaps

These depend on third-party services and won't work offline:

- **Reviews widget**: third-party review embed
- **Online booking**: Jarvis booking iframe
- **Google Maps** embeds
- **External fonts and scripts**: Google Fonts (Lato), cdnjs (jquery-autocomplete), and similar

Other notes:

- `og:image` / `<meta content>` URLs intentionally still point at the live site.
- Yoast metadata (JSON-LD breadcrumbs, `@id`, `og:url`) in many pages references a stale staging domain, `live-edp-christopher-cooley-dds.pantheonsite.io`: 232 occurrences in 69 mirror files, 629 in 34 export files. This is how the live site serves it. It doesn't affect browsing, but fix it in any rebuild.
- Two URLs 404 on the live site itself: the theme's `datepicker/arrow.png`, and a malformed link on `/services/emergency-dentistry/` (`…/emergency-dentistry/https:/www…/gum-care/`).
- JS/CSS files are saved with their query string in the filename (e.g. `theme.min.js?ver=2.37.1`); links reference them as `%3Fver=`, which browsers resolve correctly.
