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

## Contributing / Feedback

Open an issue or reach out via the contact details on the site if you notice accessibility problems, broken links, or have ideas for new features (e.g., additional research write-ups, teaching resources, or a news feed).

---

_Static content © Harry Mayne. Assets remain the property of their respective authors and institutions._
