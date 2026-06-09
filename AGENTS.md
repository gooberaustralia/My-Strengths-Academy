# AGENTS.md — Operating rules for AI agents working on my-strengths-academy

> Read this FIRST. This is a **GooberAI v2** site. It is plain HTML/CSS/JS built
> by a tiny zero-dependency stitch step. Follow these rules exactly so every
> edit stays consistent with the brand, the design guide, and the build system.
> (Human + Claude Code also read `CLAUDE.md`; this file is the portable,
> tool-agnostic contract for ANY external agent.)

---

## 0. Read these before editing anything (in order)

1. `design-guide/current.md` — LIVING design rules. Overrides BRIEF.md for visuals.
2. `design-guide/tokens.json` — colours, fonts, spacing (drives `assets/css/tokens.css`).
3. `site/business.json` — brand/business identity (name, tone, services, contact).
4. `site/pages.json` + `site/blog.json` — what exists, each page's intent + keyword.
5. `site/internal-links.json` — link graph, orphans, broken links.
6. `partials/header.html`, `footer.html`, `nav.html` — shared chrome.
7. `BRIEF.md` — original brief (intent only; the design guide overrides it).

Reading these (~15–20 KB) tells you the whole site. **Do not re-read all source
files for orientation** — read the JSON first, then open only the file you edit.

---

## 1. Project shape

```
BRIEF.md  CLAUDE.md  AGENTS.md  vercel.json  package.json
.goober-scaffold-version            ← "v2" marker
design-guide/  current.md  tokens.json  checkpoints/
partials/      meta header header-home nav footer tracking-head tracking-body-end
pages/         *.html  + _drafts/
blog/          _template.html  index.html  *.html  + _drafts/
assets/css/    tokens.css(generated) base.css components.css blog.css
site/          business.json pages.json blog.json seo.json internal-links.json
               assets.json blocks.json drafts.json perf-budget.json
               tracking.json locations.json  agents/<persona>.md  agents/audit-log.jsonl
tools/stitch.js                     ← build engine
dist/                               ← generated output (gitignored). NEVER hand-edit.
```

## 2. Page format (the source-of-truth API)

A page is HTML with comment markers. **Markers MUST be on their own line.**

```html
<!-- @seo title="…" description="…" canonical="/services/" primary_keyword="…"
     secondary_keywords=["…","…"] schema_type="Service" noindex=false -->
<!-- @page intent="…" sections=["hero","services","cta"] primary_cta="Get a quote"
     last_human_edit="YYYY-MM-DD" -->
<!DOCTYPE html><html lang="en">
<head>
  <!-- @use:meta -->          ← builds <title>/<meta>/OG/canonical/JSON-LD from @seo + business.json
</head>
<body class="page-services">
  <!-- @use:header -->        ← home page may use <!-- @use:header-home -->
  <main>
    <section id="hero" data-block="hero-v2">…</section>
  </main>
  <!-- @use:footer -->
</body></html>
```

Blog posts additionally start with:
```html
<!-- @post date="YYYY-MM-DD" author="…" tags=["…"] hero="/assets/images/blog/x.jpg"
     reading_minutes=5 status="published" -->   ← status="draft" to keep it unpublished
```

## 3. Hard rules — DO

- **New page** → `pages/<slug>.html` with `@seo` + `@page` + `@use:meta/header/footer`.
- **New post** → `blog/<YYYY-MM-DD>-<slug>.html` from `blog/_template.html`, add `@post`.
- **Site-wide chrome change** (header/footer/nav/tracking) → edit the **partial**, not pages.
- **Reuse approved section patterns** — see `data-block` names in `site/blocks.json`.
- **Match the design guide** — colours/fonts/spacing come from `design-guide/tokens.json`.
- **If you change visual direction**, also update `design-guide/current.md` + `tokens.json`.
- **Drafts** go in `pages/_drafts/` or `blog/_drafts/` and stay there until a human promotes.
- After edits, run `node tools/stitch.js --verify` — it must exit 0 (perf budget + validity).

## 4. Hard rules — DO NOT

- ❌ Inline a `<header>`/`<footer>`/`<nav>` into a page — use the partials.
- ❌ Hand-edit generated files: `assets/css/tokens.css`, anything in `dist/`,
  or auto-derived `site/{pages,blog,internal-links,assets,blocks,drafts}.json`.
- ❌ Change `site/business.json`, `design-guide/*`, `partials/header*`,
  `partials/footer.html`, `site/perf-budget.json`, or `site/tracking.json`
  unless your persona (`site/agents/<persona>.md`) explicitly allows it.
- ❌ Delete pages/posts or publish drafts (move out of `_drafts/`) autonomously.
- ❌ Put a marker mid-line — `@use:` markers must be alone on their line.
- ❌ Use brand-blue/decorative styles that contradict the design guide.

## 5. Build + deploy

```bash
node tools/stitch.js              # full build → dist/
node tools/stitch.js --verify     # dry-run: perf budget + HTML validity (use before commit)
node tools/stitch.js --state-only # re-derive site/*.json only
node tools/stitch.js --changed <path>   # incremental (changed file + dependents)
```
Vercel runs `node tools/stitch.js` and serves `dist/` (`vercel.json`). The local
preview and the live site are produced by the identical code path.

## 6. Autonomous agents (weekly audit / portal)

If you are an autonomous agent, you are bound by your **persona file**
`site/agents/<persona>.md` (e.g. `seo-optimizer.md`) which lists **Allowed
writes** and **Forbidden writes**. The host enforces them: any forbidden change
is reverted; only allowed changes are committed. Required workflow:

1. Work on a branch `agent/<persona>/<timestamp>` — never on `main` directly.
2. Read §0 files; make ≤3 surgical changes within your allowlist.
3. Skip any page whose `@page.last_human_edit` is within the last 7 days.
4. Run `node tools/stitch.js --verify`; revert if it fails.
5. Append one line per action to `site/agents/audit-log.jsonl`
   (`{ "ts", "agent", "action", "files", "rationale" }`).
6. Commit + open a PR for human review. Do not auto-merge.

Stay inside these rules and your edits will always match the brand, pass the
build, and deploy cleanly.
