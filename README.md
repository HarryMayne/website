# harrymayne.com – Local Mirror

<div align="center">

```

```

</div>

---

## Live Site

- Website: **[harrymayne.github.io/website](https://harrymayne.github.io/website/)**
- Custom domain: redirects from **harrymayne.com**

This repository contains the static assets served by GitHub Pages. Everything inside `docs/` is published directly.

## Repository Structure

| Path | Purpose |
| --- | --- |
| `docs/index.html`, `docs/oxford.html`, `docs/oxmedica.html`, `docs/stanford.html` | Main pages of the site. |
| `docs/css/site.css` | Small layer of custom overrides on top of the mirrored stylesheet. |
| `docs/js/site.js` | Navigation smoothing + modal behaviour implemented after removing Webflow runtime dependencies. |
| `docs/_ext/` | Downloaded assets (fonts, images, PDFs) from the original Webflow export. `_ext` is published by GitHub Pages via the `.nojekyll` marker. |
| `tools/` | Utility scripts used during mirroring/offline rewriting (kept for provenance). |

## Working Locally

1. Clone the repo: `git clone https://github.com/HarryMayne/website.git`
2. Install nothing—this is a static site.
3. Preview: `cd docs && python3 -m http.server 8000` then open `http://localhost:8000/`.

If you make changes, commit/push to `main`; GitHub Pages will redeploy automatically from `docs/`.

## Human × AI Workflow

- Initial scaffolding and much of the templated markup were produced by large language models (Claude Code, OpenAI Codex).
- Content decisions, accessibility fixes, form replacement, and modal reimplementation were reviewed and edited manually.
- The history in this repo documents that collaboration and should make future maintenance straightforward.

## Roadmap / Future Features

### High Priority

- [ ] **Fix missing assets** - Add favicon, touch icons, and placeholder images (see `ISSUE_MISSING_ASSETS.md`)
- [ ] **Mobile responsiveness** - Improve layout for phones and tablets (navigation menu, teaching grids, publication cards)
- [ ] **Compact layout improvements** - Reduce whitespace/gaps between sections for a tighter design

### Medium Priority

- [ ] **Interactive travel map** - World map showing places visited with clickable markers that open photo galleries for each location
- [ ] **Dark mode toggle** - Add theme switcher respecting `prefers-color-scheme`
- [ ] **Blog section expansion** - Integrate blog posts from Substack into the site; add more resources with a proper blog post format
- [ ] **Search functionality** - Search across publications and teaching materials
- [ ] **Publication filters** - Filter papers by year, topic, or venue

### Low Priority / Nice to Have

- [ ] **News/updates feed** - RSS or JSON feed of latest publications and updates
- [ ] **Performance optimization** - Lazy load images, optimize font loading, add resource hints
- [ ] **Print stylesheet** - Clean print version for CV and publications
- [ ] **i18n support** - Multi-language support (if needed for international collaborations)
- [ ] **Analytics dashboard** - Simple page view tracking visualization

### Technical Debt

- [ ] **Consolidate CSS** - Merge Webflow CSS with custom overrides where possible
- [ ] **Semantic HTML audit** - Improve heading hierarchy and landmark regions
- [ ] **Accessibility improvements** - Add skip links, improve color contrast, ARIA labels
- [ ] **Meta tags** - Add Open Graph and Twitter card meta tags for link previews
- [ ] **Structured data** - Add JSON-LD schema for publications (Scholar, academic profiles)

### Content Updates

- [ ] **Update publications** - Keep research section current with new papers
- [ ] **Teaching materials** - Add new course content as available
- [ ] **Profile photo** - Consider professional headshot update
- [ ] **CV sync** - Ensure downloadable CV matches website content

---

## Contributing / Feedback

Open an issue or reach out via the contact details on the site if you notice accessibility problems, broken links, or have ideas for new features (e.g., additional research write-ups, teaching resources, or a news feed).

---

_Static content © Harry Mayne. Assets remain the property of their respective authors and institutions._
