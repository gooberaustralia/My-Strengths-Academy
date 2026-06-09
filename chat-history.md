# Chat History — My Strengths Academy

## Session: 2026-05-13 / 2026-05-14

---

### Main Topics & Decisions

- **New sales page strategy**: Reviewed `NEW Sales Page.docx` and built a completely new landing page at `/homeV2` targeting **young men aged 16–20 directly** (vs. the current `index.html` which targets parents).
- **Tone shift**: New page uses bold/masculine copy — "level up", "brotherhood", "discipline", "drift vs build" — compared to the softer parent-focused tone of V1.
- **Separate page approach**: Built as `homeV2.html` (not replacing `index.html`) so it can be reviewed and made live independently when ready.
- **URL**: With `cleanUrls: true` in `vercel.json`, `homeV2.html` is automatically served at `/homeV2`.
- **Nav link added**: A "Home V2" link was added to `index.html` nav so the client can access the new page for review.

---

### Files Created or Materially Edited

| File | Action | Why |
|---|---|---|
| `homeV2.html` | Created | Full 13-section sales page from the docx brief |
| `homeV2-style.css` | Created | All new section styles; extends existing `style.css` tokens |
| `homeV2-script.js` | Created | FAQ accordion + interest form validation for V2 page |
| `index.html` | Edited | Added "Home V2" nav link pointing to `/homeV2` |

---

### Page Sections (homeV2 — all verified against docx)

1. Hero — "Stop Wasting Your Life Scrolling, Drifting & Playing Small" + 5 checklist items
2. Pain/Reality — 8 pain points, drift closing
3. Solution — Not X/Not Y contrast + 6 feature cards
4. Social Proof (students) — Robbie 16, Kai 19, Rana 21
5. Who It's For — 9 checklist items
6. Not For Everyone — 5 requirements + caveat
7. Transformation — vision list + 4 video placeholders
8. Founders — Dan Hardie + Diego Luna (full bios, credentials)
9. Parent Testimonials — Lisa (Castle Hill), Siobhan (Sutherland), Dave (Father of Jack)
10. What Members Get — 9 benefits + one-on-one upsell box
11. Price / Register Interest — $250 comparison, founding member form
12. Girls Academy band (purple, repeated throughout as CTA)
13. FAQ — 13 questions (accordion)
14. Final CTA — "Drift or Build"

---

### Open Questions / Follow-Ups

- [ ] **Hero GIF/video**: Placeholder currently uses `images/dan-smile.png`. Replace with 15-second looping GIF or `<video autoplay muted loop playsinline>` of Dan + Diego with students. See `TO CONFIGURE` comment in `homeV2.html` ~line 69.
- [ ] **Formspree form ID**: Replace `YOUR_FORM_ID` in `homeV2.html` ~line 768 with actual Formspree ID.
- [ ] **Girls Academy form link**: Replace `mailto:hello@mystrengths.com.au` ~line 852 with a proper form link when ready.
- [ ] **Video embeds**: 4 video thumbnail placeholders in Section 7 (Transformation) — swap in real Vimeo/YouTube embeds when footage is ready.
- [ ] **Dan's title**: Docx says "Teen therapist & Founder" — currently displayed as "Founder & Lead Mentor". Confirm preferred title.
- [ ] **Go-live decision**: When ready to make homeV2 the homepage, rename `index.html` → `index-v1.html` and `homeV2.html` → `index.html`.

---

### Commands & URLs

```bash
# Local preview (from project root)
npx serve .
# Then visit: http://localhost:3000/homeV2

# Deploy to Vercel
vercel --prod
```

- **Live site**: https://mystrengthsacademy.com.au
- **V2 preview URL**: https://mystrengthsacademy.com.au/homeV2
- **Vercel config**: `vercel.json` — `cleanUrls: true`, `trailingSlash: false`, CSP headers set

---

*File saved: chat-history.md written to project root.*
