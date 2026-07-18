const API = '/api'

export async function listDrafts() {
  const res = await fetch(`${API}/drafts`)
  if (!res.ok) throw new Error('Failed to list drafts')
  return res.json()
}

export async function loadDraft(slug) {
  const res = await fetch(`${API}/drafts/${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error('Failed to load draft')
  return res.json()
}

export async function saveDraft(slug, data) {
  const res = await fetch(`${API}/drafts/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to save draft')
  return res.json()
}

export async function createDraft(slug) {
  const res = await fetch(`${API}/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  })
  if (!res.ok) throw new Error('Failed to create draft')
  return res.json()
}

export async function deleteDraft(slug) {
  const res = await fetch(`${API}/drafts/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete draft')
  return res.json()
}

export async function uploadImage(slug, file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`${API}/drafts/${encodeURIComponent(slug)}/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Failed to upload image')
  return res.json()
}

export async function publishDraft(slug, html) {
  const res = await fetch(`${API}/drafts/${encodeURIComponent(slug)}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  })
  if (!res.ok) throw new Error('Failed to publish')
  return res.json()
}
