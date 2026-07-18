import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import katex from 'katex'

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function renderKatex(latex, container, displayMode) {
  try {
    katex.render(latex || '\\,', container, {
      throwOnError: false,
      displayMode,
    })
  } catch {
    container.textContent = latex
  }
}

function createMathNodeView(displayMode) {
  return ({ node, getPos, editor }) => {
    const tag = displayMode ? 'div' : 'span'
    const dom = document.createElement(tag)
    dom.classList.add('math-node', displayMode ? 'math-display-node' : 'math-inline-node')

    const rendered = document.createElement(tag)
    rendered.classList.add('math-render')
    dom.appendChild(rendered)

    const input = document.createElement(displayMode ? 'textarea' : 'input')
    if (!displayMode) input.type = 'text'
    input.classList.add('math-input')
    input.placeholder = displayMode ? 'LaTeX equation...' : 'LaTeX...'
    input.style.display = 'none'
    dom.appendChild(input)

    let editing = false
    let currentNode = node

    const render = () => renderKatex(currentNode.attrs.latex, rendered, displayMode)

    const open = () => {
      editing = true
      input.value = currentNode.attrs.latex
      input.style.display = ''
      dom.classList.add('editing')
      requestAnimationFrame(() => input.focus())
    }

    const commit = () => {
      if (!editing) return
      editing = false
      input.style.display = 'none'
      dom.classList.remove('editing')
      const pos = getPos()
      if (typeof pos === 'number') {
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(pos, undefined, {
            latex: input.value,
          })
        )
      }
    }

    rendered.addEventListener('click', e => { e.stopPropagation(); open() })

    input.addEventListener('blur', () => requestAnimationFrame(commit))
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !displayMode) { e.preventDefault(); commit(); editor.commands.focus() }
      if (e.key === 'Enter' && displayMode && !e.shiftKey) { e.preventDefault(); commit(); editor.commands.focus() }
      if (e.key === 'Escape') { input.value = currentNode.attrs.latex; commit(); editor.commands.focus() }
      e.stopPropagation()
    })
    input.addEventListener('input', () => {
      renderKatex(input.value, rendered, displayMode)
    })

    render()

    // Auto-open if newly inserted (empty latex) and editor has focus
    if (!node.attrs.latex && editor.isFocused) {
      requestAnimationFrame(() => open())
    }

    return {
      dom,
      update(updatedNode) {
        if (updatedNode.type.name !== currentNode.type.name) return false
        currentNode = updatedNode
        if (!editing) render()
        return true
      },
      selectNode() { open() },
      deselectNode() { if (editing) commit() },
      stopEvent(event) { return editing && dom.contains(event.target) },
      ignoreMutation() { return true },
      destroy() {},
    }
  }
}

/* ------------------------------------------------------------------ */
/*  MathInline                                                         */
/* ------------------------------------------------------------------ */

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { latex: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-math-inline': '',
      class: 'math-node math-inline-node',
    }), node.attrs.latex]
  },

  addNodeView() {
    return createMathNodeView(false)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-e': () => {
        return this.editor.commands.insertContent({
          type: 'mathInline',
          attrs: { latex: '' },
        })
      },
    }
  },

  addProseMirrorPlugins() {
    const nodeType = this.type
    return [
      new Plugin({
        key: new PluginKey('mathInlineInput'),
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== '$') return false
            const { state } = view
            const $from = state.doc.resolve(from)
            const textBefore = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 200),
              $from.parentOffset,
              null,
              '\ufffc'
            )
            const match = textBefore.match(/\$([^$]+)$/)
            if (!match) return false

            const latex = match[1]
            const start = from - latex.length - 1 // -1 for opening $
            const tr = state.tr
              .delete(start, to)
              .insert(start, nodeType.create({ latex }))
            view.dispatch(tr)
            return true
          },
        },
      }),
    ]
  },
})

/* ------------------------------------------------------------------ */
/*  MathDisplay                                                        */
/* ------------------------------------------------------------------ */

export const MathDisplay = Node.create({
  name: 'mathDisplay',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return { latex: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'div[data-math-display]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-math-display': '',
      class: 'math-node math-display-node',
    }), node.attrs.latex]
  },

  addNodeView() {
    return createMathNodeView(true)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-e': () => {
        return this.editor.commands.insertContent({
          type: 'mathDisplay',
          attrs: { latex: '' },
        })
      },
    }
  },
})
