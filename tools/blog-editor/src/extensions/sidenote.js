import { Node, mergeAttributes } from '@tiptap/core'

export const Sidenote = Node.create({
  name: 'sidenote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      number: { default: 1 },
      content: { default: '' }, // stores HTML for rich text
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-sidenote]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-sidenote': '',
      'data-number': node.attrs.number,
      class: 'sidenote-node',
    }), `[${node.attrs.number}]`]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span')
      dom.classList.add('sidenote-node')

      // Superscript ref number (inline in text)
      const ref = document.createElement('sup')
      ref.classList.add('sidenote-ref')
      ref.textContent = node.attrs.number
      dom.appendChild(ref)

      // Inline callout box (always visible below the ref)
      const callout = document.createElement('div')
      callout.classList.add('sidenote-callout')

      const numLabel = document.createElement('span')
      numLabel.classList.add('sidenote-callout-num')
      numLabel.textContent = node.attrs.number
      callout.appendChild(numLabel)

      // Rich text content area — use a div for proper cursor/selection
      const contentEl = document.createElement('div')
      contentEl.classList.add('sidenote-callout-content')
      contentEl.contentEditable = 'true'
      contentEl.innerHTML = node.attrs.content || ''
      callout.appendChild(contentEl)
      dom.appendChild(callout)

      let currentNode = node

      const commit = () => {
        const html = contentEl.innerHTML
        // Don't commit if it's just <br> (empty div artifact)
        const cleanHTML = html === '<br>' ? '' : html
        const pos = getPos()
        if (typeof pos === 'number' && cleanHTML !== currentNode.attrs.content) {
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(pos, undefined, {
              ...currentNode.attrs,
              content: cleanHTML,
            })
          )
        }
      }

      // Click on ref number focuses the content area
      ref.addEventListener('click', e => {
        e.stopPropagation()
        e.preventDefault()
        contentEl.focus()
      })

      // Save content on input
      contentEl.addEventListener('input', () => commit())

      // Blur = commit
      contentEl.addEventListener('blur', () => commit())

      // Support keyboard shortcuts inside the contenteditable
      contentEl.addEventListener('keydown', e => {
        e.stopPropagation()
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
        // Escape to return to main editor
        if (e.key === 'Escape') {
          e.preventDefault()
          commit()
          editor.commands.focus()
        }
      })

      // Prevent ProseMirror from interfering with the contentEditable.
      // We stop propagation on mousedown so ProseMirror's root handler
      // never sees clicks inside the callout, and the browser's native
      // contentEditable behavior (cursor placement, text selection) works.
      callout.addEventListener('mousedown', e => {
        e.stopPropagation()
      })

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'sidenote') return false
          currentNode = updatedNode
          ref.textContent = updatedNode.attrs.number
          numLabel.textContent = updatedNode.attrs.number
          if (document.activeElement !== contentEl) {
            contentEl.innerHTML = updatedNode.attrs.content || ''
          }
          return true
        },
        selectNode() {
          dom.classList.add('sidenote-selected')
        },
        deselectNode() {
          dom.classList.remove('sidenote-selected')
          commit()
        },
        stopEvent(event) {
          // Let the callout handle ALL its own events (mouse, keyboard, etc.)
          return callout.contains(event.target) || ref.contains(event.target)
        },
        ignoreMutation() { return true },
      }
    }
  },
})
