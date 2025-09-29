# harrymayne.com – Local Mirror

<div align="center">

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║             🤖  BUILT WITH A LITTLE HELP FROM FRIENDLY LLMs  🤖              ║
║                                                                              ║
║  ┌────────────────────────────────────────────────────────────────────────┐ ║
║  │                                                                        │ ║
║  │  The site (and this README) were drafted by AI collaborators—          │ ║
║  │  mainly Claude Code and OpenAI Codex—with human steering, review,      │ ║
║  │  and production edits.                                                 │ ║
║  │                                                                        │ ║
║  │  Treat this repo as a human-in-the-loop experiment: agents generate,   │ ║
║  │  humans curate, everything ships.                                      │ ║
║  │                                                                        │ ║
║  └────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║                  🚀 Co-designed with AI • Edited by a human 🚀                ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

</div>

---

## Overview

This folder contains a local mirror of your personal website so you can start working on it with coding assistants.

- Source: `https://harrymayne.com/`
- Mirror root: `docs/`
- Pages mirrored (same-domain): `index.html`, `oxford.html`, `oxmedica.html`, `stanford.html`
- External assets downloaded into: `docs/_ext/<host>/...`

Quick preview

- Serve locally: `cd docs && python3 -m http.server 8000`
- Open: `http://localhost:8000/`

Notes and limitations

- Links are not rewritten; site pages reference original URLs. When served locally, same-domain pages will work. External CDN assets (CSS/JS/images/fonts) are also downloaded into `_ext/`, but the HTML keeps the original CDN references. The site will therefore render fine when online. If you need a fully offline mirror with rewritten asset URLs, I can add a post-processor to point HTML to the local `_ext` copies.
- Query-string cache-busters (e.g., `?v=...`) are sanitized in saved filenames (a short hash is appended when needed).
- Crawling is limited to the same domain (`harrymayne.com`, `www.harrymayne.com`) to avoid pulling in unrelated sites.

Next steps

- If you want this to be a git repo, I can run `git init` in this project and (optionally) make the initial commit. Let me know if you want me to set a remote as well.
- If you plan to evolve this into a fully editable codebase (rather than a mirrored export), we can scaffold a static site (e.g., Astro/Next.js) and port content/styles into source files.
