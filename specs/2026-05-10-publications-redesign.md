# Publications section redesign

**Date:** 2026-05-10
**Scope:** `docs/index.html`, `docs/css/site.css` — only the Selected Publications section. Nothing else on the site changes.

## Goal

Make the Selected Publications section do two new jobs:

1. **Spotlight the most recent paper** with a richer "headline" treatment that includes a figure and a short description, so visitors immediately understand what the latest work is.
2. **Surface venues prominently** for the rest of the publications — making clear at a glance that the work has appeared at top venues (ICLR, NeurIPS, EMNLP, ICML).

The visual language should feel editorial / human, not generic AI-template.

## Final design

The section heading "Selected Publications" stays. Below it, two visual blocks:

```
[ Selected Publications ]

┌─ FEATURED CARD ─────────────────────────────────────────┐
│  [chip: ICML 2026]                                       │
│  Title (bold, two lines, breaks at colon)               │
│  Two-sentence description (we-voice)                     │
│  Authors                                                 │
│  Affiliations                                            │
│  [Paper] [Code] [Blog] [Website]      [transparent figure]│
└──────────────────────────────────────────────────────────┘

[thumb] Title                                  ICLR 2026
        Authors
        [Paper] [Code] [Blog] [Website] [Inspect]
─────────────────────────────────────────────────────────
[thumb] Title                                  EMNLP 2025
        Authors
        [Paper] [Code] [Blog] [YouTube]
─────────────────────────────────────────────────────────
…
[thumb] Title                                  NeurIPS 2024
        Authors                                Oral · Top 0.5%
        [Paper] [Code] [Inspect]
```

### 1. Featured card (locked at v9)

The most recent paper (currently *A Positive Case for Faithfulness*, ICML 2026) gets a dedicated card above the publications list.

**Container:**
- Background: `#efe2c8` (a soft tinted block, slightly darker than the page's `#f8eed8`).
- Border-radius: `6px`. Padding: `28px 32px`. No border.
- Sits in the publications section, directly under the "Selected Publications" heading.

**Layout:** CSS grid, two columns `1fr 1.1fr` (figure column slightly wider), `gap: 36px`, `align-items: center` so columns share vertical centerline.

**Left column (text):**
1. **Venue chip** — `align-self: flex-start`. Filled dark pill: background `#2a2520`, text color `#f8eed8`, padding `5px 12px`, border-radius `999px`, font-size `11px`, font-weight `700`, letter-spacing `0.16em`, uppercase. Content: just the venue + year ("ICML 2026"). No dot. Bottom margin `14px`.
2. **Title** — Manrope bold, font-size `23px`, line-height `1.2`, letter-spacing `-0.018em`. Color `#2a2520`. Hard break at the colon via `<br>` so it always wraps to two lines (the natural split point for the current title). Bottom margin `12px`.
3. **Description** — Manrope, font-size `14.5px`, line-height `1.55`, color `#3a3127`. Bottom margin `14px`. Locked copy:
   > We present a new explanation faithfulness metric: do a model's explanations help you predict how it would behave in similar situations? Across 18 frontier models, we find self-explanations encode valuable information about the model's decision-making, though they remain imperfect. In the example here, the model explains a rule it uses to make decisions, then violates that rule in the counterfactual scenario.
4. **Authors** — Manrope, font-size `13.5px`, color `#3a3127`. Author names plain, **H. Mayne** in bold via `<strong>`. Bottom margin `2px`.
5. **Affiliations** — Manrope, font-size `12px`, color `#6b5d4a`. Comma-separated (not dots). Locked copy: "University of Oxford, UC Berkeley, Google DeepMind". Bottom margin `14px`.
6. **Action pills** — `Paper`, `Code`, `Blog`, `Website`. Background `#fdf8e9`, color `#4a3d2e`, border `1px solid #d6c39a`, padding `5px 13px`, border-radius `999px`, font-size `11.5px`, font-weight `500`. Each pill links out to the relevant URL.

**Right column (figure):**
- Container: `display: flex; align-items: center; justify-content: center; height: 100%`.
- Image: `width: 100%; height: auto; mix-blend-mode: multiply` (so anti-aliased white pixels in the transparent PNG blend cleanly into the tinted background — the current blog's transparent figures use this approach).
- Asset: a transparent-background version of the counterfactual-scenario figure (the existing `docs/blog/assets/faithfulness/fig4.png` is already prepared this way and can be reused — or copied to `docs/assets/paper_faithfulness_featured.png`).

### 2. Publications list (locked at list-v3-B)

Below the featured card, the rest of the publications list. Existing entries stay in their current order, minus the featured paper (which now lives in the card above).

**Row layout:** CSS grid, three columns `84px 1fr auto`, `gap: 24px`, `padding: 22px 0`, `align-items: start`, separated by `border-bottom: 1px solid #e2d5c3`. Last row no border.

**Column 1 — Thumbnail:** Existing 84×84 thumbnail images. White background, `1px solid #e2d5c3`, `border-radius: 4px`. Same images as today. (Decision deferred: we may drop thumbnails in a future pass — keep them for now.)

**Column 2 — Text:**
- **Title** — Manrope bold `15.5px`, line-height `1.35`, color `#2a2520`. No `<br>` injection; wrap naturally.
- **Authors** — Manrope `13px`, line-height `1.5`, color `#3a3127`. **H. Mayne** in bold.
- **Action pills** — same styling as the featured card pills (`#fdf8e9` background, `#d6c39a` border, etc.). `gap: 6px`, `margin-top: 8px`. Existing per-paper link sets stay.

**Column 3 — Venue (right-aligned, no box):**
- Vertical layout: `display: flex; flex-direction: column; align-items: flex-end; gap: 4px`. `padding-top: 3px` so it baseline-aligns with the title. `min-width: 100px`.
- **Venue text** — Manrope, font-size `14px`, font-weight `800`, color `#2a2520`, letter-spacing `0.04em`, `white-space: nowrap`. Format: "ICLR 2026", "EMNLP 2025", "NeurIPS 2025", etc. No background, no box — just bold typography.
- **Optional accolade** (only on entries with a distinction, currently the LingOly NeurIPS 2024 entry) — Manrope, font-size `11px`, font-weight `700`, color `#b8923f` (gold), letter-spacing `0.12em`, uppercase. Content example: "Oral · Top 0.5%". No box.

### 3. Color palette (used throughout)

| Token | Hex | Used for |
|---|---|---|
| `--page-bg` | `#f8eed8` | Page background (existing site value) |
| `--featured-tint` | `#efe2c8` | Featured card block background |
| `--ink` | `#2a2520` | Primary text + venue chip fill |
| `--ink-soft` | `#3a3127` | Secondary text (description, authors) |
| `--muted` | `#6b5d4a` | Tertiary text (affiliations, section heading) |
| `--rule-soft` | `#e2d5c3` | List row separators, thumbnail border |
| `--pill-bg` | `#fdf8e9` | Action pill background |
| `--pill-border` | `#d6c39a` | Action pill border |
| `--pill-text` | `#4a3d2e` | Action pill text |
| `--gold` | `#b8923f` | Oral / accolade text |

### 4. Typography

All text uses **Manrope** (already loaded site-wide). No serif, no italics. Weights used: `500` (pills), `700` (titles, accolade, venue chip), `800` (list venue text).

## Implementation notes

- All new styles go into `docs/css/site.css` under a new `/* === Publications redesign === */` section. The Webflow base CSS stays untouched.
- The existing `.publications-grid` markup in `docs/index.html` will be restructured: the first paper (Faithfulness) extracted into a new `.featured-paper` block; the remaining `.publication-entry` items re-styled via a new wrapper class (e.g. `.publications-list`) so existing class selectors don't conflict.
- The transparent figure asset already exists at `docs/blog/assets/faithfulness/fig4.png`. The featured card references it directly via that relative path — no asset duplication needed.
- The current pill classes (`.pill-paper`, `.pill-code`, etc.) apply distinct background colors per pill type. The redesign collapses these to a single neutral pill style. To avoid affecting other pages (Stanford / Oxford / Oxmedica teaching pages also use `.paper-pill`), the override is scoped: pills inside the new `.featured-paper` and `.publications-list` wrappers get the new neutral style; pills elsewhere keep their existing per-type colors.
- No JavaScript changes needed.

## Out of scope

- Other sections of the site (hero, About, Writing, Teaching, Contact).
- Mobile-specific styling tweaks beyond what naturally follows from the existing responsive grid (a separate pass after desktop is shipped).
- Removing thumbnails from the list (deferred — may revisit later).
- Updating the featured paper when a newer paper publishes (manual swap; no CMS).

## Open questions

None at time of writing. All visual decisions locked through 9 featured-card iterations and 3 list iterations.
