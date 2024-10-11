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

export const MD_REGEX = {
  BOLD: /\*\*(.*?)\*\*/g,
  ITALIC: /_(.*?)_/,
  ITALIC_BOLD: /_\*\*(.*?)\*\*_/,
  STRIKE: /~~(.*?)~~/,
  CODE: /`(.*?)`/,
  LINK: /\[(.*?)\]\((.*?)\)/,
}

export function createRegexTransformer(
  regexp: RegExp,
  createElementFromMatch: (match: RegExpMatchArray) => Element
): Transformer<"line"> {
  const doTransform = (ctx: LineTransformerContext) => {
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
    return ctx
  }
  return createLineTransformer(doTransform)
}

export const createDefaultTransformers = (): Transformer<any>[] => [
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
      ctx.children = [(ctx.children[0] as Text).splitText(i)]
    }
    return ctx
  }),
  // wrap lines in li tags if they start with "- "
  createLineTransformer((ctx) => {
    if (ctx.content.startsWith("- ")) {
      ctx.parentNode = document.createElement("li")
      ctx.children = [(ctx.children[0] as Text).splitText(2)]
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

  createRegexTransformer(MD_REGEX.ITALIC_BOLD, (match) => {
    const element = document.createElement("b")
    const inner = document.createElement("i")
    inner.appendChild(document.createTextNode(match[1]))
    element.appendChild(inner)
    return element
  }),
  createRegexTransformer(MD_REGEX.BOLD, (match) => {
    const element = document.createElement("b")
    element.appendChild(document.createTextNode(match[1]))
    return element
  }),
  createRegexTransformer(MD_REGEX.ITALIC, (match) => {
    const element = document.createElement("i")
    element.appendChild(document.createTextNode(match[1]))
    return element
  }),
  createRegexTransformer(MD_REGEX.STRIKE, (match) => {
    const element = document.createElement("del")
    element.appendChild(document.createTextNode(match[1]))
    return element
  }),
  createRegexTransformer(MD_REGEX.CODE, (match) => {
    const element = document.createElement("code")
    element.appendChild(document.createTextNode(match[1]))
    return element
  }),
  createRegexTransformer(MD_REGEX.LINK, (match) => {
    const element = document.createElement("a")
    element.appendChild(document.createTextNode(match[1]))
    element.href = match[2]
    return element
  }),
  // wrap blocks in p tags if they don't already contain a block element
  createBlockTransformer((ctx) => {
    if (ctx.children.some(isBlockElement)) {
      return ctx
    }
    ctx.parentNode = document.createElement("p")
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
    transformed.parentNode.append(...transformed.children)
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
