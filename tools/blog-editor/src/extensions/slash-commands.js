import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'

const COMMANDS = [
  { id: 'h1', label: 'Heading 1', icon: 'H1', description: 'Top-level heading' },
  { id: 'h2', label: 'Heading 2', icon: 'H2', description: 'Section heading' },
  { id: 'h3', label: 'Heading 3', icon: 'H3', description: 'Subsection heading' },
  { id: 'bullet', label: 'Bullet List', icon: '\u2022', description: 'Unordered list' },
  { id: 'ordered', label: 'Ordered List', icon: '1.', description: 'Numbered list' },
  { id: 'blockquote', label: 'Blockquote', icon: '\u201C', description: 'Quote block' },
  { id: 'figure', label: 'Figure', icon: '\uD83D\uDDBC', description: 'Image with caption' },
  { id: 'mathInline', label: 'Inline Math', icon: '\u03A3', description: 'Inline equation' },
  { id: 'mathDisplay', label: 'Display Math', icon: '\u222B', description: 'Block equation' },
  { id: 'sidenote', label: 'Sidenote', icon: '*', description: 'Margin note' },
  { id: 'box', label: 'Box', icon: '▦', description: 'Coloured box with rows/columns' },
  { id: 'citation', label: 'Citation', icon: '\uD83D\uDCDA', description: 'Citation with BibTeX' },
  { id: 'hr', label: 'Divider', icon: '\u2014', description: 'Horizontal rule' },
  { id: 'code', label: 'Code Block', icon: '<>', description: 'Code snippet' },
]

function getNextSidenoteNumber(editor) {
  let max = 0
  editor.state.doc.descendants(node => {
    if (node.type.name === 'sidenote') {
      max = Math.max(max, node.attrs.number || 0)
    }
  })
  return max + 1
}

function executeCommand(editor, id) {
  const chain = editor.chain().focus()
  switch (id) {
    case 'h1':
      chain.toggleHeading({ level: 1 }).run()
      break
    case 'h2':
      chain.toggleHeading({ level: 2 }).run()
      break
    case 'h3':
      chain.toggleHeading({ level: 3 }).run()
      break
    case 'bullet':
      chain.toggleBulletList().run()
      break
    case 'ordered':
      chain.toggleOrderedList().run()
      break
    case 'blockquote':
      chain.toggleBlockquote().run()
      break
    case 'figure':
      chain.insertContent({ type: 'figure', attrs: { src: '', alt: '', caption: '', size: 'normal' } }).run()
      break
    case 'mathInline':
      chain.insertContent({ type: 'mathInline', attrs: { latex: '' } }).run()
      break
    case 'mathDisplay':
      chain.insertContent({ type: 'mathDisplay', attrs: { latex: '' } }).run()
      break
    case 'sidenote':
      chain.insertContent({ type: 'sidenote', attrs: { number: getNextSidenoteNumber(editor), content: '' } }).run()
      break
    case 'citation':
      chain.insertContent({ type: 'citation', attrs: { text: '', bibtex: '' } }).run()
      break
    case 'box':
      chain.insertBox().run()
      break
    case 'hr':
      chain.setHorizontalRule().run()
      break
    case 'code':
      chain.toggleCodeBlock().run()
      break
  }
}

/* ------------------------------------------------------------------ */
/*  Popup renderer                                                     */
/* ------------------------------------------------------------------ */

class SlashMenu {
  constructor() {
    this.element = document.createElement('div')
    this.element.classList.add('slash-menu')
    this.items = []
    this.selectedIndex = 0
    this.command = null
  }

  show(items, command) {
    this.items = items
    this.command = command
    this.selectedIndex = 0
    this.render()
    document.body.appendChild(this.element)
  }

  render() {
    this.element.innerHTML = ''
    if (this.items.length === 0) {
      const empty = document.createElement('div')
      empty.classList.add('slash-menu-empty')
      empty.textContent = 'No results'
      this.element.appendChild(empty)
      return
    }
    this.items.forEach((item, i) => {
      const row = document.createElement('div')
      row.classList.add('slash-menu-item')
      if (i === this.selectedIndex) row.classList.add('selected')

      const icon = document.createElement('span')
      icon.classList.add('slash-menu-icon')
      icon.textContent = item.icon
      row.appendChild(icon)

      const info = document.createElement('div')
      info.classList.add('slash-menu-info')
      const label = document.createElement('div')
      label.classList.add('slash-menu-label')
      label.textContent = item.label
      info.appendChild(label)
      const desc = document.createElement('div')
      desc.classList.add('slash-menu-desc')
      desc.textContent = item.description
      info.appendChild(desc)
      row.appendChild(info)

      row.addEventListener('mouseenter', () => {
        this.selectedIndex = i
        this.render()
      })
      row.addEventListener('click', () => {
        this.command(item)
        this.destroy()
      })
      this.element.appendChild(row)
    })
  }

  updatePosition(rect) {
    if (!rect) return
    this.element.style.left = `${rect.left}px`
    this.element.style.top = `${rect.bottom + 8}px`
  }

  onKeyDown({ event }) {
    if (event.key === 'ArrowUp') {
      this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length
      this.render()
      return true
    }
    if (event.key === 'ArrowDown') {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length
      this.render()
      return true
    }
    if (event.key === 'Enter') {
      if (this.items[this.selectedIndex]) {
        this.command(this.items[this.selectedIndex])
        this.destroy()
      }
      return true
    }
    return false
  }

  destroy() {
    this.element.remove()
  }
}

/* ------------------------------------------------------------------ */
/*  Extension                                                          */
/* ------------------------------------------------------------------ */

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase()
          return COMMANDS.filter(c =>
            c.label.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
          )
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          executeCommand(editor, props.id)
        },
        render: () => {
          let menu

          return {
            onStart(props) {
              menu = new SlashMenu()
              menu.show(props.items, props.command)
              menu.updatePosition(props.clientRect?.())
            },
            onUpdate(props) {
              if (!menu) return
              menu.items = props.items
              menu.selectedIndex = 0
              menu.command = props.command
              menu.render()
              menu.updatePosition(props.clientRect?.())
            },
            onKeyDown(props) {
              if (!menu) return false
              return menu.onKeyDown(props)
            },
            onExit() {
              if (menu) menu.destroy()
              menu = null
            },
          }
        },
      }),
    ]
  },
})
