import {
  BlockTransformerContext,
  Line,
  LineTransformerContext,
  TransformedBlock,
  TransformedLine,
  Transformer,
  TransformerCallback,
  TransformerType,
  WordTransformerContext,
} from "./types"
import { isBlockElement } from "./utils"

export const DEFAULT_TRANSFORMERS: Transformer<any>[] = [
  // wrap blocks in p tags if they don't already contain a block element
  createTransformer("block", (ctx) => {
    if (ctx.children.some(isBlockElement)) {
      return ctx
    }
    ctx.output = document.createElement("p")
    return ctx
  }),
  // wrap lines in h1 tags if they start with "# "
  createTransformer("line", (ctx) => {
    if (ctx.content.startsWith("# ")) {
      ctx.output = document.createElement("h1")
    }
    return ctx
  }),
  // wrap lines in li tags if they start with "- "
  createTransformer("line", (ctx) => {
    if (ctx.content.startsWith("- ")) {
      ctx.output = document.createElement("li")
    }
    return ctx
  }),
  // wrap blocks in ul tags if they contain only li elements
  createTransformer("block", (ctx) => {
    if (
      ctx.children.length > 0 &&
      ctx.children.every((n) => n.nodeName.toLowerCase() === "li")
    ) {
      ctx.output = document.createElement("ul")
    }
    return ctx
  }),
]

export function createTransformer<T extends TransformerType>(
  type: T,
  transform: TransformerCallback<T>
): Transformer<T> {
  return { type, transform }
}

export function transformWord(
  content: string,
  transformers: Transformer<"word">[]
): Node {
  const transformed = transformers.reduce<WordTransformerContext>(
    (ctx, { transform }) => transform(ctx),
    {
      content: content,
      output: undefined,
    }
  )

  return transformed.output || document.createTextNode(transformed.content)
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
      output: undefined,
    }
  )

  if (transformed.output instanceof Element) {
    transformed.output.append(...children)
    transformed.output.normalize()
  }

  return {
    output: transformed.output ?? children,
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
      output: undefined,
    }
  )

  if (transformed.output) {
    for (const line of children) {
      transformed.output.append(
        ...(Array.isArray(line.output) ? line.output : [line.output])
      )
    }
    transformed.output.normalize()
    return {
      output: transformed.output,
    }
  }

  return {
    output: children,
  }
}
