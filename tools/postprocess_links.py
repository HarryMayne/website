#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SITE_HOSTS = (
    "harrymayne.com",
    "www.harrymayne.com",
)

# Only rewrite same-site page hrefs to local .html. Do NOT touch assets.
HREF_RE = re.compile(r"(?i)(href)\s*=\s*([\"\'])([^\"\']+)([\"\'])")


def to_local(path: str, frag: str) -> str:
    if path == "/" or path == "":
        return "index.html" + frag
    if path.endswith("/"):
        path = path[:-1]
    if not os.path.splitext(path)[1]:
        path = path.lstrip("/") + ".html"
    else:
        path = path.lstrip("/")
    return path + frag


def rewrite_href(url: str) -> str:
    if not url or url.startswith(("mailto:", "tel:", "javascript:", "data:")):
        return url
    if url.startswith("#"):
        return url
    m = re.match(r"^https?://([^/]+)(/[^?#]*)?(\?[^#]*)?(#.*)?$", url)
    if m:
        host, path, frag = m.group(1), m.group(2) or "/", m.group(4) or ""
        if host.lower() in SITE_HOSTS:
            return to_local(path, frag)
        return url
    if url.startswith("/"):
        return to_local(url, "")
    return url


def process_file(p: Path):
    text = p.read_text(encoding="utf-8", errors="ignore")

    def repl(m):
        attr, q1, val, q2 = m.group(1), m.group(2), m.group(3), m.group(4)
        if attr.lower() == "href":
            new = rewrite_href(val)
            return f"{attr}={q1}{new}{q2}"
        return m.group(0)

    new_text = HREF_RE.sub(repl, text)
    if new_text != text:
        p.write_text(new_text, encoding="utf-8")
        return True
    return False


def main():
    mirror_dir = ROOT / "harrymayne.com_mirror"
    changed = 0
    for p in mirror_dir.rglob("*.html"):
        if "_ext" in p.parts:
            continue
        if process_file(p):
            changed += 1
    print(f"Rewrote links in {changed} HTML file(s)")


if __name__ == "__main__":
    sys.exit(main())

