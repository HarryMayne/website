import katex from 'katex'

/**
 * Convert TipTap JSON document to full blog HTML page.
 */
export function exportToHTML(doc, metadata) {
  const contentHTML = renderNode(doc)
  const sections = groupIntoSections(contentHTML)
  const toc = buildTOC(doc)
  const hasMath = docUsesMath(doc)
  const hasCitation = docUsesCitation(doc)
  const citationNode = extractCitation(doc)

  const metaLinks = buildMetaLinks(metadata)
  const authorsHTML = metadata.authors
    ? `\n          <span class="blog-meta-authors">${esc(metadata.authors)}</span>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(metadata.title)} | Harry Mayne</title>
  <link href="../assets/css/site-2-ee27e6.webflow.shared.afb1fee4b.css" rel="stylesheet" type="text/css"/>
  <link href="../css/site.css" rel="stylesheet" type="text/css"/>
  <link href="blog.css" rel="stylesheet" type="text/css"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>${hasMath ? `
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
          onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\\\(',right:'\\\\)',display:false}]});"><\/script>` : ''}
</head>
<body>
  <div>
    <nav class="main-nav w-nav">
      <a href="../index.html" class="name w-nav-brand">Harry Mayne</a>
      <div class="nav-links">
        <a href="../index.html#research" class="nav-link w-nav-link">Research</a>
        <a href="../index.html#blog" class="nav-link w-nav-link">Writing</a>
        <a href="../index.html#about" class="nav-link w-nav-link">About</a>
        <a href="../index.html#teaching" class="nav-link w-nav-link">Teaching</a>
        <a href="../index.html#contact" class="nav-link w-nav-link">Contact</a>
      </div>
    </nav>

    <article class="blog-post">
      <header class="blog-header">
        <h1>${esc(metadata.title)}</h1>
        ${metadata.subtitle ? `<p class="blog-subtitle">${esc(metadata.subtitle)}</p>` : ''}
      </header>
      <hr class="blog-divider"/>
      <div class="blog-meta">
        <div class="blog-meta-info">
          <span class="blog-date">${esc(metadata.date)}</span>${metaLinks}${authorsHTML}
        </div>
      </div>
      <hr class="blog-divider"/>

      <button class="blog-toc-toggle">Contents</button>
      <nav class="blog-toc" aria-label="Table of contents">
        <h2>Contents</h2>
        <ul>
${toc}
        </ul>
      </nav>

      <div class="blog-content">
${sections}
      </div>
${hasCitation && citationNode ? renderCitationSection(citationNode) : ''}
    </article>
  </div>

  <script src="blog.js"><\/script>
</body>
</html>`
}

/* ------------------------------------------------------------------ */
/*  Node rendering                                                     */
/* ------------------------------------------------------------------ */

function renderNode(node) {
  if (!node) return ''
  if (node.type === 'text') {
    let text = esc(node.text || '')
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold': text = `<strong>${text}</strong>`; break
          case 'italic': text = `<em>${text}</em>`; break
          case 'underline': text = `<u>${text}</u>`; break
          case 'strike': text = `<s>${text}</s>`; break
          case 'code': text = `<code>${text}</code>`; break
          case 'link':
            text = `<a href="${esc(mark.attrs?.href || '')}"${mark.attrs?.target ? ` target="${esc(mark.attrs.target)}"` : ''}>${text}</a>`
            break
        }
      }
    }
    return text
  }

  const children = (node.content || []).map(renderNode).join('')

  switch (node.type) {
    case 'doc':
      return children
    case 'paragraph':
      return `<p>${children}</p>\n`
    case 'heading': {
      const level = node.attrs?.level || 2
      return `<h${level}>${children}</h${level}>\n`
    }
    case 'bulletList':
      return `<ul>\n${children}</ul>\n`
    case 'orderedList':
      return `<ol>\n${children}</ol>\n`
    case 'listItem':
      return `<li>${children}</li>\n`
    case 'blockquote':
      return `<blockquote>\n${children}</blockquote>\n`
    case 'codeBlock':
      return `<pre><code>${children}</code></pre>\n`
    case 'horizontalRule':
      return '<hr/>\n'
    case 'hardBreak':
      return '<br/>'
    case 'mathInline':
      return `\\(${node.attrs?.latex || ''}\\)`
    case 'mathDisplay':
      return `<p style="text-align: center; margin: 1.5em 0;">$$${node.attrs?.latex || ''}$$</p>\n`
    case 'sidenote': {
      const n = node.attrs?.number || 1
      const content = node.attrs?.content || ''
      // Content is HTML (rich text), pass through directly
      return `<span class="blog-sidenote-ref">${n}</span>\n<aside class="blog-sidenote">\n  <span class="blog-sidenote-number">${n}</span>\n  ${content}\n</aside>\n`
    }
    case 'figure': {
      const size = normalizeSize(node.attrs?.size)
      const cls = figureClass(size)
      const src = node.attrs?.src || ''
      const alt = node.attrs?.alt || ''
      const caption = node.attrs?.caption || ''
      // Convert draft asset paths to published paths
      const pubSrc = src.replace(/^\/api\/drafts\/[^/]+\/assets\//, 'assets/' + getSlugFromSrc(src) + '/')
      // Caption is HTML (rich text), pass through directly
      return `<figure class="${cls}">\n  <img src="${esc(pubSrc)}" alt="${esc(alt)}" loading="lazy"/>\n  <figcaption>${caption}</figcaption>\n</figure>\n`
    }
    case 'citation':
      return '' // handled separately
    case 'box': {
      const color = normalizeBoxColor(node.attrs?.color)
      // Indent children so a heading inside a box never matches the
      // top-level ^<h2> section-splitting regex in groupIntoSections()
      return `<div class="blog-box blog-box-${color}">\n${indent(children.trim(), 2)}\n</div>\n`
    }
    case 'boxRow':
      return `<div class="blog-box-row">\n${indent(children.trim(), 2)}\n</div>\n`
    case 'boxCell':
      return `<div class="blog-box-cell">\n${indent(children.trim(), 2)}\n</div>\n`
    default:
      return children
  }
}

function normalizeSize(size) {
  if (size === 'normal' || !size) return 'full'
  return size // 'full', 'medium', 'small' pass through unchanged
}

const BOX_COLOR_KEYS = ['grey', 'red', 'blue', 'green', 'orange', 'purple']

function normalizeBoxColor(color) {
  return BOX_COLOR_KEYS.includes(color) ? color : 'grey'
}

function figureClass(size) {
  switch (size) {
    case 'medium': return 'blog-figure blog-figure-sm'
    case 'small': return 'blog-figure blog-figure-md'
    default: return 'blog-figure'
  }
}

function getSlugFromSrc(src) {
  const match = src.match(/\/api\/drafts\/([^/]+)\//)
  return match ? match[1] : ''
}

/* ------------------------------------------------------------------ */
/*  Section grouping: wrap content between h2s in <section>            */
/* ------------------------------------------------------------------ */

function groupIntoSections(html) {
  const lines = html.split('\n')
  const sections = []
  let current = { id: 'intro', heading: '', lines: [] }

  for (const line of lines) {
    const h2Match = line.match(/^<h2>(.+?)<\/h2>$/)
    if (h2Match) {
      sections.push(current)
      const text = h2Match[1].replace(/<[^>]+>/g, '')
      current = {
        id: slugify(text),
        heading: line,
        lines: [],
      }
    } else {
      current.lines.push(line)
    }
  }
  sections.push(current)

  return sections.map(s => {
    const content = s.heading + '\n' + s.lines.join('\n')
    return `        <section id="${s.id}">\n${indent(content.trim(), 10)}\n        </section>`
  }).join('\n\n')
}

/* ------------------------------------------------------------------ */
/*  TOC                                                                */
/* ------------------------------------------------------------------ */

function buildTOC(doc) {
  const headings = []
  walkDoc(doc, node => {
    if (node.type === 'heading' && node.attrs?.level === 2) {
      const text = extractText(node)
      headings.push({ text, id: slugify(text) })
    }
  })
  return headings.map(h =>
    `          <li><a href="#${h.id}">${esc(h.text)}</a></li>`
  ).join('\n')
}

/* ------------------------------------------------------------------ */
/*  Citation section                                                   */
/* ------------------------------------------------------------------ */

function docUsesCitation(doc) {
  let found = false
  walkDoc(doc, n => { if (n.type === 'citation') found = true })
  return found
}

function extractCitation(doc) {
  let result = null
  walkDoc(doc, n => { if (n.type === 'citation' && !result) result = n })
  return result
}

function renderCitationSection(node) {
  const text = node.attrs?.text || ''
  const bibtex = node.attrs?.bibtex || ''
  return `
      <section id="citation" class="blog-citation">
        <h2>Citation</h2>
        <p class="blog-citation-text">${esc(text)}</p>
        <div class="blog-bibtex-wrapper">
          <button class="blog-bibtex-copy" aria-label="Copy BibTeX">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <pre class="blog-bibtex">${esc(bibtex)}</pre>
        </div>
      </section>`
}

/* ------------------------------------------------------------------ */
/*  Meta links                                                         */
/* ------------------------------------------------------------------ */

function buildMetaLinks(metadata) {
  if (!metadata.links || metadata.links.length === 0) return ''
  return metadata.links.map(l =>
    `\n          <span class="blog-meta-sep">&middot;</span>\n          <a href="${esc(l.url)}">${esc(l.label)}</a>`
  ).join('')
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function docUsesMath(doc) {
  let found = false
  walkDoc(doc, n => { if (n.type === 'mathInline' || n.type === 'mathDisplay') found = true })
  return found
}

function walkDoc(node, fn) {
  fn(node)
  if (node.content) node.content.forEach(c => walkDoc(c, fn))
}

function extractText(node) {
  if (node.type === 'text') return node.text || ''
  if (!node.content) return ''
  return node.content.map(extractText).join('')
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function indent(str, spaces) {
  const pad = ' '.repeat(spaces)
  return str.split('\n').map(l => l ? pad + l : l).join('\n')
}
