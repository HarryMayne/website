#!/usr/bin/env python3
import os
import re
import sys
import hashlib
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MIRROR_DIR = ROOT / "harrymayne.com_mirror"

SITE_HOSTS = {"harrymayne.com", "www.harrymayne.com"}

ASSET_EXTS = (
    ".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".webp", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf",
    ".mp4", ".webm", ".mov", ".avi", ".mp3", ".wav", ".json", ".txt",
)

ATTR_RE = re.compile(r"(?i)\b(href|src)\s*=\s*([\"\'])([^\"\']+)([\"\'])")
# Also handle lazy attrs like data-src
DATA_SRC_RE = re.compile(r"(?i)\bdata-src\s*=\s*([\"\'])([^\"\']+)([\"\'])")
SRCSET_RE = re.compile(r"(?i)\b(srcset|data-srcset)\s*=\s*([\"\'])([^\"\']+)([\"\'])")
CSS_URL_RE = re.compile(r"url\((['\"]?)(https?:|//)[^)]+\)")
CSS_IMPORT_RE = re.compile(r"@import\s+(['\"])(https?:|//)[^'\"]+\1")


def is_http_url(u: str) -> bool:
    return u.startswith("http://") or u.startswith("https://") or u.startswith("//")


def looks_like_asset(url: str) -> bool:
    low = url.lower().split("?")[0]
    return any(low.endswith(ext) for ext in ASSET_EXTS)


def sanitize_query_filename(path: str, query: str) -> str:
    if not query:
        return path
    tracked = ["utm_", "gclid", "fbclid", "mc_cid", "mc_eid", "ref", "ref_src", "_", "v"]
    parts = []
    for kv in query.split("&"):
        if not kv:
            continue
        k = kv.split("=", 1)[0].lower()
        if any(k.startswith(t) for t in tracked):
            continue
        parts.append(kv)
    if not parts:
        return path
    h = hashlib.sha1(query.encode("utf-8")).hexdigest()[:8]
    base, ext = os.path.splitext(path)
    return f"{base}.q{h}{ext}" if ext else f"{path}.q{h}"


def to_local_asset(url: str) -> str:
    if url.startswith("//"):
        url = "https:" + url
    p = urlparse(url)
    host = p.netloc
    path = p.path
    if p.query:
        path = sanitize_query_filename(path, p.query)
    return f"_ext/{host}{path}"


def to_local_page(path: str, frag: str) -> str:
    if path == "/" or path == "":
        return "index.html" + frag
    if path.endswith("/"):
        path = path[:-1]
    if not os.path.splitext(path)[1]:
        path = path.lstrip("/") + ".html"
    else:
        path = path.lstrip("/")
    return path + frag


def rewrite_html_file(p: Path) -> bool:
    s = p.read_text(encoding="utf-8", errors="ignore")

    def repl_attr(m):
        attr, q1, val, q2 = m.group(1).lower(), m.group(2), m.group(3), m.group(4)
        new = val
        if attr == "href":
            # Same-site page links -> local html; external assets remain assets logic below
            if val.startswith("/"):
                new = to_local_page(val, "")
            else:
                mabs = re.match(r"^https?://([^/]+)(/[^?#]*)?(\?[^#]*)?(#.*)?$", val)
                if mabs:
                    host, path, frag = mabs.group(1).lower(), mabs.group(2) or "/", mabs.group(4) or ""
                    if host in SITE_HOSTS:
                        new = to_local_page(path, frag)
            # Asset href (like PDFs) -> local _ext
            if is_http_url(val) and looks_like_asset(val) and not val.lower().endswith(('.css', '.js', '.mjs')):
                new = to_local_asset(val)
        elif attr == "src":
            # Avoid rewriting JS/CSS script/link assets; only media like images/video/fonts
            if is_http_url(val) and looks_like_asset(val) and not val.lower().endswith(('.js', '.mjs', '.css')):
                new = to_local_asset(val)
        return f"{m.group(1)}={q1}{new}{q2}"

    s2 = ATTR_RE.sub(repl_attr, s)

    # data-src for lazy-loaded images
    def repl_data_src(m):
        q1, val, q2 = m.group(1), m.group(2), m.group(3)
        new = val
        if is_http_url(val) and looks_like_asset(val):
            new = to_local_asset(val)
        return f"data-src={q1}{new}{q2}"

    s2 = DATA_SRC_RE.sub(repl_data_src, s2)

    def repl_srcset(m):
        q1, val, q2 = m.group(2), m.group(3), m.group(4)
        parts = [c.strip() for c in val.split(',') if c.strip()]
        out = []
        for c in parts:
            toks = c.split()
            if not toks:
                continue
            u = toks[0]
            desc = ' '.join(toks[1:])
            if is_http_url(u) and looks_like_asset(u):
                u = to_local_asset(u)
            out.append((u + ((' ' + desc) if desc else '')).strip())
        return f"{m.group(1)}={q1}{', '.join(out)}{q2}"

    s3 = SRCSET_RE.sub(repl_srcset, s2)

    # Inline style background-image URLs inside HTML
    STYLE_URL_RE = re.compile(r"(?i)background-image\s*:\s*url\((['\"]?)(https?:|//)[^)]+\)")
    def repl_style_url(m):
        full = m.group(0)
        start = full.find('(') + 1
        end = full.rfind(')')
        inner = full[start:end].strip().strip("'\"")
        if inner.startswith('//'):
            url = 'https:' + inner
        else:
            url = inner
        if looks_like_asset(url):
            local = to_local_asset(url)
            return full[:full.find('(')+1] + local + full[end:]
        return full

    s4 = STYLE_URL_RE.sub(repl_style_url, s3)

    if s4 != s:
        p.write_text(s4, encoding="utf-8")
        return True
    return False


def rewrite_css_file(p: Path) -> bool:
    s = p.read_text(encoding="utf-8", errors="ignore")
    orig = s
    css_dir = p.parent

    def repl_url(m):
        full = m.group(0)
        # extract inner URL
        start = full.find('(') + 1
        end = full.rfind(')')
        inner = full[start:end].strip().strip("'\"")
        if inner.startswith('//'):
            url = 'https:' + inner
        else:
            url = inner
        if looks_like_asset(url) and is_http_url(url):
            local_rel_to_root = to_local_asset(url)
            abs_target = (MIRROR_DIR / local_rel_to_root).resolve()
            rel_from_css = os.path.relpath(abs_target, css_dir)
            return f"url({rel_from_css})"
        return full

    def repl_import(m):
        full = m.group(0)
        quote = m.group(1)
        # extract between quotes
        start = full.find(quote)
        end = full.rfind(quote)
        inner = full[start+1:end]
        if inner.startswith('//'):
            url = 'https:' + inner
        else:
            url = inner
        if looks_like_asset(url) and is_http_url(url):
            local_rel_to_root = to_local_asset(url)
            abs_target = (MIRROR_DIR / local_rel_to_root).resolve()
            rel_from_css = os.path.relpath(abs_target, css_dir)
            return f"@import '{rel_from_css}'"
        return full

    s = CSS_URL_RE.sub(repl_url, s)
    s = CSS_IMPORT_RE.sub(repl_import, s)
    if s != orig:
        p.write_text(s, encoding="utf-8")
        return True
    return False


def main():
    changed_html = 0
    for p in MIRROR_DIR.rglob("*.html"):
        if "_ext" in p.parts:
            continue
        if rewrite_html_file(p):
            changed_html += 1

    # Do not touch CSS files in this mode (keeps CSS external paths intact)
    print(f"Rewrote {changed_html} HTML files for offline media assets (CSS/JS left external)")


if __name__ == "__main__":
    sys.exit(main())
