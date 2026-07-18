import { Node, mergeAttributes } from '@tiptap/core'

const SIZES = [
  { key: 'full', label: 'Full', cls: '' },
  { key: 'medium', label: 'Med', cls: 'blog-figure-sm' },
  { key: 'small', label: 'Sm', cls: 'blog-figure-md' },
]

// Migrate old size values to new keys
function normalizeSize(size) {
  if (size === 'normal' || !size) return 'full'
  return size // 'full', 'medium', 'small' pass through unchanged
}

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      size: { default: 'full' }, // 'full' | 'medium' | 'small'
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-figure]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const size = normalizeSize(node.attrs.size)
    const sizeInfo = SIZES.find(s => s.key === size) || SIZES[0]
    const figClass = ['blog-figure', sizeInfo.cls].filter(Boolean).join(' ')
    return ['figure', mergeAttributes(HTMLAttributes, {
      'data-figure': '',
      class: figClass,
    }),
      ['img', { src: node.attrs.src, alt: node.attrs.alt, loading: 'lazy' }],
      ['figcaption', {}, node.attrs.caption],
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('figure')
      dom.classList.add('blog-figure')
      dom.setAttribute('data-figure', '')

      let currentNode = node
      const size = normalizeSize(node.attrs.size)

      // Apply size class
      const applySizeClass = (s) => {
        dom.classList.remove('blog-figure-sm', 'blog-figure-md')
        const info = SIZES.find(sz => sz.key === s) || SIZES[0]
        if (info.cls) dom.classList.add(info.cls)
      }
      applySizeClass(size)

      // Image
      const img = document.createElement('img')
      img.loading = 'lazy'
      img.src = node.attrs.src || ''
      img.alt = node.attrs.alt || ''
      dom.appendChild(img)

      // Upload overlay (shown when no image)
      const upload = document.createElement('div')
      upload.classList.add('figure-upload')
      upload.innerHTML = '<span class="figure-upload-icon">+</span><span>Click or drag image</span>'
      dom.appendChild(upload)

      if (node.attrs.src) upload.style.display = 'none'
      else img.style.display = 'none'

      // Rich text caption (contenteditable)
      const caption = document.createElement('figcaption')
      const captionInput = document.createElement('div')
      captionInput.contentEditable = 'true'
      captionInput.classList.add('figure-caption-input')
      captionInput.innerHTML = node.attrs.caption || ''
      captionInput.setAttribute('data-placeholder', 'Figure caption...')
      caption.appendChild(captionInput)
      dom.appendChild(caption)

      // Size toggle: 3 clickable buttons
      const controls = document.createElement('div')
      controls.classList.add('figure-controls')

      const sizeButtons = SIZES.map(s => {
        const btn = document.createElement('button')
        btn.classList.add('figure-size-btn')
        btn.textContent = s.label
        btn.title = `Size: ${s.label}`
        if (normalizeSize(currentNode.attrs.size) === s.key) btn.classList.add('active')
        btn.addEventListener('click', e => {
          e.stopPropagation()
          updateAttrs({ size: s.key })
        })
        controls.appendChild(btn)
        return { key: s.key, btn }
      })
      dom.appendChild(controls)

      const updateAttrs = (attrs) => {
        const pos = getPos()
        if (typeof pos === 'number') {
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(pos, undefined, {
              ...currentNode.attrs,
              ...attrs,
            })
          )
        }
      }

      // File picker
      const pickFile = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async e => {
          const file = e.target.files[0]
          if (!file) return
          const slug = new URLSearchParams(window.location.search).get('slug')
          const formData = new FormData()
          formData.append('image', file)
          try {
            const res = await fetch(`/api/drafts/${encodeURIComponent(slug)}/upload`, {
              method: 'POST',
              body: formData,
            })
            const { url } = await res.json()
            updateAttrs({ src: url, alt: file.name })
          } catch (err) {
            console.error('Upload failed:', err)
          }
        }
        input.click()
      }

      upload.addEventListener('click', pickFile)
      img.addEventListener('dblclick', pickFile)

      // Drag and drop
      dom.addEventListener('dragover', e => { e.preventDefault(); dom.classList.add('drag-over') })
      dom.addEventListener('dragleave', () => dom.classList.remove('drag-over'))
      dom.addEventListener('drop', async e => {
        e.preventDefault()
        dom.classList.remove('drag-over')
        const file = e.dataTransfer.files[0]
        if (!file || !file.type.startsWith('image/')) return
        const slug = new URLSearchParams(window.location.search).get('slug')
        const formData = new FormData()
        formData.append('image', file)
        try {
          const res = await fetch(`/api/drafts/${encodeURIComponent(slug)}/upload`, {
            method: 'POST',
            body: formData,
          })
          const { url } = await res.json()
          updateAttrs({ src: url, alt: file.name })
        } catch (err) {
          console.error('Upload failed:', err)
        }
      })

      // Caption: save on input, support formatting shortcuts
      captionInput.addEventListener('input', () => updateAttrs({ caption: captionInput.innerHTML }))
      captionInput.addEventListener('keydown', e => {
        e.stopPropagation()
        // Support Cmd+B, Cmd+I, Cmd+U in caption
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
          e.preventDefault()
          document.execCommand('bold')
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
          e.preventDefault()
          document.execCommand('italic')
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
          e.preventDefault()
          document.execCommand('underline')
        }
      })

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'figure') return false
          currentNode = updatedNode
          img.src = updatedNode.attrs.src || ''
          img.alt = updatedNode.attrs.alt || ''
          if (updatedNode.attrs.src) {
            img.style.display = ''
            upload.style.display = 'none'
          } else {
            img.style.display = 'none'
            upload.style.display = ''
          }
          if (!captionInput.matches(':focus')) {
            captionInput.innerHTML = updatedNode.attrs.caption || ''
          }
          const s = normalizeSize(updatedNode.attrs.size)
          applySizeClass(s)
          sizeButtons.forEach(sb => {
            sb.btn.classList.toggle('active', sb.key === s)
          })
          return true
        },
        stopEvent(event) {
          // Let caption, size buttons, and upload handle their own events
          if (caption.contains(event.target)) return true
          if (controls.contains(event.target)) return true
          if (upload.contains(event.target)) return true
          return false
        },
        ignoreMutation() { return true },
      }
    }
  },
})
