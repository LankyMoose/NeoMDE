import type { NeoMDE } from "./index"
import type {
  BlockTransformerContext,
  Line,
  LineTransformerContext,
  TransformedBlock,
  TransformedLine,
  Transformer,
  BlockTransformerCallback,
  LineTransformerCallback,
} from "./types"
import { isBlockElement } from "./utils.js"

export const MD_REGEX = {
  BOLD: /\*\*(.*?)\*\*/g,
  ITALIC: /_(.*?)_/,
  ITALIC_BOLD: /_\*\*(.*?)\*\*_/,
  STRIKE: /~~(.*?)~~/,
  CODE: /`([^`]+)`/,
  LINK: /\[(.*?)\]\((.*?)\)/,
  IMAGE: /!\[IMAGE\]\((.*?)\)\s*(.*)/i,
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
      ctx.children = [(ctx.children[0] as Text).splitText(i)]
    }
  }),
  // wrap lines in li tags if they start with "- ", handle checkboxes
  LIST_LINE: createLineTransformer((ctx) => {
    if (!ctx.line.content.startsWith("- ")) return
    ctx.parent = { node: document.createElement("li") }
    const children: Node[] = []
    if (ctx.line.content.startsWith("- [] ")) {
      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.checked = false

      const handleChange = () => {
        ctx.instance.insertContent(ctx.line.start + 3, "x")
      }
      checkbox.addEventListener("change", handleChange)
      ctx.instance.once("beforerender", () => {
        checkbox.removeEventListener("change", handleChange)
      })

      children.push(checkbox)
      children.push(document.createTextNode(ctx.line.content.substring(4)))
    } else if (ctx.line.content.startsWith("- [x] ")) {
      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.checked = true

      const handleChange = () => {
        const start = ctx.line.start + 3
        const end = ctx.line.start + 4
        ctx.instance.setContentAtRange({ start, end }, "")
      }

      checkbox.addEventListener("change", handleChange)
      ctx.instance.once("beforerender", () => {
        checkbox.removeEventListener("change", handleChange)
      })

      children.push(checkbox)
      children.push(document.createTextNode(ctx.line.content.substring(5)))
    } else {
      children.push(document.createTextNode(ctx.line.content.substring(2)))
    }
    ctx.children = children
  }),
  // wrap blocks in ul tags if they contain only li elements
  LIST_BLOCK: createBlockTransformer((ctx) => {
    if (
      ctx.children.length > 0 &&
      ctx.children.every((n) => n.nodeName.toLowerCase() === "li")
    ) {
      ctx.parent = { node: document.createElement("ul") }
    }
  }),
  // wrap blocks in p tags if they don't already contain a block element
  PARAGRAPH_BLOCK: createBlockTransformer((ctx) => {
    if (ctx.children.some(isBlockElement)) {
      return
    }
    ctx.parent = { node: document.createElement("p") }
  }),
  CODE_BLOCK_LINE: createLineTransformer((ctx) => {
    if (ctx.line.content === "```") {
      ctx.children = []
    }
  }),
  // similar to TEXT.LINK - parse lines in the format of ![Image](link)
  IMAGE_LINE: createLineTransformer((ctx) => {
    if (!ctx.line.content.startsWith("![")) return
    const match = MD_REGEX.IMAGE.exec(ctx.line.content)
    if (!match) return
    const img = document.createElement("img")
    img.src = match[1]
    img.title = match[2] ?? undefined
    ctx.parent = { node: img }
  }),
  // wrap code blocks in pre tags
  CODE_BLOCK: createBlockTransformer((ctx) => {
    if (ctx.lines.length === 0) return
    if (
      ctx.lines[0].content.trim() !== "```" ||
      ctx.lines[ctx.lines.length - 1].content.trim() !== "```"
    ) {
      return
    }

    const parentNode = document.createElement("pre")
    const slot = parentNode.appendChild(document.createElement("code"))
    ctx.parent = {
      node: parentNode,
      slot,
    }
  }),
  TEXT: {
    ITALIC_BOLD: createTextTransformer(MD_REGEX.ITALIC_BOLD, (match) => {
      const element = document.createElement("b")
      const inner = document.createElement("i")
      inner.appendChild(document.createTextNode(match[1]))
      element.appendChild(inner)
      return element
    }),
    BOLD: createTextTransformer(MD_REGEX.BOLD, (match) => {
      const element = document.createElement("b")
      element.appendChild(document.createTextNode(match[1]))
      return element
    }),
    ITALIC: createTextTransformer(MD_REGEX.ITALIC, (match) => {
      const element = document.createElement("i")
      element.appendChild(document.createTextNode(match[1]))
      return element
    }),
    STRIKE: createTextTransformer(MD_REGEX.STRIKE, (match) => {
      const element = document.createElement("del")
      element.appendChild(document.createTextNode(match[1]))
      return element
    }),
    CODE: createTextTransformer(MD_REGEX.CODE, (match) => {
      const element = document.createElement("code")
      element.appendChild(document.createTextNode(match[1]))
      return element
    }),
    LINK: createTextTransformer(MD_REGEX.LINK, (match) => {
      const element = document.createElement("a")
      element.setAttribute("href", match[2])
      element.appendChild(document.createTextNode(match[1]))
      return element
    }),
  },
}

export const createDefaultTransformers = (): Transformer<any>[] => [
  DEFAULT_TRANSFORMERS.HEADING_LINE,
  DEFAULT_TRANSFORMERS.LIST_LINE,
  DEFAULT_TRANSFORMERS.LIST_BLOCK,
  DEFAULT_TRANSFORMERS.PARAGRAPH_BLOCK,
  DEFAULT_TRANSFORMERS.CODE_BLOCK,
  DEFAULT_TRANSFORMERS.CODE_BLOCK_LINE,
  DEFAULT_TRANSFORMERS.IMAGE_LINE,
  ...Object.values(DEFAULT_TRANSFORMERS.TEXT),
]

export function createBlockTransformer(
  transform: BlockTransformerCallback
): Transformer<"block"> {
  return { type: "block", transform }
}

export function createLineTransformer(
  transform: LineTransformerCallback
): Transformer<"line"> {
  return { type: "line", transform }
}

export function createTextTransformer(
  regexp: RegExp,
  createElementFromMatch: (match: RegExpMatchArray) => Element
): Transformer<"line"> {
  const doTransform: LineTransformerCallback = (ctx) => {
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i]
      if (child instanceof Text && child.textContent) {
        let match: RegExpMatchArray | null
        while ((match = regexp.exec(child.textContent))) {
          const node = child.splitText(match.index!)
          const nextSibling = node.splitText(match[0].length)
          const element = createElementFromMatch(match)
          ctx.children.splice(i + 1, 0, element, nextSibling)
          i++
        }
      } else if (child instanceof Element) {
        const newCtx = { ...ctx, children: Array.from(child.childNodes) }
        doTransform(newCtx)
        child.replaceChildren(...newCtx.children)
      }
    }
  }
  return createLineTransformer(doTransform)
}

export function transformLine(
  line: Line,
  transformers: Transformer<"line">[],
  children: Node[],
  instance: NeoMDE
): TransformedLine {
  const transformed = transformers.reduce<LineTransformerContext>(
    (ctx, { transform }) => (transform(ctx), ctx),
    {
      line,
      children,
      parent: undefined,
      instance,
    }
  )

  if (transformed.parent?.node) {
    const mountNode = transformed.parent.slot ?? transformed.parent.node
    mountNode.append(...transformed.children)
    mountNode.normalize()
  }

  return {
    output: transformed.parent?.node ?? transformed.children,
  }
}

export function transformBlock(
  lines: Line[],
  transformers: Transformer<"block">[],
  children: TransformedLine[],
  instance: NeoMDE
): TransformedBlock {
  const transformed = transformers.reduce<BlockTransformerContext>(
    (ctx, { transform }) => (transform(ctx), ctx),
    {
      lines,
      children: children.map((line) => line.output).flat(),
      parent: undefined,
      instance,
    }
  )

  if (transformed.parent?.node) {
    const mountNode = transformed.parent.slot ?? transformed.parent.node
    for (const line of children) {
      mountNode.append(
        ...(Array.isArray(line.output) ? line.output : [line.output])
      )
    }
    mountNode.normalize()
    return {
      output: transformed.parent.node,
    }
  }

  return {
    output: children,
  }
}
