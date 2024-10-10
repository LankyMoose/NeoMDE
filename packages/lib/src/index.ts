import {
  Transformer,
  NeoMDEOptions,
  Block,
  Line,
  TransformedLine,
} from "./types"

import {
  DEFAULT_TRANSFORMERS,
  transformBlock,
  transformLine,
  transformWord,
} from "./transformer.js"

export type {
  WordTransformerContext,
  LineTransformerContext,
  BlockTransformerContext,
  TransformerType,
  WordTransformerCallback,
  LineTransformerCallback,
  BlockTransformerCallback,
  Transformer,
  NeoMDEOptions,
  TransformerCallback,
  TransformerContext,
} from "./types"

export { createTransformer } from "./transformer.js"

export class NeoMDE {
  #content: string
  #output: Node[]
  #displayElement: Element
  #transformers: {
    block: Transformer<"block">[]
    line: Transformer<"line">[]
    word: Transformer<"word">[]
  }
  #textarea: HTMLTextAreaElement
  constructor(options: NeoMDEOptions) {
    this.#content = options.initialContent?.trim() || ""
    if (options.includeDefaultTransformers) {
      this.#transformers = {
        block: [...DEFAULT_TRANSFORMERS.filter((t) => t.type === "block")],
        line: [...DEFAULT_TRANSFORMERS.filter((t) => t.type === "line")],
        word: [...DEFAULT_TRANSFORMERS.filter((t) => t.type === "word")],
      }
    } else {
      this.#transformers = {
        block: [],
        line: [],
        word: [],
      }
    }
    if (options.transformers) {
      for (const transformer of options.transformers) {
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
    console.log("lines", lines, this.#content)
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
        const transformedWords: Node[] = []
        const words = line.content.split(" ")

        for (let i = 0; i < words.length; i++) {
          let word = words[i]
          if (i < words.length - 1) {
            word += " "
          } else {
            word = word.trimEnd()
          }
          const node = transformWord(word, this.#transformers.word)
          transformedWords.push(node)
        }

        const transformedLine = transformLine(
          line.content,
          this.#transformers.line,
          transformedWords
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
