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
  BlockProvider,
  BlockProviderOptions,
} from "./types"

export const createBlockProvider = (
  options: BlockProviderOptions
): BlockProvider => ({
  ...options,
  transformers: options.transformers.flat(),
})

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
    { line, children, instance }
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
