import { listDrafts, createDraft, deleteDraft } from './utils/api.js'

const grid = document.getElementById('drafts-grid')
const newBtn = document.getElementById('new-draft-btn')
const newSlugInput = document.getElementById('new-draft-slug')

async function render() {
  try {
    const drafts = await listDrafts()
    grid.innerHTML = ''

    if (drafts.length === 0) {
      grid.innerHTML = '<div class="empty-state">No drafts yet. Create one to get started.</div>'
      return
    }

    drafts.forEach(draft => {
      const card = document.createElement('a')
      card.href = `/editor.html?slug=${encodeURIComponent(draft.slug)}`
      card.classList.add('draft-card')

      const title = document.createElement('div')
      title.classList.add('draft-card-title')
      title.textContent = draft.metadata?.title || draft.slug
      card.appendChild(title)

      if (draft.metadata?.subtitle) {
        const sub = document.createElement('div')
        sub.classList.add('draft-card-subtitle')
        sub.textContent = draft.metadata.subtitle
        card.appendChild(sub)
      }

      const meta = document.createElement('div')
      meta.classList.add('draft-card-meta')
      const date = draft.metadata?.date || ''
      const words = draft.wordCount ? `${draft.wordCount} words` : ''
      meta.textContent = [date, words].filter(Boolean).join(' \u00b7 ')
      card.appendChild(meta)

      const modified = document.createElement('div')
      modified.classList.add('draft-card-modified')
      modified.textContent = draft.modified ? `Last edited: ${new Date(draft.modified * 1000).toLocaleDateString()}` : ''
      card.appendChild(modified)

      // Delete button
      const del = document.createElement('button')
      del.classList.add('draft-card-delete')
      del.textContent = '\u00D7'
      del.title = 'Delete draft'
      del.addEventListener('click', async e => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm(`Delete "${draft.metadata?.title || draft.slug}"?`)) return
        await deleteDraft(draft.slug)
        render()
      })
      card.appendChild(del)

      grid.appendChild(card)
    })
  } catch (err) {
    console.error('Failed to load drafts:', err)
    grid.innerHTML = '<div class="empty-state">Failed to load drafts. Is the server running?</div>'
  }
}

// Create new draft
async function handleNew() {
  let slug = newSlugInput.value.trim()
  if (!slug) {
    slug = prompt('Draft slug (URL-friendly name):')
    if (!slug) return
  }
  slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (!slug) return

  try {
    await createDraft(slug)
    window.location.href = `/editor.html?slug=${encodeURIComponent(slug)}`
  } catch (err) {
    alert('Failed to create draft: ' + err.message)
  }
}

newBtn.addEventListener('click', handleNew)
newSlugInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleNew()
})

render()
