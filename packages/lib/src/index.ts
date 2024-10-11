import {
  Transformer,
  NeoMDEOptions,
  Block,
  Line,
  TransformedLine,
  NeoEvent,
  NeoEventListener,
  NeoEventCallback,
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
  createTextTransformer,
  MD_REGEX,
} from "./transformer.js"

export const createNeoMDE = (options: NeoMDEOptions) => new NeoMDE(options)

export class NeoMDE {
  #listeners: {
    [key in NeoEvent]: NeoEventListener<key>[]
  }
  #content: string
  #output: Node[]
  #displayElement: Element
  #transformers: {
    block: Transformer<"block">[]
    line: Transformer<"line">[]
  }
  #textarea: HTMLTextAreaElement
  constructor(options: NeoMDEOptions) {
    this.#listeners = {
      beforerender: [],
      render: [],
      change: [],
    }
    this.#content = options.initialContent?.trim() || ""
    this.#transformers = {
      block: [],
      line: [],
    }
    if (options.transformers) {
      const flattened = options.transformers.flat()
      for (let i = 0; i < flattened.length; i++) {
        const transformer = flattened[i]
        if (transformer.type === "block") {
          this.#transformers.block.push(transformer as Transformer<"block">)
        } else if (transformer.type === "line") {
          this.#transformers.line.push(transformer as Transformer<"line">)
        }
      }
    }
    this.#output = []
    this.#textarea = options.textarea
    this.#displayElement = options.displayElement

    this.bindEventListeners()
    this.render()
  }

  public on<T extends NeoEvent>(type: T, callback: NeoEventCallback<T>) {
    this.#listeners[type].push({ callback })
  }
  public once<T extends NeoEvent>(type: T, callback: NeoEventCallback<T>) {
    this.#listeners[type].push({ callback, once: true })
  }
  public off<T extends NeoEvent>(type: T, callback: NeoEventCallback<T>) {
    const listeners = this.#listeners[type]
    const idx = listeners.findIndex(
      (listener) => listener.callback === callback
    )
    if (idx !== -1) {
      listeners.splice(idx, 1)
    }
  }

  public getContent() {
    return this.#content
  }
  public getContentAtRange(range: { start: number; end: number }) {
    if (range.start === range.end) {
      return ""
    }
    return this.#content.slice(range.start, range.end)
  }
  public setContent(content: string) {
    if (this.#content === content) {
      return
    }
    this.#content = content
    this.#textarea.value = content
    for (const { callback, once } of this.#listeners.change) {
      callback(this.#content)
      if (once) this.off("change", callback)
    }
    this.render()
  }
  public insertContent(offset: number, content: string) {
    if (offset === 0) {
      return this.setContent(content + this.#content)
    }
    const newContent =
      this.#content.slice(0, offset) + content + this.#content.slice(offset)
    this.setContent(newContent)
  }
  public setContentAtRange(
    range: { start: number; end: number },
    content: string
  ) {
    if (range.start === range.end) {
      return
    }
    const newContent =
      this.#content.slice(0, range.start) +
      content +
      this.#content.slice(range.end)
    this.setContent(newContent)
  }

  private bindEventListeners() {
    this.#textarea.addEventListener("input", () => {
      this.setContent(this.#textarea.value)
    })

    this.#textarea.addEventListener("change", () => {
      this.setContent(this.#textarea.value)
    })
  }

  private render() {
    for (const { callback, once } of this.#listeners.beforerender) {
      callback()
      if (once) this.off("beforerender", callback)
    }
    this.render_impl()
    for (const { callback, once } of this.#listeners.render) {
      callback()
      if (once) this.off("render", callback)
    }
  }

  private render_impl() {
    if (this.#content.trim() === "") {
      this.#output = []
      this.#displayElement.innerHTML = ""
      return
    }

    const blocks: Block[] = []
    const lines: Line[] = []
    let idx = 0
    let start = 0
    let end = 0
    for (const line of this.#content.split("\n")) {
      end += line.length
      lines.push({ content: line, idx, start: start + idx, end: end + idx })
      start = end
      idx++
    }

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
          line,
          this.#transformers.line,
          childNodes,
          this
        )
        transformedLines.push(transformedLine)
      }

      const { output: transformedBlockOutput } = transformBlock(
        block.lines,
        this.#transformers.block,
        transformedLines,
        this
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
