import {
  createBlockProvider,
  createBlockTransformer,
  createLineTransformer,
  createTextTransformer,
} from "./transformer.js"
import { BlockProvider } from "./types.js"
import { isBlockElement } from "./utils.js"

export const MD_REGEX = {
  BOLD: /\*\*(.*?)\*\*/g,
  ITALIC: /_(.*?)_/,
  STRIKE: /~~(.*?)~~/,
  CODE: /`([^`]+)`/,
  LINK: /\[(.*?)\]\((.*?)\)/,
  IMAGE: /!\[IMAGE\]\((.*?)\)\s*(.*)/i,
  ORDERED_LIST_ITEM: /(\d+)\. (.*)/,
}

const DEFAULT_TRANSFORMERS = {
  // wrap lines in heading tags if they start with 1-6 #s
  HEADING_LINE: createLineTransformer((ctx) => {
    let i = 0
    for (; i < 6; i++) {
      if (ctx.line.content[i] !== "#") {
        break
      }
    }
    if (i > 0) {
      ctx.parent = { node: document.createElement(`h${i}`) }
      ctx.defineRangeDisplay({
        start: 0,
        end: i,
        display: {
          default: () => null,
          active: () => document.createTextNode("#".repeat(i)),
        },
      })
    }
  }),
  BLOCKQUOTE_LINE: createLineTransformer((ctx) => {
    if (!ctx.line.content.startsWith("> ")) return
    ctx.parent = { node: document.createElement("blockquote") }
    ctx.defineRangeDisplay({
      start: 0,
      end: 2,
      display: {
        default: () => null,
        active: () => document.createTextNode("> "),
      },
    })
  }),
  HR_LINE: createLineTransformer((ctx) => {
    if (!ctx.line.content.startsWith("---")) return
    ctx.parent = { node: document.createElement("hr") }
    ctx.defineRangeDisplay({
      start: 0,
      end: 3,
      display: {
        default: () => null,
        active: () => document.createTextNode("---"),
      },
    })
  }),
  // wrap lines in li tags if they start with "- ", handle checkboxes
  LIST_LINE: createLineTransformer((ctx) => {
    if (ctx.line.content.startsWith("- ")) {
      ctx.parent = { node: document.createElement("li") }
      if (ctx.line.content.startsWith("- [ ] ")) {
        ctx.defineRangeDisplay({
          start: 0,
          end: 5,
          display: {
            default: () => {
              const handleChange = () => {
                const start = ctx.line.start + 3
                const end = ctx.line.start + 4
                ctx.instance.setContentAtRange({ start, end }, "x")
              }
              const checkbox = Object.assign(document.createElement("input"), {
                type: "checkbox",
                onchange: handleChange,
              })
              ctx.instance.once("beforerender", () => {
                checkbox.removeEventListener("change", handleChange)
              })
              return checkbox
            },
            active: () => document.createTextNode("- [ ]"),
          },
        })
      } else if (ctx.line.content.startsWith("- [x] ")) {
        ctx.defineRangeDisplay({
          start: 0,
          end: 5,
          display: {
            default: () => {
              const handleChange = () => {
                const start = ctx.line.start + 3
                const end = ctx.line.start + 4
                ctx.instance.setContentAtRange({ start, end }, " ")
              }
              const checkbox = Object.assign(document.createElement("input"), {
                type: "checkbox",
                checked: true,
                onchange: handleChange,
              })
              ctx.instance.once("beforerender", () => {
                checkbox.removeEventListener("change", handleChange)
              })
              return checkbox
            },
            active: () => document.createTextNode("- [x]"),
          },
        })
      } else {
        ctx.defineRangeDisplay({
          start: 0,
          end: 2,
          display: {
            default: () => null,
            active: () => document.createTextNode("- "),
          },
        })
      }
    }
    const numericPrefixMatch = MD_REGEX.ORDERED_LIST_ITEM.exec(ctx.line.content)
    if (numericPrefixMatch === null) return

    ctx.parent = { node: document.createElement("li") }
    ctx.defineRangeDisplay({
      start: 0,
      end: (numericPrefixMatch[1] || "1").length + 1,
      display: {
        default: () => null,
        active: () => null,
      },
    })
  }),
  // wrap blocks in ul tags if they contain only li elements
  LIST_BLOCK: createBlockTransformer((ctx) => {
    if (
      ctx.children.length > 0 &&
      ctx.children.every((n) => n.nodeName.toLowerCase() === "li")
    ) {
      const firstLine = ctx.lines[0]
      if (!firstLine) return
      const isNumeric = MD_REGEX.ORDERED_LIST_ITEM.test(firstLine.content)

      ctx.parent = {
        node: isNumeric
          ? document.createElement("ol")
          : document.createElement("ul"),
      }
    }
  }),
  // wrap blocks in p tags if they don't already contain a block element
  PARAGRAPH_BLOCK: createBlockTransformer((ctx) => {
    if (ctx.children.some(isBlockElement)) {
      return
    }
    ctx.parent = { node: document.createElement("p") }
  }),
  // similar to TEXT.LINK - parse lines in the format of ![Image](link)
  IMAGE_LINE: createLineTransformer((ctx) => {
    if (!ctx.line.content.startsWith("![")) return
    const match = MD_REGEX.IMAGE.exec(ctx.line.content)
    if (!match || !match[1]) return
    const img = document.createElement("img")
    img.src = match[1]
    img.title = match[2] ?? ""
    ctx.parent = { node: img }
  }),
  // wrap code blocks in pre tags
  CODE_BLOCK: createBlockTransformer((ctx) => {
    const parentNode = document.createElement("pre")
    const slot = parentNode.appendChild(document.createElement("code"))
    ctx.parent = {
      node: parentNode,
      slot,
    }
  }),
  TEXT: {
    ITALIC: createTextTransformer(MD_REGEX.ITALIC, () => ({
      node: document.createElement("i"),
    })),
    BOLD: createTextTransformer(MD_REGEX.BOLD, () => ({
      node: document.createElement("b"),
    })),
    STRIKE: createTextTransformer(MD_REGEX.STRIKE, () => ({
      node: document.createElement("del"),
    })),
    CODE: createTextTransformer(MD_REGEX.CODE, () => ({
      node: document.createElement("code"),
    })),
    LINK: createTextTransformer(MD_REGEX.LINK, (match) => {
      const element = document.createElement("a")
      element.setAttribute("href", match[2] ?? "")
      return { node: element }
    }),
  },
}

export const GENERIC_BLOCK_TRANSFORMERS = [
  DEFAULT_TRANSFORMERS.PARAGRAPH_BLOCK,
  DEFAULT_TRANSFORMERS.HEADING_LINE,
  DEFAULT_TRANSFORMERS.LIST_LINE,
  DEFAULT_TRANSFORMERS.LIST_BLOCK,
  DEFAULT_TRANSFORMERS.IMAGE_LINE,
  DEFAULT_TRANSFORMERS.BLOCKQUOTE_LINE,
  DEFAULT_TRANSFORMERS.HR_LINE,
  Object.values(DEFAULT_TRANSFORMERS.TEXT),
]

export default function defaultBlockProviders(): BlockProvider[] {
  const codeBlockProvider = createBlockProvider({
    start: "```\n",
    end: "```\n",
    transformers: [DEFAULT_TRANSFORMERS.CODE_BLOCK],
  })
  const genericBlockProvider = createBlockProvider({
    start: "\n",
    end: "\n",
    useEndOfPrevAsStartOfNext: true,
    transformers: GENERIC_BLOCK_TRANSFORMERS,
  })
  return [codeBlockProvider, genericBlockProvider]
}
