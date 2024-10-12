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
  ParentWithChildrenSlot,
  TextTransformResult,
  RangeDisplayDefinition,
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
  transform: (match: RegExpMatchArray) => ParentWithChildrenSlot
): Transformer<"line"> {
  const globalReg = new RegExp(regexp.source, "g")
  const doTransform: LineTransformerCallback = (ctx) => {
    regexp.lastIndex = 0
    // if (regexp === MD_REGEX.ITALIC) debugger
    // if (regexp === MD_REGEX.BOLD) debugger
    const all = ctx.line.content.matchAll(globalReg)
    for (const match of all) {
      if (!match[1]) continue
      const transformResult = transform(match)
      const left = match[0].indexOf(match[1])
      const right = match[0].length - left - match[1].length
      ctx.transformResults.push({
        result: transformResult,
        range: {
          start: match.index,
          end: match.index + match[0].length,
        },
        padding: { left, right },
        content: match[0],
      })
    }
  }
  return createLineTransformer(doTransform)
}

function insertNodeToTextTransformResult(
  result: TextTransformResult,
  node: Node
) {
  if (result.result.slot) {
    result.result.slot.append(node)
    return
  }
  result.result.node.append(node)
}

export function transformLine(
  line: Line,
  transformers: Transformer<"line">[],
  instance: NeoMDE
): TransformedLine {
  const rangeDisplayDefs: RangeDisplayDefinition[] = []
  const defineRangeDisplay = (rangeDisplayDef: RangeDisplayDefinition) => {
    rangeDisplayDefs.push(rangeDisplayDef)
  }
  const ctx: LineTransformerContext = {
    line: { ...line },
    instance,
    transformResults: [],
    defineRangeDisplay,
  }
  for (const transformer of transformers) {
    transformer.transform(ctx)
  }

  const sortedTransformResults = ctx.transformResults.toSorted(
    (a, b) => a.range.start - b.range.start
  )

  const assembledChildren: Node[] = []
  let textOffset = 0
  let resultStack: TextTransformResult[] = []

  const drainStack = () => {
    let currentResult = resultStack.pop()
    let parentResult = resultStack.pop()
    while (currentResult) {
      textOffset = currentResult.range.end
      if (!parentResult) {
        assembledChildren.push(currentResult.result.node)
        currentResult = undefined
        break
      }
      insertNodeToTextTransformResult(parentResult, currentResult.result.node)
      currentResult = parentResult
      parentResult = resultStack.pop()
    }
  }

  let content = ctx.line.content
  const activeLines = ctx.instance.getActiveLines()

  main: while (textOffset < content.length) {
    const applicableRangeDisplays = rangeDisplayDefs.filter(
      (def) => def.start === textOffset
    )
    if (applicableRangeDisplays.length > 0) {
      for (const rangeDisplayDef of applicableRangeDisplays) {
        const rendered =
          activeLines.indexOf(line.idx) > -1
            ? rangeDisplayDef.display.active()
            : rangeDisplayDef.display.default()
        if (rendered !== null) {
          assembledChildren.push(rendered)
        }
        textOffset += rangeDisplayDef.end - rangeDisplayDef.start
        continue main
      }
    }
    let currentResult = resultStack[resultStack.length - 1]
    const nextResult = sortedTransformResults.shift()
    if (!nextResult) {
      // finalize
      if (currentResult) {
        const text = content.slice(
          textOffset,
          currentResult.range.end - currentResult.padding.right
        )
        const textNode = document.createTextNode(text)
        insertNodeToTextTransformResult(currentResult, textNode)
        drainStack()
        currentResult = undefined
        const remainingText = content.slice(textOffset)
        if (remainingText.length > 0) {
          assembledChildren.push(document.createTextNode(remainingText))
        }
      } else {
        const text = content.slice(textOffset)
        const textNode = document.createTextNode(text)
        assembledChildren.push(textNode)
      }
      break
    }
    if (currentResult && nextResult.range.start > currentResult.range.end) {
      // drain stack
      const text = content.slice(
        currentResult.range.start + currentResult.padding.left,
        currentResult.range.end - currentResult.padding.right
      )
      const textNode = document.createTextNode(text)
      insertNodeToTextTransformResult(currentResult, textNode)
      drainStack()
      currentResult = undefined
    }
    if (textOffset < nextResult.range.start + nextResult.padding.left) {
      // append to stack
      const text = content.slice(textOffset, nextResult.range.start)
      const textNode = document.createTextNode(text)
      if (currentResult) {
        insertNodeToTextTransformResult(currentResult, textNode)
      } else {
        assembledChildren.push(textNode)
      }
      textOffset = nextResult.range.start + nextResult.padding.left
    }
    resultStack.push(nextResult)
  }

  if (ctx.parent?.node) {
    const mountNode = ctx.parent.slot ?? ctx.parent.node
    mountNode.append(...assembledChildren)
    mountNode.normalize()
  }

  return {
    output: ctx.parent?.node ?? assembledChildren,
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
