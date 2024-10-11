import {
  Transformer,
  NeoMDEOptions,
  Block,
  Line,
  TransformedLine,
} from "./types"

import { transformBlock, transformLine } from "./transformer.js"

export type {
  LineTransformerContext,
  LineTransformerCallback,
  BlockTransformerContext,
  BlockTransformerCallback,
  TransformerCallback,
  TransformerContext,
  Transformer,
  TransformerType,
  NeoMDEOptions,
} from "./types"

export {
  createDefaultTransformers,
  createBlockTransformer,
  createLineTransformer,
  createRegexTransformer,
  MD_REGEX,
} from "./transformer.js"

export class NeoMDE {
  #content: string
  #output: Node[]
  #displayElement: Element
  #transformers: {
    block: Transformer<"block">[]
    line: Transformer<"line">[]
  } = {
    block: [],
    line: [],
  }
  #textarea: HTMLTextAreaElement
  constructor(options: NeoMDEOptions) {
    this.#content = options.initialContent?.trim() || ""
    if (options.transformers) {
      for (const transformer of options.transformers.flat()) {
        this.#transformers[transformer.type].push(transformer as any)
      }
    }
    this.#output = []
    this.#textarea = options.textarea
    this.#displayElement = options.displayElement

    this.bindEventListeners()
    this.render()
  }

  private bindEventListeners() {
    this.#textarea.addEventListener("input", () => {
      this.setContent(this.#textarea.value)
    })

    this.#textarea.addEventListener("change", () => {
      this.setContent(this.#textarea.value)
    })
  }

  public getContent() {
    return this.#content
  }
  public setContent(content: string) {
    if (this.#content === content) {
      return
    }
    this.#content = content
    this.render()
  }

  private render() {
    if (this.#content.trim() === "") {
      this.#output = []
      this.#displayElement.innerHTML = ""
      return
    }
    const blocks: Block[] = []
    const lines: Line[] = this.#content
      .split("\n")
      .map((line) => ({ content: line + "\n" }))
    for (const line of lines) {
      if (line.content.trim() === "") {
        blocks.push({ lines: [] })
      } else {
        if (blocks.length === 0) {
          blocks.push({ lines: [] })
        }
        const block = blocks[blocks.length - 1]
        block.lines.push(line)
      }
    }

    const output: Node[] = []
    for (const block of blocks) {
      const transformedLines: TransformedLine[] = []

      for (const line of block.lines) {
        let childNodes: Node[] = [document.createTextNode(line.content)]
        // Apply line-level transformations and add to transformed lines
        const transformedLine = transformLine(
          line.content,
          this.#transformers.line,
          childNodes
        )
        transformedLines.push(transformedLine)
      }

      const { output: transformedBlockOutput } = transformBlock(
        block.lines,
        this.#transformers.block,
        transformedLines
      )
      if (Array.isArray(transformedBlockOutput)) {
        output.push(
          ...transformedBlockOutput
            .map((line) =>
              Array.isArray(line.output) ? line.output : [line.output]
            )
            .flat()
        )
      } else {
        output.push(transformedBlockOutput)
      }
    }

    this.#output = output
    this.#textarea.value = this.#content
    this.#displayElement.replaceChildren(...this.#output)
  }
}
