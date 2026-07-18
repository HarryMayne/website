import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'

import { MathInline, MathDisplay } from './extensions/math.js'
import { Sidenote } from './extensions/sidenote.js'
import { Figure } from './extensions/figure.js'
import { Box, BoxRow, BoxCell } from './extensions/box.js'
import { Citation } from './extensions/citation.js'
import { SlashCommands } from './extensions/slash-commands.js'

import { loadDraft, saveDraft, uploadImage, publishDraft } from './utils/api.js'
import { exportToHTML } from './utils/export-html.js'

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

const params = new URLSearchParams(window.location.search)
const SLUG = params.get('slug')
if (!SLUG) { window.location.href = '/'; throw new Error('No slug') }

let metadata = {
  title: '',
  subtitle: '',
  date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  authors: '',
  links: [],
  description: '',
}
let saveTimeout = null
let lastSavedJSON = ''
let isDirty = false

/* ------------------------------------------------------------------ */
/*  Editor setup                                                       */
/* ------------------------------------------------------------------ */

const editor = new Editor({
  element: document.getElementById('editor-content'),
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'blog-link' },
    }),
    Placeholder.configure({ placeholder: 'Start writing, or type / for commands...' }),
    Underline,
    MathInline,
    MathDisplay,
    Sidenote,
    Figure,
    Box,
    BoxRow,
    BoxCell,
    Citation,
    SlashCommands,
  ],
  autofocus: true,
  onUpdate: () => {
    isDirty = true
    updateTOC()
    updateWordCount()
    scheduleSave()
  },
})

/* ------------------------------------------------------------------ */
/*  Metadata form                                                      */
/* ------------------------------------------------------------------ */

const metaForm = document.getElementById('metadata-form')
const fields = {
  title: document.getElementById('meta-title'),
  subtitle: document.getElementById('meta-subtitle'),
  date: document.getElementById('meta-date'),
  authors: document.getElementById('meta-authors'),
  description: document.getElementById('meta-description'),
}

// Links are dynamic
const linksContainer = document.getElementById('meta-links')

function renderLinks() {
  linksContainer.innerHTML = ''
  metadata.links.forEach((link, i) => {
    const row = document.createElement('div')
    row.classList.add('meta-link-row')

    const labelInput = document.createElement('input')
    labelInput.type = 'text'
    labelInput.value = link.label
    labelInput.placeholder = 'Label (e.g. Paper)'
    labelInput.classList.add('meta-input', 'meta-link-label')
    labelInput.addEventListener('input', () => { metadata.links[i].label = labelInput.value; scheduleSave() })

    const urlInput = document.createElement('input')
    urlInput.type = 'text'
    urlInput.value = link.url
    urlInput.placeholder = 'URL'
    urlInput.classList.add('meta-input', 'meta-link-url')
    urlInput.addEventListener('input', () => { metadata.links[i].url = urlInput.value; scheduleSave() })

    const removeBtn = document.createElement('button')
    removeBtn.textContent = '\u00D7'
    removeBtn.classList.add('meta-link-remove')
    removeBtn.addEventListener('click', () => { metadata.links.splice(i, 1); renderLinks(); scheduleSave() })

    row.appendChild(labelInput)
    row.appendChild(urlInput)
    row.appendChild(removeBtn)
    linksContainer.appendChild(row)
  })
}

document.getElementById('add-link-btn').addEventListener('click', () => {
  metadata.links.push({ label: '', url: '' })
  renderLinks()
})

// Bind metadata fields
Object.entries(fields).forEach(([key, el]) => {
  el.addEventListener('input', () => {
    metadata[key] = el.value
    if (key === 'title') {
      document.getElementById('editor-title-display').textContent = el.value || 'Untitled'
    }
    scheduleSave()
  })
})

/* ------------------------------------------------------------------ */
/*  Toolbar                                                            */
/* ------------------------------------------------------------------ */

function setupToolbar() {
  const actions = {
    'tb-undo': () => editor.chain().focus().undo().run(),
    'tb-redo': () => editor.chain().focus().redo().run(),
    'tb-bold': () => editor.chain().focus().toggleBold().run(),
    'tb-italic': () => editor.chain().focus().toggleItalic().run(),
    'tb-underline': () => editor.chain().focus().toggleUnderline().run(),
    'tb-strike': () => editor.chain().focus().toggleStrike().run(),
    'tb-code': () => editor.chain().focus().toggleCode().run(),
    'tb-h1': () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    'tb-h2': () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    'tb-h3': () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    'tb-bullet': () => editor.chain().focus().toggleBulletList().run(),
    'tb-ordered': () => editor.chain().focus().toggleOrderedList().run(),
    'tb-blockquote': () => editor.chain().focus().toggleBlockquote().run(),
    'tb-link': () => showLinkPopover(),
    'tb-math-inline': () => editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex: '' } }).run(),
    'tb-math-display': () => editor.chain().focus().insertContent({ type: 'mathDisplay', attrs: { latex: '' } }).run(),
    'tb-figure': () => editor.chain().focus().insertContent({ type: 'figure', attrs: {} }).run(),
    'tb-sidenote': () => {
      let max = 0
      editor.state.doc.descendants(n => { if (n.type.name === 'sidenote') max = Math.max(max, n.attrs.number || 0) })
      // If text is selected, move it into the sidenote content
      const { from, to } = editor.state.selection
      let selectedText = ''
      if (from !== to) {
        selectedText = editor.state.doc.textBetween(from, to, ' ')
      }
      if (selectedText) {
        editor.chain().focus().deleteSelection().insertContent({
          type: 'sidenote', attrs: { number: max + 1, content: selectedText }
        }).run()
      } else {
        editor.chain().focus().insertContent({
          type: 'sidenote', attrs: { number: max + 1, content: '' }
        }).run()
      }
    },
    'tb-citation': () => editor.chain().focus().insertContent({ type: 'citation', attrs: {} }).run(),
    'tb-box': () => editor.chain().focus().insertBox().run(),
    'tb-hr': () => editor.chain().focus().setHorizontalRule().run(),
  }

  Object.entries(actions).forEach(([id, fn]) => {
    const btn = document.getElementById(id)
    if (btn) btn.addEventListener('click', fn)
  })
}

setupToolbar()

/* ------------------------------------------------------------------ */
/*  Link Popover (Cmd+K, replaces prompt)                              */
/* ------------------------------------------------------------------ */

const linkPopover = document.getElementById('link-popover')
const linkUrlInput = document.getElementById('link-url-input')
const linkApplyBtn = document.getElementById('link-apply')
const linkRemoveBtn = document.getElementById('link-remove')

// Store selection range so we can restore it after tab switch
let savedLinkSelection = null

function showLinkPopover() {
  // Save the current selection
  const { from, to } = editor.state.selection
  savedLinkSelection = { from, to }

  const existingLink = editor.getAttributes('link').href || ''

  // Position near the selection
  const coords = editor.view.coordsAtPos(from)
  linkPopover.style.display = 'flex'
  linkPopover.style.left = `${Math.max(8, Math.min(coords.left, window.innerWidth - 420))}px`
  linkPopover.style.top = `${coords.bottom + 8}px`

  linkUrlInput.value = existingLink
  linkRemoveBtn.style.display = existingLink ? '' : 'none'

  // Small delay to avoid the focus stealing from editor
  requestAnimationFrame(() => {
    linkUrlInput.focus()
    linkUrlInput.select()
  })
}

function hideLinkPopover() {
  linkPopover.style.display = 'none'
  savedLinkSelection = null
}

function applyLink() {
  const url = linkUrlInput.value.trim()
  if (url) {
    // Restore selection if needed
    if (savedLinkSelection) {
      editor.chain().focus()
        .setTextSelection(savedLinkSelection)
        .setLink({ href: url, target: '_blank' })
        .run()
    } else {
      editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
    }
  }
  hideLinkPopover()
}

function removeLink() {
  editor.chain().focus().unsetLink().run()
  hideLinkPopover()
}

linkApplyBtn.addEventListener('click', applyLink)
linkRemoveBtn.addEventListener('click', removeLink)
linkUrlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); applyLink() }
  if (e.key === 'Escape') { e.preventDefault(); hideLinkPopover(); editor.commands.focus() }
  e.stopPropagation()
})

// Close on click outside (but not on the popover itself)
document.addEventListener('mousedown', e => {
  if (linkPopover.style.display !== 'none' && !linkPopover.contains(e.target)) {
    hideLinkPopover()
  }
})

// Cmd+K keyboard shortcut
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    showLinkPopover()
  }
})

// Cmd+Click to open links in new tab
document.getElementById('editor-content').addEventListener('click', e => {
  if ((e.metaKey || e.ctrlKey)) {
    const link = e.target.closest('a')
    if (link) {
      e.preventDefault()
      const href = link.getAttribute('href')
      if (href) window.open(href, '_blank')
    }
  }
})

/* ------------------------------------------------------------------ */
/*  TOC (auto-generated, live updates)                                 */
/* ------------------------------------------------------------------ */

function updateTOC() {
  const tocList = document.getElementById('toc-list')
  if (!tocList) return
  const headings = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({ level: node.attrs.level, text: node.textContent, pos })
    }
  })
  tocList.innerHTML = headings.map(h => {
    const display = h.text
      ? h.text
      : '<span class="toc-placeholder">Empty heading</span>'
    return `<li class="toc-level-${h.level}"><a href="#" data-pos="${h.pos}">${display}</a></li>`
  }).join('')

  tocList.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault()
      const pos = parseInt(a.dataset.pos)
      // Set cursor inside the heading (pos+1 = inside the heading node)
      try {
        editor.chain().setTextSelection(pos + 1).focus().run()
      } catch {
        editor.commands.focus(pos)
      }
      // Scroll the heading DOM element into view
      const domNode = editor.view.nodeDOM(pos)
      if (domNode && domNode.scrollIntoView) {
        domNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  })
}

/* ------------------------------------------------------------------ */
/*  Word count (Google Docs style)                                     */
/* ------------------------------------------------------------------ */

function updateWordCount() {
  // Use textBetween with block separator to count words across blocks properly
  const doc = editor.state.doc
  const text = doc.textBetween(0, doc.content.size, ' ', ' ')
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const readingMins = Math.max(1, Math.ceil(words / 230))
  const el = document.getElementById('word-count')
  if (el) {
    el.textContent = words > 0
      ? `${words} words \u00b7 ${readingMins} min read`
      : '0 words'
  }
}

/* ------------------------------------------------------------------ */
/*  Save / Load                                                        */
/* ------------------------------------------------------------------ */

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(doSave, 3000)
  updateSaveStatus('unsaved')
}

async function doSave() {
  const data = { metadata, content: editor.getJSON() }
  const dataStr = JSON.stringify(data)
  if (dataStr === lastSavedJSON) return

  updateSaveStatus('saving')
  try {
    await saveDraft(SLUG, data)
    lastSavedJSON = dataStr
    isDirty = false
    updateSaveStatus('saved')
  } catch (err) {
    console.error('Save failed:', err)
    updateSaveStatus('error')
  }
}

function updateSaveStatus(status) {
  const el = document.getElementById('save-status')
  if (!el) return
  el.className = `save-status save-${status}`
  const labels = { saved: 'Saved', saving: 'Saving...', unsaved: 'Unsaved', error: 'Save failed' }
  el.textContent = labels[status] || ''
}

// Manual save
document.getElementById('btn-save')?.addEventListener('click', doSave)

// Ctrl+S
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    doSave()
  }
})

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', e => {
  if (isDirty) { e.preventDefault(); e.returnValue = '' }
})

/* ------------------------------------------------------------------ */
/*  Preview                                                            */
/* ------------------------------------------------------------------ */

document.getElementById('btn-preview')?.addEventListener('click', () => {
  doSave().then(() => {
    window.open(`/preview.html?slug=${encodeURIComponent(SLUG)}`, '_blank')
  })
})

/* ------------------------------------------------------------------ */
/*  Talk to Claude                                                     */
/* ------------------------------------------------------------------ */

const claudeBtn = document.getElementById('btn-claude')
claudeBtn?.addEventListener('click', async () => {
  const originalText = claudeBtn.textContent
  claudeBtn.textContent = 'Opening…'
  claudeBtn.disabled = true
  try {
    await doSave()
    const res = await fetch(`/api/drafts/${encodeURIComponent(SLUG)}/talk-to-claude`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    claudeBtn.textContent = 'Opened in VS Code'
  } catch (err) {
    console.error('Talk to Claude failed:', err)
    claudeBtn.textContent = 'Failed — see server log'
  }
  setTimeout(() => {
    claudeBtn.textContent = originalText
    claudeBtn.disabled = false
  }, 3000)
})

/* ------------------------------------------------------------------ */
/*  Publish                                                            */
/* ------------------------------------------------------------------ */

document.getElementById('btn-publish')?.addEventListener('click', async () => {
  if (!confirm('Publish this draft to the live blog? This will create/overwrite the blog post HTML file.')) return
  await doSave()
  const html = exportToHTML(editor.getJSON(), metadata)
  try {
    await publishDraft(SLUG, html)
    alert('Published successfully! The post is now in docs/blog/')
  } catch (err) {
    alert('Publish failed: ' + err.message)
  }
})

/* ------------------------------------------------------------------ */
/*  Load draft on start                                                */
/* ------------------------------------------------------------------ */

async function init() {
  try {
    const data = await loadDraft(SLUG)
    if (data.content && data.content.content) {
      editor.commands.setContent(data.content)
    }
    if (data.metadata) {
      metadata = { ...metadata, ...data.metadata }
      Object.entries(fields).forEach(([key, el]) => {
        if (metadata[key] != null) el.value = metadata[key]
      })
      if (metadata.links) renderLinks()
      if (metadata.title) {
        document.getElementById('editor-title-display').textContent = metadata.title
      }
    }
    // If no title set, derive from slug
    if (!metadata.title && SLUG) {
      metadata.title = SLUG.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      fields.title.value = metadata.title
      document.getElementById('editor-title-display').textContent = metadata.title
      scheduleSave()
    }
    lastSavedJSON = JSON.stringify({ metadata, content: data.content || {} })
    updateSaveStatus('saved')
    updateTOC()
    updateWordCount()
  } catch (err) {
    console.warn('No existing draft, starting fresh')
    // Derive title from slug for new drafts
    if (SLUG) {
      metadata.title = SLUG.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      fields.title.value = metadata.title
      document.getElementById('editor-title-display').textContent = metadata.title
    }
    updateSaveStatus('saved')
  }
}

init()

/* ------------------------------------------------------------------ */
/*  Sidebar toggle                                                     */
/* ------------------------------------------------------------------ */

document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-collapsed')
})

document.getElementById('toggle-meta')?.addEventListener('click', function () {
  const panel = document.getElementById('metadata-form')
  panel.classList.toggle('collapsed')
  this.textContent = panel.classList.contains('collapsed') ? 'Show metadata' : 'Hide metadata'
})
