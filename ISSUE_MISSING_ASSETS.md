# GitHub Issue: Add missing asset files

**Title:** Add missing asset files

**Body:**

## Missing Files

The following files are referenced in HTML but missing from the repository. These were likely lost during the Webflow migration or never committed.

### Favicon & Icons (All pages)
- [ ] `assets/image5.png` - Shortcut icon (favicon)
- [ ] `assets/image6.png` - Apple touch icon

### Images (index.html)
- [ ] `assets/paper_placeholder.png` - Placeholder for papers without thumbnails (used twice)

### PDFs (oxmedica.html)
- [ ] `assets/66844ba30eca07a1cd80a526_Day 4 Class 1.pdf`
- [ ] `assets/66844ba3012f0e359b5622cc_Day 4 Quiz.pdf`
- [ ] `assets/66844ba37562f707f0c2b1e8_Day 4 Class 2.pdf`
- [ ] `assets/66844ba4f043fe72f8a2e066_Day 4 Class 3.pdf`
- [ ] `assets/6692a9fd5cf5dc1cce935416_Day 11 Quiz.pdf`
- [ ] `assets/66955da7720f77e31390aeea_My best AI news sources.pdf`

## How to verify
Run the test script:
```bash
python3 tests/test_assets.py
```

## Options
1. **Add the missing files** - Download/locate the original files and add them
2. **Remove references** - If files are no longer needed, remove the HTML references
3. **Use placeholders** - For images, create simple placeholder images

---
*Create this issue at: https://github.com/HarryMayne/website/issues/new*
