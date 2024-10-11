import {
  BlockTransformerContext,
  Line,
  LineTransformerContext,
  TransformedBlock,
  TransformedLine,
  Transformer,
  BlockTransformerCallback,
  LineTransformerCallback,
} from "./types"
import { isBlockElement } from "./utils"

const REGEX = {
  BOLD: /\*\*(.*?)\*\*/g,
  ITALIC: /_(.*?)_/,
  BOLD_ITALIC: /_\*\*(.*?)\*\*_/,
  STRIKE: /~~(.*?)~~/,
  CODE: /`(.*?)`/,
  LINK: /\[(.*?)\]\((.*?)\)/,
}

export const DEFAULT_TRANSFORMERS: Transformer<any>[] = [
  // find _**bold italic text**_ and wrap it in a <b> tag and a <i> tag
  createLineTransformer((ctx) => {
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i]
      if (child instanceof Text && child.textContent) {
        let match: RegExpMatchArray | null
        while ((match = REGEX.BOLD_ITALIC.exec(child.textContent))) {
          const node = child.splitText(match.index!)
          const wrapper = document.createElement("b")
          const inner = document.createElement("i")
          const nextSibling = node.splitText(match[0].length)
          inner.appendChild(document.createTextNode(match[1]))
          wrapper.appendChild(inner)
          ctx.children.splice(i + 1, 0, wrapper, nextSibling)
          i++
        }
      }
    }
    return ctx
  }),
  // find **bold text** and wrap it in a <b> tag and a <i> tag
  createLineTransformer((ctx) => {
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i]
      if (child instanceof Text && child.textContent) {
        let match: RegExpMatchArray | null
        while ((match = REGEX.BOLD.exec(child.textContent))) {
          const node = child.splitText(match.index!)
          const wrapper = document.createElement("b")
          const nextSibling = node.splitText(match[0].length)
          wrapper.appendChild(document.createTextNode(match[1]))
          ctx.children.splice(i + 1, 0, wrapper, nextSibling)
          i++
        }
      }
    }
    return ctx
  }),

  // find ~~strikethrough text~~ and wrap it in a <del> tag
  createLineTransformer((ctx) => {
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i]
      if (child instanceof Text && child.textContent) {
        let match: RegExpMatchArray | null
        while ((match = REGEX.STRIKE.exec(child.textContent))) {
          const node = child.splitText(match.index!)
          const wrapper = document.createElement("del")
          const nextSibling = node.splitText(match[0].length)
          wrapper.appendChild(document.createTextNode(match[1]))
          ctx.children.splice(i + 1, 0, wrapper, nextSibling)
          i++
        }
      }
    }
    return ctx
  }),

  // find _italic text_ and wrap it in a <i> tag
  createLineTransformer((ctx) => {
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i]
      if (child instanceof Text && child.textContent) {
        let match: RegExpMatchArray | null
        while ((match = REGEX.ITALIC.exec(child.textContent))) {
          const node = child.splitText(match.index!)
          const wrapper = document.createElement("i")
          const nextSibling = node.splitText(match[0].length)
          wrapper.appendChild(document.createTextNode(match[1]))
          ctx.children.splice(i + 1, 0, wrapper, nextSibling)
          i++
        }
      }
    }
    return ctx
  }),
  // find `inline code text` and wrap it in a <code> tag
  createLineTransformer((ctx) => {
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i]
      if (child instanceof Text && child.textContent) {
        let match: RegExpMatchArray | null
        while ((match = REGEX.CODE.exec(child.textContent))) {
          const node = child.splitText(match.index!)
          const wrapper = document.createElement("code")
          const nextSibling = node.splitText(match[0].length)
          wrapper.appendChild(document.createTextNode(match[1]))
          ctx.children.splice(i + 1, 0, wrapper, nextSibling)
          i++
        }
      }
    }
    return ctx
  }),

  // find [link text](https://domain.com) and wrap it in a <a> tag
  createLineTransformer((ctx) => {
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i]
      if (child instanceof Text && child.textContent) {
        let match: RegExpMatchArray | null
        while ((match = REGEX.LINK.exec(child.textContent))) {
          const node = child.splitText(match.index!)
          const wrapper = document.createElement("a")
          const nextSibling = node.splitText(match[0].length)
          wrapper.appendChild(document.createTextNode(match[1]))
          wrapper.href = match[2]
          ctx.children.splice(i + 1, 0, wrapper, nextSibling)
          i++
        }
      }
    }
    return ctx
  }),
  // wrap blocks in p tags if they don't already contain a block element
  createBlockTransformer((ctx) => {
    if (ctx.children.some(isBlockElement)) {
      return ctx
    }
    ctx.parentNode = document.createElement("p")
    return ctx
  }),
  // wrap lines in heading tags if they start with 1-6 #s
  createLineTransformer((ctx) => {
    let i = 0
    for (; i < 6; i++) {
      if (ctx.content[i] !== "#") {
        break
      }
    }
    if (i > 0) {
      ctx.parentNode = document.createElement(`h${i}`)
    }
    return ctx
  }),
  // wrap lines in li tags if they start with "- "
  createLineTransformer((ctx) => {
    if (ctx.content.startsWith("- ")) {
      ctx.parentNode = document.createElement("li")
    }
    return ctx
  }),
  // wrap blocks in ul tags if they contain only li elements
  createBlockTransformer((ctx) => {
    if (
      ctx.children.length > 0 &&
      ctx.children.every((n) => n.nodeName.toLowerCase() === "li")
    ) {
      ctx.parentNode = document.createElement("ul")
    }
    return ctx
  }),
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

export function transformLine(
  content: string,
  transformers: Transformer<"line">[],
  children: Node[]
): TransformedLine {
  const transformed = transformers.reduce<LineTransformerContext>(
    (ctx, { transform }) => transform(ctx),
    {
      content,
      children,
      parentNode: undefined,
    }
  )

  if (transformed.parentNode instanceof Element) {
    transformed.parentNode.append(...children)
    transformed.parentNode.normalize()
  }

  return {
    output: transformed.parentNode ?? children,
  }
}

export function transformBlock(
  lines: Line[],
  transformers: Transformer<"block">[],
  children: TransformedLine[]
): TransformedBlock {
  const transformed = transformers.reduce<BlockTransformerContext>(
    (ctx, { transform }) => transform(ctx),
    {
      lines: lines.map((line) => line.content),
      children: children.map((line) => line.output).flat(),
      parentNode: undefined,
    }
  )

  if (transformed.parentNode) {
    for (const line of children) {
      transformed.parentNode.append(
        ...(Array.isArray(line.output) ? line.output : [line.output])
      )
    }
    transformed.parentNode.normalize()
    return {
      output: transformed.parentNode,
    }
  }

  return {
    output: children,
  }
}
