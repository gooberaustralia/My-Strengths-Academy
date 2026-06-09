# my-strengths-academy — Living design guide

> This is the **active** visual rule set. Updated as the site evolves.
> Overrides BRIEF.md for visuals. Companion files:
> - `design-guide/tokens.json` — machine-readable colours/fonts/spacing
> - `assets/css/tokens.css` — generated from tokens.json (don't hand-edit)

## Colour roles

- **Primary**:    `#2563EB` — top-level CTAs, brand chrome
- **Accent**:     `#F97316` — secondary CTAs, highlights, link-emphasis
- **Ink**:        `#0F172A` — body text, headlines on light backgrounds
- **Paper**:      `#FFFFFF` — page backgrounds
- **Muted**:      `#6B7280` — meta, captions, supporting text

## Typography

- **Headings**: Inter
- **Body**:     Inter
- **Radius**:   0.5rem

## Tone

professional

## WCAG-safe contrast pairs

- Ink on Paper
- Paper on Primary
- Paper on Ink
- Ink on Accent

## Section templates

- **Hero banner** — full-width Primary background, white headline, sub-line at 70%, pill CTA in Accent.
- **Feature grid** — 3 cards on Paper, 2px Accent top border, icon + 18pt heading + body at 70%.
- **CTA band** — single-row Ink panel with white headline + Accent pill button.
- **Testimonials** — 2-col layout, quote in heading-font, attribution in body-font.
- **Footer** — dark Ink band, logo recoloured to Paper, three column headers + link lists.

## Update triggers

This file gets regenerated when you click **Tools → Update design guide from
current site**. Claude re-reads every page and rewrites this file to reflect
what the site ACTUALLY does (not what the brief said).
