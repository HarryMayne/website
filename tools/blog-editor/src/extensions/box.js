import { Node, mergeAttributes } from '@tiptap/core'

/*
 * Box: a bordered container you can write inside, split into a grid of
 * rows and columns, and nest arbitrarily (boxes inside box cells).
 *
 * Structure: box > boxRow+ > boxCell+ (cells hold any block content).
 * The outline colour is a named key mapped to CSS classes so the same
 * markup works in the editor, the server preview, and the published blog.
 */

export const BOX_COLORS = [
  { key: 'grey', label: 'Grey', hex: '#8E8E93' },
  { key: 'red', label: 'Red', hex: '#a85555' },
  { key: 'blue', label: 'Blue', hex: '#4a6fa5' },
  { key: 'green', label: 'Green', hex: '#4e7d5b' },
  { key: 'orange', label: 'Orange', hex: '#c07a3d' },
  { key: 'purple', label: 'Purple', hex: '#7d5ba6' },
]

export function normalizeBoxColor(color) {
  return BOX_COLORS.some(c => c.key === color) ? color : 'grey'
}

export const BoxCell = Node.create({
  name: 'boxCell',
  content: 'block+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-box-cell]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-box-cell': '',
      class: 'blog-box-cell',
    }), 0]
  },
})

export const BoxRow = Node.create({
  name: 'boxRow',
  content: 'boxCell+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-box-row]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-box-row': '',
      class: 'blog-box-row',
    }), 0]
  },
})

export const Box = Node.create({
  name: 'box',
  group: 'block',
  content: 'boxRow+',
  isolating: true,
  selectable: true,

  addAttributes() {
    return {
      color: {
        default: 'grey',
        parseHTML: el => normalizeBoxColor(el.getAttribute('data-color')),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-box]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const color = normalizeBoxColor(node.attrs.color)
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-box': '',
      'data-color': color,
      class: `blog-box blog-box-${color}`,
    }), 0]
  },

  addCommands() {
    return {
      insertBox: () => ({ chain }) => chain().insertContent({
        type: 'box',
        attrs: { color: 'grey' },
        content: [{
          type: 'boxRow',
          content: [{ type: 'boxCell', content: [{ type: 'paragraph' }] }],
        }],
      }).run(),
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let currentNode = node

      const dom = document.createElement('div')
      dom.setAttribute('data-box', '')
      dom.classList.add('blog-box', 'editor-box')

      const applyColor = (color) => {
        BOX_COLORS.forEach(c => dom.classList.remove(`blog-box-${c.key}`))
        dom.classList.add(`blog-box-${normalizeBoxColor(color)}`)
        dom.setAttribute('data-color', normalizeBoxColor(color))
      }
      applyColor(node.attrs.color)

      /* -- helpers ------------------------------------------------- */

      const boxAt = () => {
        const pos = getPos()
        if (typeof pos !== 'number') return null
        const n = editor.state.doc.nodeAt(pos)
        if (!n || n.type.name !== 'box') return null
        return { pos, node: n }
      }

      const rowEntries = (pos, n) => {
        // [{ row, start }] where start = absolute pos of the row node
        const entries = []
        n.forEach((row, offset) => entries.push({ row, start: pos + 1 + offset }))
        return entries
      }

      const setColor = (color) => {
        const loc = boxAt()
        if (!loc) return
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(loc.pos, undefined, {
            ...loc.node.attrs, color,
          })
        )
      }

      const addColumn = () => {
        const loc = boxAt()
        if (!loc) return
        const cellType = editor.state.schema.nodes.boxCell
        let tr = editor.state.tr
        // Insert at the end of each row, back-to-front so positions stay valid
        rowEntries(loc.pos, loc.node).reverse().forEach(({ row, start }) => {
          tr = tr.insert(start + row.nodeSize - 1, cellType.createAndFill())
        })
        editor.view.dispatch(tr)
      }

      const removeColumn = () => {
        const loc = boxAt()
        if (!loc) return
        if (loc.node.firstChild && loc.node.firstChild.childCount <= 1) return
        let tr = editor.state.tr
        rowEntries(loc.pos, loc.node).reverse().forEach(({ row, start }) => {
          if (row.childCount <= 1) return
          let lastOffset = 0
          let lastCell = null
          row.forEach((cell, offset) => { lastOffset = offset; lastCell = cell })
          const from = start + 1 + lastOffset
          tr = tr.delete(from, from + lastCell.nodeSize)
        })
        editor.view.dispatch(tr)
      }

      const addRow = () => {
        const loc = boxAt()
        if (!loc) return
        const { boxRow, boxCell } = editor.state.schema.nodes
        const cols = loc.node.lastChild ? loc.node.lastChild.childCount : 1
        const cells = []
        for (let i = 0; i < cols; i++) cells.push(boxCell.createAndFill())
        editor.view.dispatch(
          editor.state.tr.insert(loc.pos + loc.node.nodeSize - 1, boxRow.create(null, cells))
        )
      }

      const removeRow = () => {
        const loc = boxAt()
        if (!loc || loc.node.childCount <= 1) return
        const entries = rowEntries(loc.pos, loc.node)
        const last = entries[entries.length - 1]
        editor.view.dispatch(
          editor.state.tr.delete(last.start, last.start + last.row.nodeSize)
        )
      }

      const deleteBox = () => {
        const loc = boxAt()
        if (!loc) return
        editor.view.dispatch(editor.state.tr.delete(loc.pos, loc.pos + loc.node.nodeSize))
        editor.commands.focus()
      }

      /* -- controls (editor-only chrome, hover-revealed) ------------ */

      const controls = document.createElement('div')
      controls.classList.add('editor-box-controls')
      controls.contentEditable = 'false'

      const swatchButtons = BOX_COLORS.map(c => {
        const btn = document.createElement('button')
        btn.classList.add('editor-box-swatch')
        btn.style.background = c.hex
        btn.title = c.label
        if (normalizeBoxColor(currentNode.attrs.color) === c.key) btn.classList.add('active')
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); setColor(c.key) })
        controls.appendChild(btn)
        return { key: c.key, btn }
      })

      const sep = document.createElement('span')
      sep.classList.add('editor-box-controls-sep')
      controls.appendChild(sep)

      const makeBtn = (label, title, fn) => {
        const btn = document.createElement('button')
        btn.classList.add('editor-box-btn')
        btn.textContent = label
        btn.title = title
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn() })
        controls.appendChild(btn)
        return btn
      }

      makeBtn('+ Col', 'Add column (horizontal split)', addColumn)
      const delColBtn = makeBtn('− Col', 'Remove last column', removeColumn)
      makeBtn('+ Row', 'Add row (vertical split)', addRow)
      const delRowBtn = makeBtn('− Row', 'Remove last row', removeRow)

      const sep2 = document.createElement('span')
      sep2.classList.add('editor-box-controls-sep')
      controls.appendChild(sep2)

      const delBtn = makeBtn('×', 'Delete box', deleteBox)
      delBtn.classList.add('editor-box-btn-delete')

      const refreshControls = (n) => {
        const color = normalizeBoxColor(n.attrs.color)
        swatchButtons.forEach(s => s.btn.classList.toggle('active', s.key === color))
        delColBtn.disabled = !n.firstChild || n.firstChild.childCount <= 1
        delRowBtn.disabled = n.childCount <= 1
      }
      refreshControls(node)

      const contentDOM = document.createElement('div')
      contentDOM.classList.add('editor-box-content')

      dom.appendChild(controls)
      dom.appendChild(contentDOM)

      return {
        dom,
        contentDOM,
        update(updatedNode) {
          if (updatedNode.type.name !== 'box') return false
          currentNode = updatedNode
          applyColor(updatedNode.attrs.color)
          refreshControls(updatedNode)
          return true
        },
        stopEvent(event) {
          return controls.contains(event.target)
        },
        ignoreMutation(mutation) {
          if (mutation.type === 'selection') return false
          return !contentDOM.contains(mutation.target)
        },
      }
    }
  },
})
