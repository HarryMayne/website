# Blog Editor

Local WYSIWYG blog editor for harrymayne.com.

## Quick Start

```bash
# If menu bar app is installed, just click the "B" icon
# Otherwise, start manually:
cd tools/blog-editor
python3 server.py --port 4400
# Open http://localhost:4400
```

## Architecture

- **Editor**: TipTap (ProseMirror) rich text editor with custom extensions
- **Server**: Python stdlib HTTP server (no dependencies) with REST API
- **Storage**: Drafts saved as JSON in `docs/blog/.drafts/<slug>/draft.json`
- **Menu bar**: rumps-based macOS app at `/usr/local/performance_software/blog_editor/`

## Files

| File | Purpose |
|------|---------|
| `server.py` | HTTP server + REST API for drafts CRUD, image upload, publish |
| `src/editor.js` | Main editor: TipTap setup, toolbar, sidebar, metadata, save/load |
| `src/dashboard.js` | Draft list dashboard |
| `src/extensions/math.js` | Inline ($...$) and display math with live KaTeX |
| `src/extensions/sidenote.js` | Tufte-style sidenotes with expandable editor |
| `src/extensions/figure.js` | Figures with image upload, caption, size toggle |
| `src/extensions/citation.js` | Citation block with BibTeX |
| `src/extensions/box.js` | Nestable coloured-outline boxes with rows/columns |
| `src/extensions/slash-commands.js` | `/` command menu |
| `src/utils/api.js` | Fetch wrappers for the REST API |
| `src/utils/export-html.js` | TipTap JSON to blog HTML template converter |
| `html/` | Dashboard, editor, preview HTML pages |
| `css/editor.css` | Editor-specific styles |
| `build.js` | esbuild bundler config |

## Rebuilding JS

```bash
cd tools/blog-editor
npm install  # first time only
node build.js
```

## API Endpoints

- `GET /api/drafts` - List all drafts
- `POST /api/drafts` - Create draft (`{"slug": "..."}`)
- `GET /api/drafts/:slug` - Load draft
- `PUT /api/drafts/:slug` - Save draft
- `DELETE /api/drafts/:slug` - Delete draft
- `POST /api/drafts/:slug/upload` - Upload image (multipart)
- `GET /api/drafts/:slug/assets/:file` - Serve draft asset
- `GET /api/drafts/:slug/preview` - Server-rendered preview
- `POST /api/drafts/:slug/publish` - Publish to live blog

## Design Principles

1. **Simple enough to understand everything, flexible enough to do what I need.** Every control should be self-explanatory. No feature should require guessing.
2. **Match Google Docs conventions where possible.** Cmd+K for links, Cmd+B/I/U for formatting, word count methodology, etc.
3. **Live preview in editor.** TOC updates live as you type headings. Sidenotes appear in the margin in real time. Math renders immediately.
4. **Rich text everywhere text appears.** Captions, sidenotes, and any text field should support bold/italic/links via keyboard shortcuts.
5. **No data loss on tab switch.** Popovers and inputs must persist when the user switches browser tabs and returns.

## Heading Levels

- H1, H2, H3 are available in the editor
- In published blog posts, the post title is the page `<h1>`, so body headings typically start at H2
- H1 is available for flexibility but H2 is the standard section heading

## Figure Sizes

Three sizes cycle through via buttons:
- **Full** (100% width)
- **Med** (75% width, class: `blog-figure-sm`)
- **Sm** (55% width, class: `blog-figure-md`)

## Sidenotes

Sidenotes show as inline callout boxes in the editor (with a left accent border). In the published blog, they render as Tufte-style margin notes. Content is stored as HTML for rich text support.

## Boxes

Coloured-outline containers (`src/extensions/box.js`): schema is `box > boxRow+ > boxCell+`, cells hold any block content, so boxes nest inside boxes. Insert via the ▦ toolbar button or `/box`. Hovering a box reveals a control bar (innermost box only, via CSS `:has()`): 6 colour swatches (grey/red/blue/green/orange/purple), `+ Col` / `− Col` (horizontal splits), `+ Row` / `− Row` (vertical splits), and `×` to delete. Removing a column/row deletes the trailing cells (undo with Cmd+Z). Shared markup/classes (`blog-box`, `blog-box-row`, `blog-box-cell`, `blog-box-<color>`) are styled in `docs/blog/blog.css`, so editor, preview, and published post all match; editor-only control chrome lives in `css/editor.css`. Rows stack vertically on ≤479px screens. In `export-html.js`, box children are indented so an `<h2>` inside a box never triggers the top-level section splitter.

## Lists

Tight, Notion-style spacing: `li { margin-bottom: 0.1em }` and `li p { margin: 0 }` in both `blog.css` and `editor.css` (Harry likes lists very tight). Don't reintroduce paragraph margins inside list items — TipTap wraps every list item's text in a `<p>`, which is where the old oversized gaps came from.

## Talk to Claude

Topbar button that saves the draft, then POSTs `/api/drafts/:slug/talk-to-claude`. The server (in a background thread) opens the website repo + draft.json in VS Code, then uses System Events keystrokes to open a new integrated terminal and run `warclaude "<context prompt>"` (Harry's alias for `claude --dangerously-skip-permissions`). Claude's collaborator behaviour is defined in the repo-root `CLAUDE.md` under "Blog Collaborator Mode". Requirements: VS Code CLI at the standard app path, the `warclaude` alias in `~/.zshrc`, and Accessibility permission for the process running `server.py` (macOS prompts on first use; failures are logged to the server log with a pointer).

## Testing

**Every change to the editor MUST be visually tested before considering it done.** Reading code is not enough; the editor has complex interactions between CSS, ProseMirror, and multiple loaded stylesheets (Webflow, blog, editor) that create subtle bugs invisible in source code.

After any change:
1. Start the server (`python3 server.py --port 4400`)
2. Open `http://localhost:4400` in a browser and create or open a test draft
3. Test every feature you changed by actually using it as a user would:
   - Type text, press Enter, create headings, switch between heading levels
   - Click every toolbar button and verify it works
   - Check the topbar doesn't shift at any point (type, press Enter, change heading levels)
   - Insert a sidenote, click into it, verify cursor appears, type text, use Cmd+B
   - Insert a figure, click each size button (Full/Med/Sm), verify the image resizes
   - Check nothing is cut off or overflowing at the viewport edges
4. Use screenshots or WebFetch to verify the visual state if you don't have computer use

Common pitfalls:
- The Webflow CSS (`site-2-*.css`) applies global styles to `body`, `figure`, `button`, `*` etc. that can override editor styles. Always use high-specificity selectors.
- `display: inline` elements can't have `min-width`, `min-height`, or show reliable cursors. Use `inline-block` or `block` for interactive elements.
- CSS Grid with fixed column widths is more stable than flexbox for toolbars (flex items shift when content changes width).
- The `normalizeSize()` function maps old data values to new ones; be careful not to accidentally map NEW values through the compat layer.

## Menu Bar App

Install: `/usr/local/performance_software/blog_editor/install.sh`
Uninstall: `launchctl bootout gui/$(id -u)/com.blog_editor.menubar`
