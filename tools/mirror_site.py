#!/usr/bin/env python3
import os
import re
import sys
import time
import errno
import hashlib
import argparse
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler, HTTPSHandler
import ssl
from urllib.error import URLError, HTTPError


DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


class QuietRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def ensure_dir(path: str):
    try:
        os.makedirs(path, exist_ok=True)
    except OSError as e:
        if e.errno != errno.EEXIST:
            raise


def sanitize_query(path: str, query: str) -> str:
    # Drop common tracking params; if others exist, append a short hash
    if not query:
        return path
    # Keep only non-tracking params
    # This is a simplification: for static mirrors, queries typically control cache-busting
    # which we can safely discard or collapse.
    tracked = [
        "utm_",
        "gclid",
        "fbclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "ref_src",
        "_",
        "v",
    ]
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
    # Append a hash to keep uniqueness while keeping tidy filenames
    h = hashlib.sha1(query.encode("utf-8")).hexdigest()[:8]
    base, ext = os.path.splitext(path)
    if ext:
        return f"{base}.q{h}{ext}"
    else:
        return f"{path}.q{h}.html"


def url_to_local_path(base_netloc: str, out_dir: str, url: str, is_html_hint: bool = False, allowed_hosts: set = None) -> str:
    p = urlparse(url)
    # Normalize host
    netloc = p.netloc.lower()
    path = p.path
    if not path or path == "/":
        path = "/index.html"
    # If path ends with '/', treat as directory index
    if path.endswith("/"):
        path = path + "index.html"
    # If no extension and looks like a page, add .html
    if not os.path.splitext(path)[1]:
        if is_html_hint:
            path = path + ".html"
        else:
            # leave as-is for assets without extension
            pass
    # Sanitize query (strip typical trackers; hash otherwise)
    if p.query:
        path = sanitize_query(path, p.query)
    # Remove leading slash
    if path.startswith("/"):
        path = path[1:]
    # If asset/page is from an external host, place under _ext/<host>/
    if allowed_hosts is not None and netloc and netloc not in allowed_hosts:
        local_path = os.path.join(out_dir, "_ext", netloc, path)
    else:
        local_path = os.path.join(out_dir, path)
    ensure_dir(os.path.dirname(local_path))
    return local_path


def is_same_site(url: str, allowed_hosts: set) -> bool:
    try:
        host = urlparse(url).netloc.lower()
        return host in allowed_hosts
    except Exception:
        return False


def is_http_url(u: str) -> bool:
    return u.startswith("http://") or u.startswith("https://")


def should_download_asset(u: str) -> bool:
    # Basic filter for static assets
    exts = (
        ".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".webp", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf",
        ".mp4", ".webm", ".mov", ".avi", ".mp3", ".wav", ".json", ".txt",
    )
    path = urlparse(u).path.lower()
    return any(path.endswith(ext) for ext in exts)


HREF_SRC_RE = re.compile(r"(?i)\b(?:href|src)\s*=\s*['\"]([^'\"]+)['\"]")
SRCSET_RE = re.compile(r"(?i)\b(?:srcset|data-srcset)\s*=\s*['\"]([^'\"]+)['\"]")


def extract_links(base_url: str, html: str):
    links = set()
    for m in HREF_SRC_RE.finditer(html):
        raw = m.group(1).strip()
        if not raw or raw.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        abs_url = urljoin(base_url, raw)
        links.add(abs_url)
    return links


def extract_srcset_assets(base_url: str, html: str):
    assets = set()
    for m in SRCSET_RE.finditer(html):
        raw = m.group(1).strip()
        if not raw:
            continue
        parts = [c.strip() for c in raw.split(',') if c.strip()]
        for c in parts:
            url = c.split()[0]
            if not url or url.startswith(("data:", "javascript:")):
                continue
            abs_url = urljoin(base_url, url)
            assets.add(abs_url)
    return assets


CSS_URL_RE = re.compile(r"url\((['\"]?)([^)]+?)\1\)")
CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\()?(['\"]?)([^'\")]+)\1\)?")


def extract_css_assets(base_url: str, css_text: str):
    urls = set()
    for m in CSS_URL_RE.finditer(css_text):
        u = m.group(2).strip()
        if u.startswith(('data:', 'javascript:')):
            continue
        urls.add(urljoin(base_url, u))
    for m in CSS_IMPORT_RE.finditer(css_text):
        u = m.group(2).strip()
        if u.startswith(('data:', 'javascript:')):
            continue
        urls.add(urljoin(base_url, u))
    return urls


def fetch(opener, url: str, ua: str, timeout: int = 15):
    req = Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
    return opener.open(req, timeout=timeout)


def mirror_site(start_url: str, out_dir: str, allowed_hosts: set, max_pages: int = 2000, delay: float = 0.2):
    ensure_dir(out_dir)
    visited_pages = set()
    visited_assets = set()
    queue = [start_url]
    # Use an unverified SSL context to avoid certificate issues in sandboxed environments
    ctx = ssl._create_unverified_context()
    opener = build_opener(QuietRedirectHandler(), HTTPSHandler(context=ctx))

    pages_count = 0
    while queue and pages_count < max_pages:
        url = queue.pop(0)
        if url in visited_pages:
            continue
        if not is_same_site(url, allowed_hosts):
            continue
        try:
            with fetch(opener, url, DEFAULT_UA) as resp:
                ct = resp.headers.get("Content-Type", "").lower()
                data = resp.read()
        except HTTPError as e:
            print(f"[HTTP {e.code}] {url}")
            continue
        except URLError as e:
            print(f"[URLERR] {url} -> {e}")
            continue
        except Exception as e:
            print(f"[ERR] {url} -> {e}")
            continue

        visited_pages.add(url)
        is_html = "text/html" in ct or urlparse(url).path.endswith( ("/", ".html", ".htm") )
        local_path = url_to_local_path(next(iter(allowed_hosts)), out_dir, url, is_html_hint=True)
        try:
            with open(local_path, "wb") as f:
                f.write(data)
        except Exception as e:
            print(f"[WRITE-ERR] {local_path} -> {e}")
            continue

        pages_count += 1
        print(f"[PAGE] {url} -> {local_path}")

        if is_html:
            try:
                html = data.decode("utf-8", errors="ignore")
            except Exception:
                html = ""
            # Queue internal links and download same-site assets referenced
            for link in extract_links(url, html):
                # Download assets even from external hosts for completeness
                if should_download_asset(link):
                    if link in visited_assets:
                        continue
                    try:
                        with fetch(opener, link, DEFAULT_UA) as aresp:
                            adata = aresp.read()
                            asset_path = url_to_local_path(
                                next(iter(allowed_hosts)), out_dir, link, allowed_hosts=allowed_hosts
                            )
                            with open(asset_path, "wb") as af:
                                af.write(adata)
                            visited_assets.add(link)
                            print(f"  [ASSET] {link} -> {asset_path}")
                            # If CSS, pull its dependent assets as well
                            if asset_path.lower().endswith('.css'):
                                try:
                                    css_text = adata.decode('utf-8', errors='ignore')
                                except Exception:
                                    css_text = ''
                                for dep in extract_css_assets(link, css_text):
                                    if dep in visited_assets:
                                        continue
                                    if not should_download_asset(dep):
                                        continue
                                    try:
                                        with fetch(opener, dep, DEFAULT_UA) as depresp:
                                            depdata = depresp.read()
                                            deppath = url_to_local_path(next(iter(allowed_hosts)), out_dir, dep, allowed_hosts=allowed_hosts)
                                            ensure_dir(os.path.dirname(deppath))
                                            with open(deppath, 'wb') as df:
                                                df.write(depdata)
                                            visited_assets.add(dep)
                                            print(f"    [CSS-ASSET] {dep} -> {deppath}")
                                    except Exception as e:
                                        print(f"    [CSS-ASSET-ERR] {dep} -> {e}")
                    except Exception as e:
                        print(f"  [ASSET-ERR] {link} -> {e}")
                # Enqueue same-site HTML pages
                elif is_same_site(link, allowed_hosts):
                    if link not in visited_pages:
                        queue.append(link)

            # Also fetch srcset/data-srcset asset variants
            for asset_link in extract_srcset_assets(url, html):
                if asset_link in visited_assets:
                    continue
                if not should_download_asset(asset_link):
                    continue
                try:
                    with fetch(opener, asset_link, DEFAULT_UA) as aresp:
                        adata = aresp.read()
                        asset_path = url_to_local_path(
                            next(iter(allowed_hosts)), out_dir, asset_link, allowed_hosts=allowed_hosts
                        )
                        with open(asset_path, 'wb') as af:
                            af.write(adata)
                        visited_assets.add(asset_link)
                        print(f"  [SRCSET] {asset_link} -> {asset_path}")
                except Exception as e:
                    print(f"  [SRCSET-ERR] {asset_link} -> {e}")

        time.sleep(delay)

    print(f"\nDone. Pages: {len(visited_pages)}, Assets: {len(visited_assets)}")


def main():
    ap = argparse.ArgumentParser(description="Lightweight site mirroring tool (same-domain)")
    ap.add_argument("--base", required=True, help="Start URL, e.g., https://example.com/")
    ap.add_argument("--out", required=True, help="Output directory")
    ap.add_argument("--hosts", nargs="*", help="Allowed hosts (defaults to host of base)")
    ap.add_argument("--max-pages", type=int, default=2000, help="Max number of HTML pages to crawl")
    ap.add_argument("--delay", type=float, default=0.2, help="Delay between requests (seconds)")
    args = ap.parse_args()

    base = args.base
    if not is_http_url(base):
        print("--base must be an http(s) URL", file=sys.stderr)
        sys.exit(2)
    parsed = urlparse(base)
    if not parsed.netloc:
        print("--base must include a host", file=sys.stderr)
        sys.exit(2)
    hosts = set(h.lower() for h in (args.hosts if args.hosts else [parsed.netloc]))
    mirror_site(base, args.out, hosts, max_pages=args.max_pages, delay=args.delay)


if __name__ == "__main__":
    main()
