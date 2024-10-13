import { NeoMDEOptions } from "./types"
import { NeoMDE } from "./neo.js"

export type {
  LineTransformerContext,
  LineTransformerCallback,
  BlockTransformerContext,
  BlockTransformerCallback,
  TransformerCallback,
  TransformerContext,
  Transformer,
  TransformerType,
} from "./types"

export {
  createBlockTransformer,
  createLineTransformer,
  createTextTransformer,
} from "./transformer.js"

export { NeoMDE, type NeoMDEOptions }
export const createNeoMDE = (options: NeoMDEOptions) => new NeoMDE(options)
