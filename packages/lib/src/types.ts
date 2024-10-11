import type { NeoMDE } from "./index"

export type LineTransformerContext = {
  line: Line
  children: Node[]
  parentNode?: Element | Text
  instance: NeoMDE
}

export type BlockTransformerContext = {
  lines: Line[]
  children: Node[]
  parentNode?: Element
  instance: NeoMDE
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
  transformers?: (
    | Transformer<TransformerType>
    | Transformer<TransformerType>[]
  )[]
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
  end: number
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
