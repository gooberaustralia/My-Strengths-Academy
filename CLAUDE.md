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

<!-- goober:launch:start -->
## Launch

Every service this site needs is provisioned as a Vercel environment variable, never as a literal value in HTML, JS, or this repo. Read this before wiring any form, lead hook, or third-party call.

### Hosting: on Vercel
- The site deploys to Vercel from this folder. `.vercel/project.json` links it to the right Vercel project. Never delete it or hand-edit the ids.

### Email: on Vercel
Env vars: `EMAIL_PROVIDER`, `SENDGRID_API_KEY`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`
- Every contact or quote form POSTs to `/api/enquiry`. Never a third-party form service, never a `mailto:` action.
- Never hardcode an email address or an API key in HTML or JS. `api/enquiry.js` and `api/_autoreply.js` already read these env vars, with the baked defaults kept as a fallback.

### CRM connector (optional): skipped
Env vars: `GOOBER_CONNECTOR_ID`, `GOOBER_CONNECTOR_KEY`, `GOOBER_CONNECTOR_ENDPOINT`
- Lead hooks POST to `/api/lead` with no key in the page. `window.gooberLead()` already does this. Never add a connector key to HTML or JS.
- Sites Goober does not manage after launch leave this item off. It is optional.

### Analytics (optional): not set
- GA4 and Google Ads ids live in `site/tracking.json` and are rendered into `partials/tracking-head.html`. They are not secret and are safe in the page.

### Domain (optional): not set
- The production domain is whatever is connected in the Domains panel. Never hardcode a domain in HTML or JS. Read `site/business.json`, field `canonical_url`.

After any publish, run the smoke test and fix red items before reporting done. When a new service is needed, add it as a launch item. Do not improvise a `.env` file.
<!-- goober:launch:end -->
