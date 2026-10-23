// Download lazy-loaded assets that wget doesn't follow (data-src, data-bkg, data-mobile, ...)
// and rewrite those attributes in the mirrored HTML to relative local paths.
// Node 18+. Run: cd scripts && node fetch-lazy-assets.mjs
//
// og:image / <meta content="..."> URLs are left absolute on purpose.

import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'www.germantownadvanceddentistry.com';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '../mirror', HOST);
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const DELAY_MS = 300;

// data-* attribute whose value is an absolute same-site asset URL
const ATTR_RE = new RegExp(
  `(data-[a-z-]+=)(["'])https?://${HOST.replace(/\./g, '\\.')}/((?:wp-content|wp/wp-includes)/[^"'?#]+)\\2`,
  'g'
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.html')) yield p;
  }
}

async function main() {
  const files = [];
  const assets = new Set();
  for await (const file of walk(ROOT)) {
    const html = await readFile(file, 'utf8');
    const found = [...html.matchAll(ATTR_RE)].map((m) => m[3]);
    if (found.length) {
      files.push(file);
      found.forEach((a) => assets.add(a));
    }
  }
  console.log(`${assets.size} lazy-loaded assets referenced from ${files.length} HTML files`);

  const failed = new Set();
  for (const rel of assets) {
    const dest = path.join(ROOT, decodeURIComponent(rel));
    if (await exists(dest)) continue;
    const url = `https://${HOST}/${rel}`;
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`  saved ${rel}`);
    } catch (e) {
      failed.add(rel);
      console.warn(`  ${url}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  let rewrites = 0;
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    const out = html.replace(ATTR_RE, (match, attr, q, rel) => {
      if (failed.has(rel)) return match;
      rewrites++;
      const local = path.relative(path.dirname(file), path.join(ROOT, rel));
      return `${attr}${q}${local}${q}`;
    });
    if (out !== html) await writeFile(file, out);
  }
  console.log(`Rewrote ${rewrites} attributes; ${failed.size} assets failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
