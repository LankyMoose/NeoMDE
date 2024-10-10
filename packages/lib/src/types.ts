export type WordTransformerContext = {
  content: string
  output?: Element | Text
}
export type LineTransformerContext = {
  content: string
  children: Node[]
  output?: Element | Text
}

export type BlockTransformerContext = {
  lines: string[]
  children: Node[]
  output?: Element
}

export type TransformerType = "block" | "line" | "word"

export type WordTransformerCallback = (
  context: WordTransformerContext
) => WordTransformerContext

export type LineTransformerCallback = (
  context: LineTransformerContext
) => LineTransformerContext

export type BlockTransformerCallback = (
  context: BlockTransformerContext
) => BlockTransformerContext

export type Transformer<T extends TransformerType> = {
  type: T
  transform: TransformerCallback<T>
}

export type NeoMDEOptions = {
  textarea: HTMLTextAreaElement
  displayElement: Element
  initialContent?: string
  transformers?: Transformer<TransformerType>[]
  includeDefaultTransformers?: boolean
}

export type TransformerCallback<T extends TransformerType> = T extends "block"
  ? BlockTransformerCallback
  : T extends "line"
  ? LineTransformerCallback
  : T extends "word"
  ? WordTransformerCallback
  : never

export type TransformerContext<T extends TransformerType> = T extends "block"
  ? BlockTransformerContext
  : T extends "line"
  ? LineTransformerContext
  : T extends "word"
  ? WordTransformerContext
  : never

export type Line = {
  content: string
}

export type TransformedLine = {
  output: Node | Node[]
}

export type TransformedBlock = {
  output: Node | TransformedLine[]
}

export type Block = {
  lines: Line[]
}
