#!/usr/bin/env python3
"""
Blog Editor Server

Serves the editor UI and provides a REST API for draft management.
Run from the tools/blog-editor/ directory:
    python3 server.py [--port 4400]
"""

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import socketserver


class NoLookupHTTPServer(HTTPServer):
    """HTTPServer that skips the slow FQDN reverse-DNS lookup."""

    def server_bind(self):
        socketserver.TCPServer.server_bind(self)
        host, port = self.server_address[:2]
        self.server_name = host
        self.server_port = port

# Resolve paths relative to the repo
EDITOR_DIR = Path(__file__).resolve().parent
REPO_DIR = EDITOR_DIR.parent.parent
DOCS_DIR = REPO_DIR / "docs"
DRAFTS_DIR = DOCS_DIR / "blog" / ".drafts"
BLOG_DIR = DOCS_DIR / "blog"

DRAFTS_DIR.mkdir(parents=True, exist_ok=True)

PORT = 4400
if "--port" in sys.argv:
    PORT = int(sys.argv[sys.argv.index("--port") + 1])

MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".otf": "font/otf",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".map": "application/json",
}


def guess_mime(path):
    ext = Path(path).suffix.lower()
    return MIME_TYPES.get(ext, "application/octet-stream")


# ----------------------------------------------------------------
#  Talk to Claude launcher
# ----------------------------------------------------------------

VSCODE_CLI_FALLBACK = "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"


def launch_claude_session(slug, draft_file):
    """Open the website repo + draft in VS Code, then start Claude Code
    (via the user's `warclaude` alias) in a fresh integrated terminal.

    Typing into the terminal uses System Events keystrokes, so the process
    running this server needs Accessibility permission (macOS prompts once).
    """
    code_cli = shutil.which("code") or VSCODE_CLI_FALLBACK
    try:
        subprocess.run(
            [code_cli, str(REPO_DIR), str(draft_file)],
            check=False, timeout=30,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        print(f"[talk-to-claude] Failed to open VS Code: {e}")
        return

    prompt = (
        f"Blog collaborator mode: we are working on my blog draft '{slug}' at "
        f"docs/blog/.drafts/{slug}/draft.json. Read the 'Blog Collaborator Mode' "
        f"section of CLAUDE.md, then read the draft, then check in with me — "
        f"act as a collaborator and researcher on this post."
    )
    shell_line = f'warclaude "{prompt}"'
    # Escape for embedding inside an AppleScript string literal
    as_line = shell_line.replace("\\", "\\\\").replace('"', '\\"')

    applescript = f'''
    repeat 60 times
        if application "Visual Studio Code" is running then exit repeat
        delay 0.5
    end repeat
    delay 2
    tell application "Visual Studio Code" to activate
    delay 0.8
    tell application "System Events"
        -- Ctrl+Shift+` : open a NEW integrated terminal at the workspace root
        keystroke "`" using {{control down, shift down}}
        delay 1.5
        keystroke "{as_line}"
        delay 0.3
        key code 36
    end tell
    '''
    try:
        result = subprocess.run(
            ["osascript", "-e", applescript],
            capture_output=True, text=True, timeout=90,
        )
        if result.returncode != 0:
            print(f"[talk-to-claude] osascript failed: {result.stderr.strip()}")
            print("[talk-to-claude] The server process likely needs Accessibility "
                  "permission (System Settings > Privacy & Security > Accessibility).")
    except Exception as e:
        print(f"[talk-to-claude] osascript error: {e}")


class EditorHandler(SimpleHTTPRequestHandler):
    """Routes requests to static files or the API."""

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        # API routes
        if path == "/api/drafts":
            return self.api_list_drafts()
        if path.startswith("/api/drafts/") and path.endswith("/preview"):
            slug = path.split("/")[3]
            return self.api_preview(slug)
        if path.startswith("/api/drafts/") and "/assets/" in path:
            return self.api_serve_draft_asset(path)
        if path.startswith("/api/drafts/"):
            slug = path.split("/")[3]
            return self.api_get_draft(slug)

        # Static file serving with multiple mounts
        self.serve_static(path)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        if path.startswith("/api/drafts/"):
            slug = path.split("/")[3]
            return self.api_save_draft(slug)

        self.send_error(404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        if path == "/api/drafts":
            return self.api_create_draft()
        if path.startswith("/api/drafts/") and path.endswith("/upload"):
            slug = path.split("/")[3]
            return self.api_upload_image(slug)
        if path.startswith("/api/drafts/") and path.endswith("/publish"):
            slug = path.split("/")[3]
            return self.api_publish(slug)
        if path.startswith("/api/drafts/") and path.endswith("/talk-to-claude"):
            slug = path.split("/")[3]
            return self.api_talk_to_claude(slug)

        self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)

        if path.startswith("/api/drafts/"):
            slug = path.split("/")[3]
            return self.api_delete_draft(slug)

        self.send_error(404)

    # ----------------------------------------------------------------
    #  Static file serving
    # ----------------------------------------------------------------

    def serve_static(self, path):
        """Serve files from multiple directories."""
        if path == "/":
            path = "/index.html"

        routes = [
            # Editor HTML pages
            ("/", EDITOR_DIR / "html"),
            # Built JS
            ("/js/", EDITOR_DIR / "dist"),
            # Editor CSS
            ("/css/", EDITOR_DIR / "css"),
            # Vendor files (KaTeX etc)
            ("/vendor/", EDITOR_DIR / "vendor"),
            # Blog/docs files (CSS, assets, fonts)
            ("/docs/", DOCS_DIR),
        ]

        for prefix, base_dir in routes:
            if path.startswith(prefix):
                rel = path[len(prefix):]
                file_path = base_dir / rel
                if file_path.is_file():
                    return self.serve_file(file_path)

        # Fallback: try editor html dir directly
        file_path = EDITOR_DIR / "html" / path.lstrip("/")
        if file_path.is_file():
            return self.serve_file(file_path)

        self.send_error(404)

    def serve_file(self, file_path):
        mime = guess_mime(str(file_path))
        try:
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", len(data))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        except BrokenPipeError:
            pass  # Client disconnected, ignore
        except Exception as e:
            try:
                self.send_error(500, str(e))
            except BrokenPipeError:
                pass

    # ----------------------------------------------------------------
    #  API: Drafts
    # ----------------------------------------------------------------

    def api_list_drafts(self):
        drafts = []
        if DRAFTS_DIR.exists():
            for d in sorted(DRAFTS_DIR.iterdir()):
                if d.is_dir() and not d.name.startswith("."):
                    draft_file = d / "draft.json"
                    info = {"slug": d.name, "metadata": {}, "wordCount": 0, "modified": 0}
                    if draft_file.exists():
                        try:
                            data = json.loads(draft_file.read_text())
                            info["metadata"] = data.get("metadata", {})
                            info["modified"] = draft_file.stat().st_mtime
                            # Rough word count from content
                            content = data.get("content", {})
                            text = self._extract_text(content)
                            info["wordCount"] = len(text.split()) if text.strip() else 0
                        except Exception:
                            pass
                    drafts.append(info)
        # Sort by modified time, newest first
        drafts.sort(key=lambda d: d.get("modified", 0), reverse=True)
        self.send_json(drafts)

    def api_get_draft(self, slug):
        draft_file = DRAFTS_DIR / slug / "draft.json"
        if not draft_file.exists():
            return self.send_json({"metadata": {}, "content": {}})
        data = json.loads(draft_file.read_text())
        self.send_json(data)

    def api_create_draft(self):
        body = self.read_json()
        slug = body.get("slug", "").strip()
        if not slug:
            return self.send_error(400, "Missing slug")
        draft_dir = DRAFTS_DIR / slug
        draft_dir.mkdir(parents=True, exist_ok=True)
        (draft_dir / "assets").mkdir(exist_ok=True)
        draft_file = draft_dir / "draft.json"
        if not draft_file.exists():
            # Derive a human-readable title from the slug
            title = " ".join(word.capitalize() for word in slug.split("-"))
            draft_file.write_text(json.dumps({
                "metadata": {"title": title},
                "content": {}
            }, indent=2))
        self.send_json({"ok": True, "slug": slug})

    def api_save_draft(self, slug):
        draft_dir = DRAFTS_DIR / slug
        draft_dir.mkdir(parents=True, exist_ok=True)
        body = self.read_json()
        draft_file = draft_dir / "draft.json"
        draft_file.write_text(json.dumps(body, indent=2, ensure_ascii=False))
        self.send_json({"ok": True})

    def api_delete_draft(self, slug):
        draft_dir = DRAFTS_DIR / slug
        if draft_dir.exists():
            shutil.rmtree(draft_dir)
        self.send_json({"ok": True})

    def api_upload_image(self, slug):
        draft_dir = DRAFTS_DIR / slug
        assets_dir = draft_dir / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            return self.send_error(400, "Expected multipart/form-data")

        # Parse multipart
        boundary = content_type.split("boundary=")[-1].strip()
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # Simple multipart parser
        parts = body.split(f"--{boundary}".encode())
        for part in parts:
            if b"filename=" not in part:
                continue
            header_end = part.find(b"\r\n\r\n")
            if header_end == -1:
                continue
            headers_raw = part[:header_end].decode("utf-8", errors="replace")
            file_data = part[header_end + 4:]
            if file_data.endswith(b"\r\n"):
                file_data = file_data[:-2]

            # Extract filename
            filename = "image.png"
            for line in headers_raw.split("\r\n"):
                if "filename=" in line:
                    parts2 = line.split("filename=")
                    if len(parts2) > 1:
                        filename = parts2[1].strip('"').strip("'")
                    break

            # Sanitize filename
            filename = os.path.basename(filename)
            if not filename:
                filename = f"image_{int(time.time())}.png"

            # Deduplicate
            target = assets_dir / filename
            if target.exists():
                stem = target.stem
                ext = target.suffix
                i = 1
                while target.exists():
                    target = assets_dir / f"{stem}_{i}{ext}"
                    i += 1

            target.write_bytes(file_data)
            url = f"/api/drafts/{slug}/assets/{target.name}"
            return self.send_json({"ok": True, "url": url, "filename": target.name})

        self.send_error(400, "No file found in upload")

    def api_serve_draft_asset(self, path):
        # /api/drafts/<slug>/assets/<filename>
        parts = path.strip("/").split("/")
        if len(parts) < 5:
            return self.send_error(404)
        slug = parts[2]
        filename = "/".join(parts[4:])
        file_path = DRAFTS_DIR / slug / "assets" / filename
        if file_path.is_file():
            return self.serve_file(file_path)
        self.send_error(404)

    def api_preview(self, slug):
        """Generate a live preview using the export logic from the JS side.
        For now, serve a simple HTML page that loads the draft and renders it."""
        draft_file = DRAFTS_DIR / slug / "draft.json"
        if not draft_file.exists():
            return self.send_error(404, "Draft not found")

        data = json.loads(draft_file.read_text())
        metadata = data.get("metadata", {})
        content = data.get("content", {})

        # Build a preview page that includes the blog styles
        html = self._build_preview_html(slug, metadata, content)
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", len(html.encode()))
        self.end_headers()
        self.wfile.write(html.encode())

    def api_publish(self, slug):
        body = self.read_json()
        html = body.get("html", "")
        if not html:
            return self.send_error(400, "Missing html")

        # Write the HTML file
        target = BLOG_DIR / f"{slug}.html"
        target.write_text(html, encoding="utf-8")

        # Copy assets
        draft_assets = DRAFTS_DIR / slug / "assets"
        pub_assets = BLOG_DIR / "assets" / slug
        if draft_assets.exists() and any(draft_assets.iterdir()):
            pub_assets.mkdir(parents=True, exist_ok=True)
            for f in draft_assets.iterdir():
                if f.is_file():
                    shutil.copy2(f, pub_assets / f.name)

        # Update index.html writing section
        draft_file = DRAFTS_DIR / slug / "draft.json"
        if draft_file.exists():
            data = json.loads(draft_file.read_text())
            metadata = data.get("metadata", {})
            self._add_to_index(slug, metadata)

        self.send_json({"ok": True, "path": str(target)})

    # ----------------------------------------------------------------
    #  Talk to Claude: open draft in VS Code + launch Claude Code
    # ----------------------------------------------------------------

    def api_talk_to_claude(self, slug):
        if not re.fullmatch(r"[a-zA-Z0-9-]+", slug):
            return self.send_error(400, "Invalid slug")
        draft_file = DRAFTS_DIR / slug / "draft.json"
        if not draft_file.exists():
            return self.send_error(404, "Draft not found")
        # Launch in a background thread so autosave requests aren't blocked
        threading.Thread(
            target=launch_claude_session, args=(slug, draft_file), daemon=True
        ).start()
        self.send_json({"ok": True})

    # ----------------------------------------------------------------
    #  Index.html update
    # ----------------------------------------------------------------

    def _add_to_index(self, slug, metadata):
        index_path = DOCS_DIR / "index.html"
        if not index_path.exists():
            return

        html = index_path.read_text()
        marker = '<div class="writing-list">'
        if marker not in html:
            return

        title = metadata.get("title", slug)
        desc = metadata.get("description", metadata.get("subtitle", ""))
        date = metadata.get("date", "")

        # Check if entry already exists
        entry_href = f'href="blog/{slug}.html"'
        if entry_href in html:
            return  # Already listed

        new_entry = f'''
        <div class="writing-entry">
          <span class="writing-date">{self._escape(date)}</span>
          <div class="writing-info">
            <a href="blog/{slug}.html" class="writing-title">{self._escape(title)}</a>
            <span class="writing-desc">{self._escape(desc)}</span>
          </div>
        </div>'''

        # Insert after the writing-list div opening
        insert_pos = html.index(marker) + len(marker)
        html = html[:insert_pos] + new_entry + html[insert_pos:]
        index_path.write_text(html)

    # ----------------------------------------------------------------
    #  Preview HTML builder (server-side, simple)
    # ----------------------------------------------------------------

    def _build_preview_html(self, slug, metadata, content):
        content_html = self._render_content(content, slug)
        title = metadata.get("title", "Untitled")
        subtitle = metadata.get("subtitle", "")
        date = metadata.get("date", "")
        authors = metadata.get("authors", "")
        links = metadata.get("links", [])

        links_html = ""
        for link in links:
            links_html += f'\n          <span class="blog-meta-sep">&middot;</span>\n          <a href="{self._escape(link.get("url", ""))}">{self._escape(link.get("label", ""))}</a>'

        authors_html = ""
        if authors:
            authors_html = f'\n          <span class="blog-meta-authors">{self._escape(authors)}</span>'

        # Check for math
        has_math = '"mathInline"' in json.dumps(content) or '"mathDisplay"' in json.dumps(content)
        math_head = ""
        if has_math:
            math_head = """
  <link rel="stylesheet" href="/vendor/katex/katex.min.css"/>
  <script src="/vendor/katex/katex.min.js"></script>
  <script>
    function renderAllMath() {
      document.querySelectorAll('[data-math-preview]').forEach(function(el) {
        var latex = el.getAttribute('data-latex');
        var displayMode = el.tagName === 'DIV';
        try { katex.render(latex, el, {throwOnError: false, displayMode: displayMode}); }
        catch(e) { el.textContent = latex; }
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderAllMath);
    } else {
      renderAllMath();
    }
  </script>"""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>{self._escape(title)} | Preview</title>
  <link href="/docs/assets/css/site-2-ee27e6.webflow.shared.afb1fee4b.css" rel="stylesheet"/>
  <link href="/docs/css/site.css" rel="stylesheet"/>
  <link href="/docs/blog/blog.css" rel="stylesheet"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>{math_head}
</head>
<body>
  <div>
    <nav class="main-nav w-nav">
      <a href="#" class="name w-nav-brand">Harry Mayne</a>
      <div class="nav-links">
        <a href="#" class="nav-link w-nav-link">Research</a>
        <a href="#" class="nav-link w-nav-link">Writing</a>
        <a href="#" class="nav-link w-nav-link">About</a>
        <a href="#" class="nav-link w-nav-link">Teaching</a>
        <a href="#" class="nav-link w-nav-link">Contact</a>
      </div>
    </nav>

    <article class="blog-post">
      <header class="blog-header">
        <h1>{self._escape(title)}</h1>
        {"<p class='blog-subtitle'>" + self._escape(subtitle) + "</p>" if subtitle else ""}
      </header>
      <hr class="blog-divider"/>
      <div class="blog-meta">
        <div class="blog-meta-info">
          <span class="blog-date">{self._escape(date)}</span>{links_html}{authors_html}
        </div>
      </div>
      <hr class="blog-divider"/>

      <div class="blog-content">
{content_html}
      </div>
    </article>
  </div>

  <script src="/docs/blog/blog.js"></script>
</body>
</html>"""

    def _render_content(self, node, slug, depth=0):
        if not node or not isinstance(node, dict):
            return ""

        node_type = node.get("type", "")
        content = node.get("content", [])
        attrs = node.get("attrs", {})
        children = "".join(self._render_content(c, slug, depth + 1) for c in content)

        if node_type == "doc":
            return children
        elif node_type == "text":
            text = self._escape(node.get("text", ""))
            marks = node.get("marks", [])
            for mark in marks:
                mt = mark.get("type", "")
                ma = mark.get("attrs", {})
                if mt == "bold":
                    text = f"<strong>{text}</strong>"
                elif mt == "italic":
                    text = f"<em>{text}</em>"
                elif mt == "underline":
                    text = f"<u>{text}</u>"
                elif mt == "strike":
                    text = f"<s>{text}</s>"
                elif mt == "code":
                    text = f"<code>{text}</code>"
                elif mt == "link":
                    href = self._escape(ma.get("href", ""))
                    text = f'<a href="{href}">{text}</a>'
            return text
        elif node_type == "paragraph":
            return f"        <p>{children}</p>\n"
        elif node_type == "heading":
            level = attrs.get("level", 2)
            return f"        <h{level}>{children}</h{level}>\n"
        elif node_type == "bulletList":
            return f"        <ul>\n{children}        </ul>\n"
        elif node_type == "orderedList":
            return f"        <ol>\n{children}        </ol>\n"
        elif node_type == "listItem":
            return f"          <li>{children}</li>\n"
        elif node_type == "blockquote":
            return f"        <blockquote>\n{children}        </blockquote>\n"
        elif node_type == "codeBlock":
            return f"        <pre><code>{children}</code></pre>\n"
        elif node_type == "horizontalRule":
            return "        <hr/>\n"
        elif node_type == "hardBreak":
            return "<br/>"
        elif node_type == "mathInline":
            latex = attrs.get("latex", "")
            return f'<span data-math-preview data-latex="{self._escape(latex)}"></span>'
        elif node_type == "mathDisplay":
            latex = attrs.get("latex", "")
            return f'        <div data-math-preview data-latex="{self._escape(latex)}" style="text-align:center;margin:1.5em 0;"></div>\n'
        elif node_type == "sidenote":
            num = attrs.get("number", 1)
            # Content is HTML (rich text), pass through directly
            content = attrs.get("content", "")
            return f'<span class="blog-sidenote-ref">{num}</span>\n        <aside class="blog-sidenote"><span class="blog-sidenote-number">{num}</span> {content}</aside>\n'
        elif node_type == "figure":
            src = attrs.get("src", "")
            alt = self._escape(attrs.get("alt", ""))
            # Caption is HTML (rich text), pass through directly
            caption = attrs.get("caption", "")
            size = attrs.get("size", "full")
            if size == "medium":
                size_cls = "blog-figure blog-figure-sm"
            elif size == "small":
                size_cls = "blog-figure blog-figure-md"
            else:
                size_cls = "blog-figure"
            return f'        <figure class="{size_cls}">\n          <img src="{src}" alt="{alt}" loading="lazy"/>\n          <figcaption>{caption}</figcaption>\n        </figure>\n'
        elif node_type == "box":
            color = attrs.get("color", "grey")
            if color not in ("grey", "red", "blue", "green", "orange", "purple"):
                color = "grey"
            return f'        <div class="blog-box blog-box-{color}">\n{children}        </div>\n'
        elif node_type == "boxRow":
            return f'        <div class="blog-box-row">\n{children}        </div>\n'
        elif node_type == "boxCell":
            return f'        <div class="blog-box-cell">\n{children}        </div>\n'
        elif node_type == "citation":
            text = self._escape(attrs.get("text", ""))
            bibtex = self._escape(attrs.get("bibtex", ""))
            return f'        <section class="blog-citation">\n          <h2>Citation</h2>\n          <p class="blog-citation-text">{text}</p>\n          <pre class="blog-bibtex">{bibtex}</pre>\n        </section>\n'

        return children

    # ----------------------------------------------------------------
    #  Helpers
    # ----------------------------------------------------------------

    def _extract_text(self, node):
        if not isinstance(node, dict):
            return ""
        if node.get("type") == "text":
            return node.get("text", "")
        parts = []
        for child in node.get("content", []):
            parts.append(self._extract_text(child))
        return " ".join(parts)

    @staticmethod
    def _escape(s):
        return (
            str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        return json.loads(body)

    def send_json(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Suppress noisy API auto-save logs
        if args and "/api/drafts/" in str(args[0]) and "PUT" in str(args[0]):
            return
        super().log_message(format, *args)


def main():
    server = NoLookupHTTPServer(("127.0.0.1", PORT), EditorHandler)
    print(f"Blog Editor running at http://localhost:{PORT}")
    print(f"  Drafts: {DRAFTS_DIR}")
    print(f"  Blog:   {BLOG_DIR}")
    print(f"  Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
