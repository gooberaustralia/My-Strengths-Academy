# my-strengths-academy

You are editing a static site. Source-of-truth files live on disk; partials
are inlined into `dist/` at stitch time. Read these BEFORE every visual edit:

1. `design-guide/current.md`  — LIVING design rules. Overrides BRIEF.md for visuals.
2. `design-guide/tokens.json` — colours, fonts, spacing. Drives `assets/css/tokens.css`.
3. `partials/header.html`, `partials/footer.html`, `partials/nav.html`
                              — shared chrome. NEVER inline a `<header>` / `<footer>` / `<nav>` into a page. Use the partials.
4. `BRIEF.md`                 — original brief. Use for INTENT only; do not regenerate visuals from it.

## Rules

- **New pages** go in `pages/<slug>.html`. Use the skeleton with `@use:meta`,
  `@use:header`, `@use:footer` markers + the `@seo` and `@page` comment
  blocks at the top.
- **New blog posts** go in `blog/<YYYY-MM-DD>-<slug>.html` based on
  `blog/_template.html`. Add the `@post` comment block at the top.
- **Site-wide changes** (header, footer, nav, tracking pixels) → edit the
  partial, not the pages.
- **Home page** can opt into `partials/header-home.html` by using
  `<!-- @use:header-home -->` instead of `<!-- @use:header -->`. Same
  pattern for any other per-page header variant.
- **If you change visual direction** (colours, type scale, layout system),
  ALSO update `design-guide/current.md` and `design-guide/tokens.json` in
  the same turn. Otherwise future pages will drift back to the old guide.
- **Drafts** live in `pages/_drafts/` and `blog/_drafts/`. They're excluded
  from sitemap and blocked in robots until a human promotes them.

## Machine-readable site state

The stitch step writes JSON registries under `site/` that downstream agents
read INSTEAD of re-reading source files (~20× token saving):

- `site/business.json`       — canonical business profile
- `site/pages.json`          — auto-derived inventory of `pages/`
- `site/blog.json`           — auto-derived inventory of `blog/`
- `site/seo.json`            — target keywords + competitor list
- `site/internal-links.json` — link graph + orphans + broken
- `site/assets.json`         — image registry (oversize / unused / missing alt)
- `site/blocks.json`         — section pattern registry
- `site/changelog.md`        — append-only history

You may READ all of these. You may WRITE: `pages/*`, `blog/*`,
`design-guide/current.md`, `design-guide/tokens.json`, `assets/css/*` (except
`tokens.css` which is generated). NEVER hand-edit auto-derived files.

## Skills

Active by default:

- `ui-ux-pro-max` — call for visual direction, palettes, layouts.
- `frontend-design` — call for component composition, polish.

## Build commands

- `node tools/stitch.js`            — full rebuild → `dist/`
- `node tools/stitch.js --verify`   — dry-run with validation
- `node tools/stitch.js --watch --serve` — dev server with live preview
