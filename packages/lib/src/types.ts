export type LineTransformerContext = {
  content: string
  children: Node[]
  parentNode?: Element | Text
}

export type BlockTransformerContext = {
  lines: string[]
  children: Node[]
  parentNode?: Element
}

export type TransformerType = "block" | "line"

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
  : never

export type TransformerContext<T extends TransformerType> = T extends "block"
  ? BlockTransformerContext
  : T extends "line"
  ? LineTransformerContext
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
