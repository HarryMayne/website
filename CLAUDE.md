# CLAUDE.md

This file provides context for AI assistants working on this codebase.

## Project Overview

This is the personal website for Harry Mayne, a PhD researcher at the University of Oxford working on LLM explainability and interpretability. The site showcases research publications, teaching experience, and provides contact information.

**Live site:** https://harrymayne.github.io/website/ (redirects from harrymayne.com)

## Tech Stack

- **Static HTML/CSS/JS** - No build system or framework
- **GitHub Pages** - Hosted from the `docs/` directory
- **Webflow origins** - Originally exported from Webflow, now maintained manually

## Repository Structure

```
website/
├── docs/                    # Published content (GitHub Pages root)
│   ├── index.html          # Main homepage
│   ├── oxford.html         # Oxford teaching page
│   ├── stanford.html       # Stanford teaching page
│   ├── oxmedica.html       # Oxmedica/Mawhiba teaching page
│   ├── css/
│   │   └── site.css        # Custom CSS overrides
│   ├── js/
│   │   └── site.js         # Navigation + modal functionality
│   ├── assets/             # Images, PDFs, fonts
│   └── _ext/               # External dependencies (webfonts)
├── tests/                   # Test scripts
├── tools/                   # Utility scripts from migration
├── README.md               # Project documentation
└── ISSUE_MISSING_ASSETS.md # Tracking missing files
```

## Key Files

| File | Purpose |
|------|---------|
| `docs/index.html` | Homepage with research, about, teaching, blog, and contact sections |
| `docs/oxford.html` | Oxford University teaching materials (Applied Analytical Statistics) |
| `docs/stanford.html` | Stanford University teaching materials (Machine Learning) |
| `docs/oxmedica.html` | Oxmedica/Mawhiba teaching materials (AI and Big Data) |
| `docs/css/site.css` | Custom styles layered on top of Webflow CSS |
| `docs/js/site.js` | Smooth scrolling and modal popup functionality |

## Development Commands

```bash
# Preview locally
cd docs && python3 -m http.server 8000
# Then open http://localhost:8000/

# Run asset tests
python3 tests/test_assets.py
```

## Architecture Notes

### CSS
- Main styles come from `assets/css/site-2-ee27e6.webflow.shared.afb1fee4b.css` (Webflow export)
- Custom overrides in `css/site.css` - keep these minimal
- Uses Manrope and Butler fonts

### JavaScript
- `site.js` handles two features:
  1. Smooth scrolling for anchor links (with reduced motion support)
  2. Modal popups for teaching materials (accessible keyboard navigation)

### Modals
- Teaching pages use a card/modal pattern
- Cards: `.grid-5 > div` (oxmedica) or `.grid-5-oxford > div` (oxford)
- Modals: `.container-2 > [class^="day"]` with `.popup` or `.popup-oxford` inside
- Close via click overlay, close button, or Escape key

## Known Issues

See `ISSUE_MISSING_ASSETS.md` for missing files:
- Favicon/icons: `assets/image5.png`, `assets/image6.png`
- Placeholder image: `assets/paper_placeholder.png`
- Some PDF files for oxmedica teaching materials

## Content Sections (index.html)

1. **Hero** - Name, title, social links, profile photo
2. **Research** - Publications grid with thumbnails
3. **About** - Education history and grants
4. **Teaching** - Links to Stanford, Oxford, Oxmedica pages
5. **Blog** - Cambridge economics interview questions resource
6. **Contact** - Email address

## Style Guidelines

- Keep changes minimal - avoid over-engineering
- Preserve Webflow class naming conventions
- Test across pages when modifying shared CSS/JS
- Ensure accessibility (keyboard navigation, screen readers)
- **Never use em-dashes** (---, &mdash;). Use commas, semicolons, or en-dashes instead.
- **Use LaTeX for equations** in blog posts. Include KaTeX via CDN in the `<head>` and use `$$...$$` for display math, `\(...\)` for inline math.

## Blog Posts

Blog posts live in `docs/blog/` with shared `blog.css` and `blog.js`. Post assets go in `docs/blog/assets/<post-slug>/`.

### Figures
- **Background removal**: All figure images should have white backgrounds removed (made transparent) so they blend with the site's beige background. Use PIL/Pillow with a threshold of R,G,B > 240 to identify white pixels and set alpha to 0.
- **Click-to-expand lightbox**: All `.blog-figure img` elements are clickable. Clicking opens a full-screen overlay showing the image larger. Click anywhere to close (no close button). This is handled automatically by `blog.js`.
- Use `blog-figure-sm` class for smaller charts/diagrams.

## Deployment

Push to `main` branch. GitHub Pages automatically deploys from `docs/`.
