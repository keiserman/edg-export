// Export germantownadvanceddentistry.com via the public WP REST API.
// Node 18+ (uses built-in fetch). No dependencies.
// Run: cd scripts && node scrape-gad.mjs
//
// Output (../export, run from scripts/):
//   json/<type>.raw.json    full REST responses (pages, posts, ufaq, media)
//   json/<type>.json        slimmed records: slug, url, title, content HTML, Yoast SEO, featured image, parent
//   html/<url-path>/index.html   fully rendered page HTML (catches theme modules not in content.rendered)
//   media/<yyyy>/<mm>/<file>     original uploads from wp-content/uploads

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://www.germantownadvanceddentistry.com';
const OUT = '../export';
const TYPES = ['pages', 'posts', 'ufaq', 'media'];
const DELAY_MS = 300; // be polite
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; site-migration-export)' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function save(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

async function getAll(type) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = `${BASE}/wp-json/wp/v2/${type}?per_page=100&page=${page}${type === 'media' ? '' : '&_embed=wp:featuredmedia'}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`  ${type} page ${page}: HTTP ${res.status}`);
      break;
    }
    totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
    items.push(...(await res.json()));
    console.log(`  ${type}: page ${page}/${totalPages} (${items.length} items)`);
    page++;
    await sleep(DELAY_MS);
  } while (page <= totalPages);
  return items;
}

function slim(item) {
  const y = item.yoast_head_json || {};
  return {
    id: item.id,
    type: item.type,
    slug: item.slug,
    url: item.link,
    parent: item.parent || null,
    menu_order: item.menu_order ?? null,
    date: item.date,
    modified: item.modified,
    title: item.title?.rendered ?? '',
    excerpt: item.excerpt?.rendered ?? '',
    content_html: item.content?.rendered ?? '',
    featured_image: item._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null,
    categories: item.categories ?? [],
    tags: item.tags ?? [],
    ufaq_category: item['ufaq-category'] ?? undefined,
    acf: item.acf ?? undefined,
    seo: {
      title: y.title ?? null,
      description: y.description ?? null,
      canonical: y.canonical ?? null,
      og_image: y.og_image?.[0]?.url ?? null,
    },
  };
}

function urlToHtmlPath(link) {
  const p = new URL(link).pathname.replace(/^\/|\/$/g, '');
  return path.join(OUT, 'html', p || '_home', 'index.html');
}

async function main() {
  const all = {};

  console.log('Fetching REST data…');
  for (const type of TYPES) {
    all[type] = await getAll(type);
    await save(path.join(OUT, 'json', `${type}.raw.json`), JSON.stringify(all[type], null, 2));
    if (type !== 'media') {
      await save(path.join(OUT, 'json', `${type}.json`), JSON.stringify(all[type].map(slim), null, 2));
    }
  }

  console.log('\nSaving rendered HTML for pages/posts…');
  for (const item of [...all.pages, ...all.posts]) {
    try {
      const res = await fetch(item.link, { headers: HEADERS });
      if (res.ok) await save(urlToHtmlPath(item.link), await res.text());
      else console.warn(`  ${item.link}: HTTP ${res.status}`);
    } catch (e) {
      console.warn(`  ${item.link}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDownloading ${all.media.length} media files…`);
  const manifest = [];
  for (const m of all.media) {
    const src = m.source_url;
    if (!src) continue;
    const rel = src.split('/wp-content/uploads/')[1] || path.basename(new URL(src).pathname);
    const dest = path.join(OUT, 'media', rel);
    try {
      const res = await fetch(src, { headers: HEADERS });
      if (res.ok) {
        await save(dest, Buffer.from(await res.arrayBuffer()));
        manifest.push({ id: m.id, src, file: rel, alt: m.alt_text, mime: m.mime_type, width: m.media_details?.width, height: m.media_details?.height });
      } else console.warn(`  ${src}: HTTP ${res.status}`);
    } catch (e) {
      console.warn(`  ${src}: ${e.message}`);
    }
    await sleep(100);
  }
  await save(path.join(OUT, 'json', 'media.json'), JSON.stringify(manifest, null, 2));

  console.log('\nDone →', path.resolve(OUT));
  for (const t of TYPES) console.log(`  ${t}: ${all[t].length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
