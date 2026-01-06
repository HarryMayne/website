#!/usr/bin/env python3
"""
Test script to verify all local assets referenced in HTML files exist.
"""

import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote

# Project paths
DOCS_DIR = Path(__file__).parent.parent / "docs"
HTML_FILES = list(DOCS_DIR.glob("*.html"))

def extract_local_references(html_content):
    """Extract all local file references from HTML content."""
    references = []

    # Match src="..." and href="..." attributes
    patterns = [
        r'src="([^"]+)"',
        r'href="([^"]+)"',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, html_content)
        for match in matches:
            # Skip external URLs, anchors, and mailto
            if match.startswith(('http://', 'https://', '#', 'mailto:', 'tel:')):
                continue
            # Skip empty references
            if not match.strip():
                continue
            # Strip anchor fragments from file references (e.g., index.html#research -> index.html)
            if '#' in match:
                match = match.split('#')[0]
                if not match:  # Was just an anchor
                    continue
            references.append(match)

    return references

def check_file_exists(html_file, reference):
    """Check if a referenced file exists relative to the HTML file."""
    # Handle URL-encoded characters
    reference = unquote(reference)

    # Resolve the path relative to the HTML file's directory
    html_dir = html_file.parent
    full_path = html_dir / reference

    # Normalize the path
    try:
        full_path = full_path.resolve()
    except (OSError, ValueError):
        return False, f"Invalid path: {reference}"

    if full_path.exists():
        return True, None
    else:
        return False, f"Missing: {reference}"

def test_all_assets_exist():
    """Main test: verify all local assets exist."""
    print("=" * 60)
    print("ASSET EXISTENCE TEST")
    print("=" * 60)

    all_passed = True
    total_refs = 0
    missing_refs = []

    for html_file in HTML_FILES:
        print(f"\nChecking: {html_file.name}")

        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()

        references = extract_local_references(content)
        file_missing = []

        for ref in references:
            total_refs += 1
            exists, error = check_file_exists(html_file, ref)
            if not exists:
                file_missing.append(ref)
                missing_refs.append((html_file.name, ref))
                all_passed = False

        if file_missing:
            print(f"  FAIL - {len(file_missing)} missing references:")
            for ref in file_missing:
                print(f"    - {ref}")
        else:
            print(f"  PASS - {len(references)} references OK")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"HTML files checked: {len(HTML_FILES)}")
    print(f"Total references: {total_refs}")
    print(f"Missing files: {len(missing_refs)}")

    if all_passed:
        print("\n*** ALL TESTS PASSED ***")
        return 0
    else:
        print("\n*** TESTS FAILED ***")
        return 1

def test_no_external_webflow_urls():
    """Test that no external Webflow URLs remain in HTML."""
    print("\n" + "=" * 60)
    print("EXTERNAL WEBFLOW URL TEST")
    print("=" * 60)

    webflow_patterns = [
        r'https?://[^"]*webflow\.com[^"]*',
        r'https?://[^"]*website-files\.com[^"]*',
        r'https?://[^"]*uploads-ssl\.webflow[^"]*',
    ]

    all_passed = True

    for html_file in HTML_FILES:
        print(f"\nChecking: {html_file.name}")

        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()

        found = []
        for pattern in webflow_patterns:
            matches = re.findall(pattern, content)
            found.extend(matches)

        if found:
            print(f"  FAIL - Found external Webflow URLs:")
            for url in found:
                print(f"    - {url}")
            all_passed = False
        else:
            print(f"  PASS - No external Webflow URLs")

    if all_passed:
        print("\n*** ALL TESTS PASSED ***")
        return 0
    else:
        print("\n*** TESTS FAILED ***")
        return 1

def test_css_js_load():
    """Test that CSS and JS files referenced actually exist and are non-empty."""
    print("\n" + "=" * 60)
    print("CSS/JS LOAD TEST")
    print("=" * 60)

    all_passed = True

    for html_file in HTML_FILES:
        print(f"\nChecking: {html_file.name}")

        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find CSS files
        css_refs = re.findall(r'<link[^>]+href="([^"]+\.css)"', content)
        # Find JS files
        js_refs = re.findall(r'<script[^>]+src="([^"]+\.js)"', content)

        for ref in css_refs + js_refs:
            if ref.startswith('http'):
                continue

            full_path = html_file.parent / ref
            if full_path.exists():
                size = full_path.stat().st_size
                if size > 0:
                    print(f"  OK: {ref} ({size:,} bytes)")
                else:
                    print(f"  WARN: {ref} is empty!")
                    all_passed = False
            else:
                print(f"  FAIL: {ref} not found!")
                all_passed = False

    if all_passed:
        print("\n*** ALL TESTS PASSED ***")
        return 0
    else:
        print("\n*** TESTS FAILED ***")
        return 1

if __name__ == "__main__":
    exit_code = 0

    exit_code += test_all_assets_exist()
    exit_code += test_no_external_webflow_urls()
    exit_code += test_css_js_load()

    print("\n" + "=" * 60)
    print("FINAL RESULT")
    print("=" * 60)
    if exit_code == 0:
        print("ALL TESTS PASSED!")
    else:
        print(f"SOME TESTS FAILED (exit code: {exit_code})")

    sys.exit(exit_code)
