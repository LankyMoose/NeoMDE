import type { NeoMDE } from "./index"

export type TextTransformResult = {
  result: ParentWithChildrenSlot
  range: { start: number; end: number }
  padding: { left: number; right: number }
  content: string
}

export type RangeDisplayDefinition = {
  start: number
  end: number
  display: {
    default: () => Node | null
    active: () => Node | null
  }
}

export type LineTransformerContext = {
  line: Line
  parent?: ParentWithChildrenSlot
  instance: NeoMDE
  transformResults: TextTransformResult[]
  defineRangeDisplay: (rangeDisplayDef: RangeDisplayDefinition) => void
}

export type BlockTransformerContext = {
  lines: Line[]
  children: Node[]
  parent?: ParentWithChildrenSlot
  instance: NeoMDE
}

export type ParentWithChildrenSlot = {
  node: Element
  slot?: Element
}

export type TransformerType = "block" | "line"

export type LineTransformerCallback = (context: LineTransformerContext) => void

export type BlockTransformerCallback = (
  context: BlockTransformerContext
) => void

export type Transformer<T extends TransformerType> = {
  type: T
  transform: TransformerCallback<T>
}

export type NeoMDEOptions = {
  textarea: HTMLTextAreaElement
  displayElement: Element
  initialContent?: string
  blockProviders?: (BlockProvider | BlockProvider[])[]
}

export type TransformerCallback<T extends TransformerType> = T extends "block"
  ? BlockTransformerCallback
  : T extends "line"
  ? LineTransformerCallback
  : never

export type TransformerContext<T extends TransformerType> = T extends "block"
  ? BlockTransformerContext
  : T extends "line"
  ? LineTransformerContext
  : never

export type Line = {
  content: string
  idx: number
  start: number
}

export type TransformedLine = {
  output: Node | Node[]
}

export type TransformedBlock = {
  output: Node | TransformedLine[]
}

export type Block = {
  startLine: Line
  endLine?: Line
  provider: BlockProvider
  lines: Line[]
}

export type NeoEvent = "render" | "beforerender" | "change"
export type NeoEventCallback<T extends NeoEvent> = T extends "render"
  ? () => void
  : T extends "beforerender"
  ? () => void
  : T extends "change"
  ? (value: string) => void
  : never

export type NeoEventListener<T extends NeoEvent> = {
  callback: NeoEventCallback<T>
  once?: boolean
}

export type BlockProviderOptions = {
  start: string
  end: string
  /** only applicable if start is the same as end. */
  useEndOfPrevAsStartOfNext?: boolean

  transformers: (
    | Transformer<TransformerType>
    | Transformer<TransformerType>[]
  )[]
}

export type BlockProvider = {
  start: string
  end: string
  /** only applicable if start is the same as end. */
  useEndOfPrevAsStartOfNext?: boolean
  transformers: Transformer<TransformerType>[]
}
