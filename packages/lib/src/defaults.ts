import type { BlockProvider } from "./types"
import {
  createBlockProvider,
  createBlockTransformer,
  createLineTransformer,
  createTextTransformer,
} from "./transformer.js"
import { isBlockElement } from "./utils.js"

export const MD_REGEX = {
  BOLD: /\*\*(.*?)\*\*/g,
  ITALIC: /_(.*?)_/,
  STRIKE: /~~(.*?)~~/,
  CODE: /`([^`]+)`/,
  LINK: /\[(.*?)\]\((.*?)\)/,
  IMAGE: /!\[IMAGE\]\((.*?)\)\s*(.*)/i,
  ORDERED_LIST_ITEM: /^\d+\.\s/,
}

const CHECKBOX_STRING = "- [ ] "
const CHECKBOX_STRING_X = "- [x] "

export const TRANSFORMERS = {
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
  // wrap lines in li tags if they start with digits + ".", eg. "1. "
  LIST_LINE_NUMERIC: createLineTransformer((ctx) => {
    const numericPrefixMatch = MD_REGEX.ORDERED_LIST_ITEM.exec(ctx.line.content)
    if (!numericPrefixMatch?.[0]) return
    ctx.parent = { node: document.createElement("li") }
    ctx.defineRangeDisplay({
      start: 0,
      end: numericPrefixMatch[0].length,
      display: {
        default: () => null,
        active: () => document.createTextNode(numericPrefixMatch[0]),
      },
    })
  }),
  LIST_LINE_CHECKBOX: createLineTransformer((ctx) => {
    const pref = ctx.line.content.substring(0, 6)
    if (pref !== CHECKBOX_STRING && pref !== CHECKBOX_STRING_X) return
    const checked = pref === CHECKBOX_STRING_X
    ctx.parent = { node: document.createElement("li") }
    ctx.defineRangeDisplay({
      start: 0,
      end: 5,
      display: {
        default: () => {
          const handleChange = () => {
            const start = ctx.line.start + 3
            const end = ctx.line.start + 4
            ctx.instance.setContentAtRange({ start, end }, checked ? " " : "x")
          }
          const checkbox = Object.assign(document.createElement("input"), {
            type: "checkbox",
            onchange: handleChange,
            checked,
          })
          ctx.instance.once("beforerender", () => {
            checkbox.removeEventListener("change", handleChange)
          })
          return checkbox
        },
        active: () => document.createTextNode(pref),
      },
    })
  }),
  LIST_LINE: createLineTransformer((ctx) => {
    if (ctx.line.content.substring(0, 2) !== "- ") return
    ctx.parent = { node: document.createElement("li") }
    ctx.defineRangeDisplay({
      start: 0,
      end: 2,
      display: {
        default: () => null,
        active: () => document.createTextNode("- "),
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
    const src = match[1]
    const title = match[2] ?? ""
    ctx.defineRangeDisplay({
      start: 0,
      end: match[0].length,
      display: {
        default: () => {
          return Object.assign(document.createElement("img"), {
            src,
            title,
          })
        },
        active: () => document.createTextNode(match[0]),
      },
    })
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
} as const

const DEFAULT_BLOCK_PROVIDERS = {
  CODE_BLOCK: createBlockProvider({
    start: "```",
    end: "```",
    transformers: [TRANSFORMERS.CODE_BLOCK],
  }),
  GENERIC_BLOCK: createBlockProvider({
    start: "",
    end: "",
    useEndOfPrevAsStartOfNext: true,
    transformers: [
      TRANSFORMERS.PARAGRAPH_BLOCK,
      TRANSFORMERS.HEADING_LINE,
      TRANSFORMERS.LIST_LINE_CHECKBOX,
      TRANSFORMERS.LIST_LINE_NUMERIC,
      TRANSFORMERS.LIST_LINE,
      TRANSFORMERS.LIST_BLOCK,
      TRANSFORMERS.IMAGE_LINE,
      TRANSFORMERS.BLOCKQUOTE_LINE,
      TRANSFORMERS.HR_LINE,
      Object.values(TRANSFORMERS.TEXT),
    ],
  }),
}

export default function defaultBlockProviders(): BlockProvider[] {
  return [
    DEFAULT_BLOCK_PROVIDERS.CODE_BLOCK,
    DEFAULT_BLOCK_PROVIDERS.GENERIC_BLOCK,
  ]
}
