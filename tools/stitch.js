#!/usr/bin/env node
/**
 * Goober stitch — zero-dep static-site builder.
 *
 * Reads source pages from `pages/` and `blog/`, inlines `partials/` via
 * `@use:<name> [key="value"]` markers, generates SEO meta from `@seo`,
 * derives `site/*.json` registries, writes everything to `dist/`.
 *
 * Usage:
 *   node tools/stitch.js                  # full rebuild
 *   node tools/stitch.js --verify          # dry-run + validation
 *   node tools/stitch.js --state-only      # derive site/*.json only (no dist writes)
 *   node tools/stitch.js --changed <path>  # incremental (changed file + dependents)
 *   node tools/stitch.js --watch --serve   # dev server on :4001 (or PORT env)
 *
 * Exits 0 on success, non-zero on errors. Final stdout line is a JSON
 * outcome the Electron-side wrapper parses.
 *
 * Phase 1 shipped the marker parser + dev server. Phase 6 adds
 * @seo/@page/@post block parsing, SEO <head> + JSON-LD injection,
 * deterministic site/*.json derivation, and sitemap/robots/feed.
 * Phase 8 adds perf-budget enforcement at build time.
 *
 * site/*.json files are serialized DETERMINISTICALLY (sorted keys, sorted
 * arrays, no embedded timestamps) so `node tools/stitch.js` always produces
 * byte-identical output for the same inputs — clean git diffs across
 * machines, branches, and merges.
 */

'use strict';
const fs = require('fs');
const path = require('path');

// ─── CLI args ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const FLAGS = {
  verify: argv.includes('--verify'),
  watch: argv.includes('--watch'),
  serve: argv.includes('--serve'),
  stateOnly: argv.includes('--state-only'),
};
function getArg(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}
const CHANGED = getArg('--changed');

// ─── Paths ──────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, 'pages');
const BLOG_DIR = path.join(ROOT, 'blog');
const PARTIALS_DIR = path.join(ROOT, 'partials');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_DIR = path.join(ROOT, 'site');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DESIGN_DIR = path.join(ROOT, 'design-guide');

// ─── Logging helpers ────────────────────────────────────────────────────
const warnings = [];
const errors = [];
function warn(msg) { warnings.push(msg); console.error(`[stitch] WARN: ${msg}`); }
function fail(msg) { errors.push(msg); console.error(`[stitch] ERROR: ${msg}`); }

// ─── Filesystem walk ────────────────────────────────────────────────────
function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      out.push(...walk(abs, predicate));
    } else if (stat.isFile() && predicate(abs)) {
      out.push(abs);
    }
  }
  return out;
}

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Deterministic JSON serialization ───────────────────────────────────
/** Recursively sort object keys so output bytes are stable run-to-run. */
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}
function stableStringify(value) {
  return JSON.stringify(sortKeys(value), null, 2) + '\n';
}

// ─── Marker + block parsing ─────────────────────────────────────────────
/**
 * Parses a single line like:
 *   <!-- @use:header title="About" og_image="/a.jpg" -->
 * Returns { name, attrs } or null.
 */
function parseUseMarker(line) {
  const m = line.match(/^\s*<!--\s*@use:([\w-]+)\s*(.*?)\s*-->\s*$/);
  if (!m) return null;
  return { name: m[1], attrs: parseAttrs(m[2] || '') };
}

/** Parse `key="value" key2="value 2"` into an object. Quotes required. */
function parseAttrs(text) {
  const out = {};
  const re = /([\w-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2];
  return out;
}

/**
 * Parse a multi-line `@seo` / `@page` / `@post` block body. Supports:
 *   key="string"
 *   key=["a","b"]      (arrays — secondary_keywords, sections, tags)
 *   key=5  key=true    (bare numbers / booleans — reading_minutes, noindex)
 */
function parseBlockBody(body) {
  const out = {};
  // Arrays first so their quoted items aren't mistaken for string attrs.
  const arrRe = /([\w-]+)\s*=\s*\[([^\]]*)\]/g;
  let am;
  while ((am = arrRe.exec(body))) {
    out[am[1]] = am[2]
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  // Quoted strings.
  const strRe = /([\w-]+)\s*=\s*"([^"]*)"/g;
  let sm;
  while ((sm = strRe.exec(body))) {
    if (!(sm[1] in out)) out[sm[1]] = sm[2];
  }
  // Bare numbers / booleans.
  const bareRe = /([\w-]+)\s*=\s*(true|false|-?\d+(?:\.\d+)?)\b/g;
  let bm;
  while ((bm = bareRe.exec(body))) {
    if (!(bm[1] in out)) {
      const v = bm[2];
      out[bm[1]] = v === 'true' ? true : v === 'false' ? false : Number(v);
    }
  }
  return out;
}

/** Extract one `<!-- @name ... -->` block's attrs, or null when absent. */
function parseBlock(html, name) {
  const re = new RegExp(`<!--\\s*@${name}\\b([\\s\\S]*?)-->`, 'i');
  const m = html.match(re);
  return m ? parseBlockBody(m[1]) : null;
}

/** Strip all @seo / @page / @post comment blocks from the source. */
function stripMetaBlocks(html) {
  return html
    .replace(/<!--\s*@seo\b[\s\S]*?-->\s*/i, '')
    .replace(/<!--\s*@page\b[\s\S]*?-->\s*/i, '')
    .replace(/<!--\s*@post\b[\s\S]*?-->\s*/i, '')
    .replace(/^\s*\n/, '');
}

/** Replace {{key}} placeholders in a string with values from `attrs`. */
function interpolate(template, attrs, defaults = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (attrs[k] !== undefined && attrs[k] !== '') return String(attrs[k]);
    if (defaults[k] !== undefined) return String(defaults[k]);
    return '';
  });
}

/** Find the `<!-- @default ... -->` line in a partial and extract attrs. */
function readDefaults(partialBody) {
  const m = partialBody.match(/<!--\s*@default\s+([^>]*?)-->/);
  return m ? parseAttrs(m[1]) : {};
}

// ─── Business profile (for SEO + JSON-LD) ───────────────────────────────
let businessCache = null;
function loadBusiness() {
  if (businessCache) return businessCache;
  const file = path.join(SITE_DIR, 'business.json');
  let data = {};
  if (fs.existsSync(file)) {
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { warn(`Couldn't parse site/business.json: ${e.message}`); }
  }
  businessCache = data;
  return data;
}

let perfBudgetCache = null;
function loadPerfBudget() {
  if (perfBudgetCache) return perfBudgetCache;
  const file = path.join(SITE_DIR, 'perf-budget.json');
  let data = {};
  if (fs.existsSync(file)) {
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { /* ignore */ }
  }
  perfBudgetCache = data;
  return data;
}

/** Build a JSON-LD <script> from @seo.schema_type + business.json. */
function buildJsonLd(seo, business, route) {
  const type = seo.schema_type;
  if (!type) return '';
  const data = { '@context': 'https://schema.org', '@type': type };
  if (business.name) data.name = business.name;
  if (business.tagline) data.description = business.tagline;
  if (business.phone) data.telephone = business.phone;
  if (business.email) data.email = business.email;
  if (business.canonical_url) data.url = business.canonical_url + route;
  if (business.address && (business.address.suburb || business.address.street)) {
    data.address = { '@type': 'PostalAddress' };
    if (business.address.street) data.address.streetAddress = business.address.street;
    if (business.address.suburb) data.address.addressLocality = business.address.suburb;
    if (business.address.state) data.address.addressRegion = business.address.state;
    if (business.address.postcode) data.address.postalCode = business.address.postcode;
    if (business.address.country) data.address.addressCountry = business.address.country;
  }
  return `<script type="application/ld+json">${JSON.stringify(sortKeys(data))}</script>`;
}

// ─── Partial loader (cached per-run) ────────────────────────────────────
const partialCache = new Map();
function loadPartial(name) {
  if (partialCache.has(name)) return partialCache.get(name);
  const file = path.join(PARTIALS_DIR, `${name}.html`);
  if (!fs.existsSync(file)) {
    warn(`Missing partial: ${name} (looked at ${rel(file)})`);
    partialCache.set(name, null);
    return null;
  }
  const body = fs.readFileSync(file, 'utf8');
  const defaults = readDefaults(body);
  const stripped = body.replace(/<!--\s*@default[\s\S]*?-->/, '').trimStart();
  const entry = { body: stripped, defaults };
  partialCache.set(name, entry);
  return entry;
}

// ─── Stitch one page ────────────────────────────────────────────────────
function stitchHtml(html, dependencies = new Set(), depth = 0, ctx = {}) {
  if (depth > 20) {
    fail('Partial inclusion depth exceeded 20 — likely a circular reference.');
    return html;
  }
  const lines = html.split('\n');
  const out = [];
  for (const line of lines) {
    const marker = parseUseMarker(line);
    if (!marker) {
      out.push(line);
      continue;
    }
    // Synthesised partial: posts-list.
    if (marker.name === 'posts-list') {
      dependencies.add('posts-list');
      const limit = marker.attrs.limit ? Number(marker.attrs.limit) : Infinity;
      const excludeCurrent = marker.attrs['exclude-current'] === 'true';
      let posts = getBlogPosts();
      if (excludeCurrent && ctx.currentSlug) {
        posts = posts.filter((p) => p.slug !== ctx.currentSlug);
      }
      if (Number.isFinite(limit)) posts = posts.slice(0, limit);
      out.push(renderPostsList(posts, marker.attrs));
      continue;
    }
    const partial = loadPartial(marker.name);
    if (!partial) {
      out.push(line); // keep marker visible so the failure shows in preview
      continue;
    }
    dependencies.add(marker.name);
    // `meta` partial gets the page's @seo values merged in (page wins over
    // partial @default; an explicit marker attr wins over everything).
    let effAttrs = marker.attrs;
    if (marker.name === 'meta' && ctx.metaAttrs) {
      effAttrs = Object.assign({}, ctx.metaAttrs, marker.attrs);
    }
    let filled = interpolate(partial.body, effAttrs, partial.defaults);
    filled = stitchHtml(filled, dependencies, depth + 1, ctx);
    out.push(filled);
    // Inject JSON-LD immediately after the meta block.
    if (marker.name === 'meta' && ctx.jsonLd) {
      out.push(ctx.jsonLd);
    }
  }
  return out.join('\n');
}

// ─── Blog post metadata + posts-list synthesis ──────────────────────────
function parsePostMeta(html) {
  const block = parseBlock(html, 'post');
  if (!block) return null;
  // Pull summary/title from the @seo block too if missing on @post.
  const seo = parseBlock(html, 'seo');
  if (seo) {
    if (block.title === undefined && seo.title) block.title = seo.title;
    if (block.summary === undefined && seo.description) block.summary = seo.description;
  }
  return block;
}

function enumerateBlogPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const posts = [];
  for (const name of fs.readdirSync(BLOG_DIR)) {
    if (!name.toLowerCase().endsWith('.html')) continue;
    if (name === 'index.html') continue;
    if (name.startsWith('_')) continue;
    const abs = path.join(BLOG_DIR, name);
    const html = fs.readFileSync(abs, 'utf8');
    const meta = parsePostMeta(html);
    if (!meta) continue;
    if (meta.status === 'draft') continue;
    const slug = name.replace(/\.html$/i, '');
    posts.push({
      slug,
      route: `/blog/${slug}/`,
      title: meta.title || slug,
      date: meta.date || '',
      summary: meta.summary || '',
      hero: meta.hero || '',
      tags: meta.tags || [],
    });
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return posts;
}

function renderPostsList(posts) {
  if (posts.length === 0) return '<p class="blog-empty">No posts published yet.</p>';
  return posts
    .map((p) => {
      const tags = (p.tags || [])
        .map((t) => `<span class="blog-tag">${escapeHtml(t)}</span>`)
        .join(' ');
      const dateHtml = p.date
        ? `<time class="blog-card__date" datetime="${escapeHtml(p.date)}">${escapeHtml(p.date)}</time>`
        : '';
      return `<article class="blog-card">
  ${dateHtml}
  <h3 class="blog-card__title"><a href="${escapeHtml(p.route)}">${escapeHtml(p.title)}</a></h3>
  ${p.summary ? `<p class="blog-card__summary">${escapeHtml(p.summary)}</p>` : ''}
  ${tags ? `<p class="blog-card__tags">${tags}</p>` : ''}
</article>`;
    })
    .join('\n');
}

let blogPostsCache = null;
function getBlogPosts() {
  if (blogPostsCache) return blogPostsCache;
  blogPostsCache = enumerateBlogPosts();
  return blogPostsCache;
}

// ─── Route + dist-path helpers ──────────────────────────────────────────
function computeDistPath(srcRel) {
  if (srcRel === 'pages/index.html') return 'index.html';
  if (srcRel.startsWith('pages/')) {
    const slug = srcRel.replace(/^pages\//, '').replace(/\.html$/, '');
    return `${slug}/index.html`;
  }
  if (srcRel === 'blog/index.html') return 'blog/index.html';
  if (srcRel.startsWith('blog/')) {
    const slug = srcRel.replace(/^blog\//, '').replace(/\.html$/, '');
    return `blog/${slug}/index.html`;
  }
  return srcRel;
}

/** Public route for a source page, e.g. pages/about.html → "/about/". */
function computeRoute(srcRel) {
  if (srcRel === 'pages/index.html') return '/';
  if (srcRel.startsWith('pages/')) {
    const slug = srcRel.replace(/^pages\//, '').replace(/\.html$/, '');
    return `/${slug}/`;
  }
  if (srcRel === 'blog/index.html') return '/blog/';
  if (srcRel.startsWith('blog/')) {
    const slug = srcRel.replace(/^blog\//, '').replace(/\.html$/, '');
    return `/blog/${slug}/`;
  }
  return '/' + srcRel;
}

// ─── Source scanners (links / blocks / images) ──────────────────────────
function extractLinks(body) {
  const out = [];
  const re = /<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(body))) {
    const href = m[1];
    if (!href.startsWith('/')) continue; // internal, root-relative only
    out.push({ to: href, anchor: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
}

function extractBlocks(body) {
  const out = [];
  const re = /\bdata-block="([^"]+)"/g;
  let m;
  while ((m = re.exec(body))) out.push(m[1]);
  return out;
}

/** Count external `<script src="http(s)://… | //…">` tags (third-party). */
function countThirdPartyScripts(body) {
  let count = 0;
  const re = /<script\b[^>]*\bsrc="([^"]+)"/gi;
  let m;
  while ((m = re.exec(body))) {
    const src = m[1];
    if (/^https?:\/\//i.test(src) || src.startsWith('//')) count++;
  }
  return count;
}

function extractImgRefs(body, route, acc) {
  const re = /<img\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(body))) {
    const attrs = m[1];
    const srcM = attrs.match(/\bsrc="([^"]+)"/);
    if (!srcM) continue;
    const src = srcM[1];
    if (!src.startsWith('/')) continue;
    const altM = attrs.match(/\balt="([^"]*)"/);
    const hasAlt = !!altM;
    const altVal = altM ? altM[1] : '';
    if (!acc[src]) acc[src] = { routes: new Set(), hasEmptyAlt: false, alt: undefined };
    acc[src].routes.add(route);
    if (!hasAlt || altVal.trim() === '') acc[src].hasEmptyAlt = true;
    else if (acc[src].alt === undefined) acc[src].alt = altVal;
  }
}

// ─── Page processor ─────────────────────────────────────────────────────
function processPage(srcAbs) {
  const srcRel = rel(srcAbs);
  if (srcRel.includes('/_drafts/') || path.basename(srcAbs).startsWith('_')) {
    return { skipped: true };
  }
  const raw = fs.readFileSync(srcAbs, 'utf8');
  const isBlog = srcRel.startsWith('blog/') && srcRel !== 'blog/index.html';

  const seo = parseBlock(raw, 'seo') || {};
  const pageMeta = parseBlock(raw, 'page') || {};
  const post = isBlog ? parsePostMeta(raw) : null;

  const route = computeRoute(srcRel);
  const business = loadBusiness();

  // Build the meta values that feed @use:meta. @seo wins, then @post.
  const metaAttrs = {
    title: seo.title || (post && post.title) || business.name || '',
    description: seo.description || (post && post.summary) || business.tagline || '',
    canonical: seo.canonical || route,
    og_image: seo.og_image || (post && post.hero) || '',
  };
  const jsonLd = buildJsonLd(seo, business, route);

  const src = stripMetaBlocks(raw);
  const deps = new Set();
  const currentSlug = isBlog ? srcRel.replace(/^blog\//, '').replace(/\.html$/i, '') : null;
  const stitched = stitchHtml(src, deps, 0, { currentSlug, metaAttrs, jsonLd });

  const distRel = computeDistPath(srcRel);
  const record = {
    srcRel,
    route,
    distRel,
    isBlog,
    seo,
    page: pageMeta,
    post,
    links: extractLinks(src),
    blocks: extractBlocks(src),
    sourceBody: src,
    bytes: Buffer.byteLength(stitched),
    deps: [...deps],
  };

  // Perf-budget enforcement (Phase 8).
  const budget = loadPerfBudget();
  if (budget.max_page_html_kb) {
    const kb = record.bytes / 1024;
    if (kb > budget.max_page_html_kb) {
      fail(
        `${srcRel}: stitched HTML is ${kb.toFixed(1)}KB, over the ${budget.max_page_html_kb}KB budget (site/perf-budget.json:max_page_html_kb).`
      );
    }
  }
  if (budget.third_party_scripts_max !== undefined) {
    const thirdParty = countThirdPartyScripts(stitched);
    if (thirdParty > budget.third_party_scripts_max) {
      fail(
        `${srcRel}: ${thirdParty} third-party scripts, over the limit of ${budget.third_party_scripts_max} (site/perf-budget.json:third_party_scripts_max).`
      );
    }
  }

  // Incremental: with --changed, only WRITE dist for affected pages (we still
  // stitch everything so site/*.json stays consistent + deps are known).
  if (FLAGS.verify || FLAGS.stateOnly || !isAffected(record)) {
    return { record, written: false };
  }
  const distAbs = path.join(DIST_DIR, distRel);
  fs.mkdirSync(path.dirname(distAbs), { recursive: true });
  fs.writeFileSync(distAbs, stitched);
  return { record, written: true };
}

/** Whether a page's dist output must be rewritten given the --changed file. */
function isAffected(record) {
  if (!CHANGED) return true; // full build
  const changed = CHANGED.split(path.sep).join('/');
  if (changed === record.srcRel) return true; // the page itself
  if (changed.startsWith('partials/')) {
    // A partial changed → only pages that use it (incl. posts-list consumers
    // when a blog post changed elsewhere) need rewriting.
    const partialName = changed.replace(/^partials\//, '').replace(/\.html$/i, '');
    return record.deps.includes(partialName);
  }
  if (changed.startsWith('blog/')) {
    // A blog post changed → rewrite it + any page rendering posts-list.
    return changed === record.srcRel || record.deps.includes('posts-list');
  }
  if (changed.startsWith('pages/')) {
    // Another page changed → only that page (handled by the equality check
    // above); this one is unaffected.
    return false;
  }
  // assets/css, site/*, design-guide, etc. → rebuild everything (safe default).
  return true;
}

// ─── Drafts enumeration ─────────────────────────────────────────────────
function enumerateDrafts() {
  const out = { pages: [], posts: [] };
  for (const [dir, key] of [
    [path.join(PAGES_DIR, '_drafts'), 'pages'],
    [path.join(BLOG_DIR, '_drafts'), 'posts'],
  ]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of walk(dir, (p) => p.toLowerCase().endsWith('.html'))) {
      out[key].push(rel(f));
    }
    out[key].sort();
  }
  return out;
}

// ─── site/*.json derivation ─────────────────────────────────────────────
/**
 * Build a PageEntry from a processed record. Shared by pages.json + blog.json.
 */
function entryFromRecord(r) {
  const seo = r.seo || {};
  const pg = r.page || {};
  const entry = {
    path: r.srcRel,
    slug: r.route,
    title: seo.title || path.basename(r.srcRel, '.html'),
    is_draft: false,
  };
  if (seo.description) entry.description = seo.description;
  if (seo.primary_keyword) entry.primary_keyword = seo.primary_keyword;
  if (seo.secondary_keywords) entry.secondary_keywords = seo.secondary_keywords;
  if (seo.canonical) entry.canonical = seo.canonical;
  if (seo.og_image) entry.og_image = seo.og_image;
  if (seo.schema_type) entry.schema_type = seo.schema_type;
  if (seo.noindex !== undefined) entry.noindex = !!seo.noindex;
  if (pg.intent) entry.intent = pg.intent;
  if (pg.sections) entry.sections = pg.sections;
  if (pg.primary_cta) entry.primary_cta = pg.primary_cta;
  if (pg.last_human_edit) entry.last_human_edit = pg.last_human_edit;
  return entry;
}

function deriveSiteState(records) {
  const written = [];
  if (!fs.existsSync(SITE_DIR)) fs.mkdirSync(SITE_DIR, { recursive: true });

  // pages.json = pages/ inventory; blog.json = blog posts (excl. archive index).
  const pageRecords = records.filter((r) => r.srcRel.startsWith('pages/'));
  const blogRecords = records.filter((r) => r.isBlog);

  // pages.json
  const pages = pageRecords
    .map(entryFromRecord)
    .sort((a, b) => a.path.localeCompare(b.path));
  const pagesJson = { generated_by: 'siteState', count: pages.length, pages };

  // blog.json
  const posts = blogRecords
    .map((r) => {
      const e = entryFromRecord(r);
      const p = r.post || {};
      e.date = p.date || '';
      if (p.author) e.author = p.author;
      if (p.tags) e.tags = p.tags;
      if (p.hero) e.hero = p.hero;
      if (p.reading_minutes !== undefined) e.reading_minutes = p.reading_minutes;
      e.status = p.status === 'draft' ? 'draft' : 'published';
      return e;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.path.localeCompare(b.path)));
  const blogJson = { generated_by: 'siteState', count: posts.length, posts };

  // internal-links.json
  const allRoutes = new Set(records.map((r) => r.route));
  const edges = [];
  const inbound = new Set();
  for (const r of records) {
    for (const l of r.links) {
      // Normalise trailing slash for comparison but keep authored form in edge.
      edges.push({ from: r.route, to: l.to, anchor: l.anchor });
    }
  }
  const broken = [];
  for (const e of edges) {
    const target = e.to.split('#')[0].split('?')[0];
    if (target.startsWith('/') && /\/$/.test(target) === false && !/\.\w+$/.test(target)) {
      // tolerate links without trailing slash by also checking the slashed form
    }
    if (allRoutes.has(target)) {
      inbound.add(target);
    } else if (allRoutes.has(target + '/')) {
      inbound.add(target + '/');
    } else if (target.startsWith('/') && !/\.\w+$/.test(target)) {
      broken.push(`${e.from} -> ${e.to}`);
    }
  }
  edges.sort((a, b) =>
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.anchor.localeCompare(b.anchor)
  );
  const orphans = records
    .filter((r) => r.route !== '/' && !inbound.has(r.route))
    .map((r) => r.route)
    .sort();
  const internalLinksJson = {
    generated_by: 'siteState',
    edges,
    orphans,
    broken: [...new Set(broken)].sort(),
  };

  // blocks.json
  const blockMap = new Map();
  for (const r of records) {
    for (const b of r.blocks) {
      if (!blockMap.has(b)) blockMap.set(b, new Set());
      blockMap.get(b).add(r.srcRel);
    }
  }
  const blocks = [...blockMap.entries()]
    .map(([name, set]) => ({ name, used_on: [...set].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const blocksJson = { generated_by: 'siteState', blocks };

  // assets.json
  const imgRefs = {};
  for (const r of records) extractImgRefs(r.sourceBody, r.route, imgRefs);
  const budget = loadPerfBudget();
  const maxImageKb = budget.max_image_kb || 250;
  const imagesDir = path.join(ASSETS_DIR, 'images');
  const images = [];
  const referencedSrcs = new Set(Object.keys(imgRefs));
  if (fs.existsSync(imagesDir)) {
    for (const abs of walk(imagesDir)) {
      const relSrc = '/' + rel(abs); // e.g. /assets/images/hero.jpg
      const stat = fs.statSync(abs);
      const ref = imgRefs[relSrc];
      const img = {
        path: relSrc,
        size_kb: Math.round(stat.size / 1024),
        format: path.extname(abs).replace('.', '').toLowerCase(),
        used_on: ref ? [...ref.routes].sort() : [],
      };
      if (ref && ref.alt) img.alt = ref.alt;
      images.push(img);
      referencedSrcs.delete(relSrc);
    }
  }
  images.sort((a, b) => a.path.localeCompare(b.path));
  const oversize = images.filter((i) => i.size_kb > maxImageKb).map((i) => i.path).sort();
  const missingAlt = images
    .filter((i) => i.used_on.length && imgRefs[i.path] && imgRefs[i.path].hasEmptyAlt)
    .map((i) => i.path)
    .sort();
  const unused = images.filter((i) => i.used_on.length === 0).map((i) => i.path).sort();
  const assetsJson = {
    generated_by: 'siteState',
    images,
    oversize,
    missing_alt: missingAlt,
    unused,
  };

  // drafts.json
  const draftsJson = Object.assign({ generated_by: 'siteState' }, enumerateDrafts());

  const toWrite = [
    ['pages.json', pagesJson],
    ['blog.json', blogJson],
    ['internal-links.json', internalLinksJson],
    ['blocks.json', blocksJson],
    ['assets.json', assetsJson],
    ['drafts.json', draftsJson],
  ];
  if (!FLAGS.verify) {
    for (const [name, data] of toWrite) {
      fs.writeFileSync(path.join(SITE_DIR, name), stableStringify(data));
      written.push(`site/${name}`);
    }
  }
  return { written, pageCount: pages.length, postCount: posts.length, imageCount: images.length, issues: { orphans, broken, oversize, missingAlt } };
}

// ─── SEO assets (sitemap / robots / feed) ───────────────────────────────
function writeSeoAssets(records) {
  if (FLAGS.verify || FLAGS.stateOnly) return [];
  const business = loadBusiness();
  const base = (business.canonical_url || '').replace(/\/$/, '');
  const written = [];

  // sitemap.xml — published, indexable routes.
  const urlRoutes = records
    .filter((r) => !(r.seo && r.seo.noindex))
    .map((r) => r.route)
    .sort();
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urlRoutes.map((route) => `  <url><loc>${escapeXml(base + route)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  written.push('dist/sitemap.xml');

  // robots.txt
  const robots =
    'User-agent: *\n' +
    'Disallow: /_drafts/\n' +
    'Allow: /\n' +
    `Sitemap: ${base}/sitemap.xml\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots);
  written.push('dist/robots.txt');

  // feed.xml — last 20 published posts.
  const posts = getBlogPosts().slice(0, 20);
  const items = posts
    .map(
      (p) =>
        `    <item>\n` +
        `      <title>${escapeXml(p.title)}</title>\n` +
        `      <link>${escapeXml(base + p.route)}</link>\n` +
        `      <guid>${escapeXml(base + p.route)}</guid>\n` +
        (p.date ? `      <pubDate>${escapeXml(p.date)}</pubDate>\n` : '') +
        (p.summary ? `      <description>${escapeXml(p.summary)}</description>\n` : '') +
        `    </item>`
    )
    .join('\n');
  const feed =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n  <channel>\n' +
    `    <title>${escapeXml(business.name || 'Blog')}</title>\n` +
    `    <link>${escapeXml(base + '/blog/')}</link>\n` +
    (business.tagline ? `    <description>${escapeXml(business.tagline)}</description>\n` : '') +
    (items ? items + '\n' : '') +
    '  </channel>\n</rss>\n';
  fs.writeFileSync(path.join(DIST_DIR, 'feed.xml'), feed);
  written.push('dist/feed.xml');

  return written;
}

// ─── Assets passthrough ─────────────────────────────────────────────────
function copyAssets() {
  if (!fs.existsSync(ASSETS_DIR)) return 0;
  let copied = 0;
  for (const file of walk(ASSETS_DIR)) {
    const r = path.relative(ROOT, file).split(path.sep).join('/');
    const dest = path.join(DIST_DIR, r);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
    copied++;
  }
  return copied;
}

// ─── Main build ─────────────────────────────────────────────────────────
function fullBuild() {
  partialCache.clear();
  blogPostsCache = null;
  businessCache = null;
  perfBudgetCache = null;
  if (!FLAGS.verify && !FLAGS.stateOnly) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  const pages = [
    ...walk(PAGES_DIR, (p) => p.endsWith('.html')),
    ...walk(BLOG_DIR, (p) => p.endsWith('.html')),
  ];
  let written = 0;
  const records = [];
  for (const p of pages) {
    const r = processPage(p);
    if (r && r.skipped) continue;
    if (r && r.record) records.push(r.record);
    if (r && r.written) written++;
  }
  const state = deriveSiteState(records);
  const seoAssets = writeSeoAssets(records);
  const assetsCopied = FLAGS.verify || FLAGS.stateOnly ? 0 : copyAssets();
  return {
    written,
    assetsCopied,
    stateFilesWritten: [...state.written, ...seoAssets],
    pageCount: state.pageCount,
    postCount: state.postCount,
  };
}

function emitOutcome(result) {
  const outcome = {
    pagesWritten: result.written,
    stateFilesWritten: result.stateFilesWritten || [],
    warnings,
    elapsedMs: 0,
  };
  console.log(JSON.stringify(outcome));
}

// ─── Dev server ─────────────────────────────────────────────────────────
function startDevServer() {
  const http = require('http');
  const url = require('url');
  const port = Number(process.env.PORT || 4001);
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent(url.parse(req.url).pathname || '/');
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.join(DIST_DIR, pathname);
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>404</h1><p>${pathname} not found in dist/.</p>`);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  server.listen(port, () => {
    console.log(`[stitch] dev server: http://localhost:${port}/`);
  });
}

function watchAndRebuild() {
  const watchPaths = [PAGES_DIR, BLOG_DIR, PARTIALS_DIR, ASSETS_DIR, DESIGN_DIR, SITE_DIR];
  let pending = null;
  const trigger = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      try {
        const r = fullBuild();
        console.log(`[stitch] rebuild: ${r.written} pages, ${r.assetsCopied} assets`);
      } catch (e) {
        console.error(`[stitch] rebuild failed: ${e.message}`);
      }
    }, 80);
  };
  for (const dir of watchPaths) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: true }, trigger);
  }
  console.log('[stitch] watching for changes…');
}

// ─── Entry point ────────────────────────────────────────────────────────
(function main() {
  const started = Date.now();
  try {
    const result = fullBuild();
    if (errors.length > 0) {
      console.error(`[stitch] ${errors.length} error(s); aborting.`);
      process.exit(2);
    }
    const elapsed = Date.now() - started;
    console.log(
      `[stitch] ${result.written} pages, ${result.assetsCopied} assets, ${warnings.length} warnings, ${elapsed}ms`
    );
    emitOutcome(result);

    if (FLAGS.watch) watchAndRebuild();
    if (FLAGS.serve) startDevServer();
    if (!FLAGS.watch && !FLAGS.serve) process.exit(0);
  } catch (e) {
    console.error(`[stitch] fatal: ${e.message}`);
    process.exit(1);
  }
})();
