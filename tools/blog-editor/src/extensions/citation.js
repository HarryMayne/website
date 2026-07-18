import { Node, mergeAttributes } from '@tiptap/core'

export const Citation = Node.create({
  name: 'citation',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      text: { default: '' },
      bibtex: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-citation]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-citation': '',
      class: 'citation-node',
    }),
      ['p', { class: 'blog-citation-text' }, node.attrs.text],
      ['pre', { class: 'blog-bibtex' }, node.attrs.bibtex],
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('section')
      dom.classList.add('blog-citation', 'citation-node-editor')

      const heading = document.createElement('h2')
      heading.textContent = 'Citation'
      dom.appendChild(heading)

      // Citation text
      const textLabel = document.createElement('label')
      textLabel.textContent = 'Citation text'
      textLabel.classList.add('citation-label')
      dom.appendChild(textLabel)

      const textArea = document.createElement('textarea')
      textArea.classList.add('citation-text-input')
      textArea.value = node.attrs.text
      textArea.placeholder = 'Mayne, H. et al. (2025). Title. Conference.'
      textArea.rows = 3
      dom.appendChild(textArea)

      // BibTeX
      const bibLabel = document.createElement('label')
      bibLabel.textContent = 'BibTeX'
      bibLabel.classList.add('citation-label')
      dom.appendChild(bibLabel)

      const bibArea = document.createElement('textarea')
      bibArea.classList.add('citation-bibtex-input')
      bibArea.value = node.attrs.bibtex
      bibArea.placeholder = '@article{key,\n  title={...},\n  author={...},\n}'
      bibArea.rows = 6
      dom.appendChild(bibArea)

      let currentNode = node

      const commit = () => {
        const pos = getPos()
        if (typeof pos === 'number') {
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(pos, undefined, {
              text: textArea.value,
              bibtex: bibArea.value,
            })
          )
        }
      }

      textArea.addEventListener('input', commit)
      textArea.addEventListener('keydown', e => e.stopPropagation())
      bibArea.addEventListener('input', commit)
      bibArea.addEventListener('keydown', e => e.stopPropagation())

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'citation') return false
          currentNode = updatedNode
          if (!textArea.matches(':focus')) textArea.value = updatedNode.attrs.text
          if (!bibArea.matches(':focus')) bibArea.value = updatedNode.attrs.bibtex
          return true
        },
        stopEvent(event) {
          return event.target === textArea || event.target === bibArea
        },
        ignoreMutation() { return true },
      }
    }
  },
})
