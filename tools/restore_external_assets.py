#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIRROR_DIR = ROOT / "harrymayne.com_mirror"

# Convert _ext/<host>/... back to https://<host>/... for CSS/JS in link/script tags only
LINK_RE = re.compile(r"(?i)(<link[^>]+href=\")(?:_ext/)([^/]+)(/[^\"]+)(\")")
SCRIPT_RE = re.compile(r"(?i)(<script[^>]+src=\")(?:_ext/)([^/]+)(/[^\"]+)(\")")

def needs_restore(url_path: str) -> bool:
    low = url_path.lower()
    return low.endswith(('.css', '.js', '.mjs'))

def process_html(p: Path) -> bool:
    s = p.read_text(encoding='utf-8', errors='ignore')
    orig = s

    def repl_link(m):
        prefix, host, tail, q = m.groups()
        if needs_restore(tail):
            return f"{prefix}https://{host}{tail}{q}"
        return m.group(0)

    def repl_script(m):
        prefix, host, tail, q = m.groups()
        if needs_restore(tail):
            return f"{prefix}https://{host}{tail}{q}"
        return m.group(0)

    s = LINK_RE.sub(repl_link, s)
    s = SCRIPT_RE.sub(repl_script, s)
    if s != orig:
        p.write_text(s, encoding='utf-8')
        return True
    return False

def main():
    changed = 0
    for p in MIRROR_DIR.rglob('*.html'):
        if '_ext' in p.parts:
            continue
        if process_html(p):
            changed += 1
    print(f"Restored external CSS/JS in {changed} HTML file(s)")

if __name__ == '__main__':
    import sys
    sys.exit(main())
