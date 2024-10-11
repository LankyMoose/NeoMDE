import {
  NeoMDEOptions,
  Block,
  Line,
  TransformedLine,
  NeoEvent,
  NeoEventListener,
  NeoEventCallback,
  BlockProvider,
  Transformer,
} from "./types"

import { transformBlock, transformLine } from "./transformer.js"
import defaultBlockProviders from "./defaults.js"

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
  createBlockTransformer,
  createLineTransformer,
  createTextTransformer,
} from "./transformer.js"

export const createNeoMDE = (options: NeoMDEOptions) => new NeoMDE(options)

export class NeoMDE {
  #listeners: {
    [key in NeoEvent]: NeoEventListener<key>[]
  }
  #content: string
  #output: Node[]
  #displayElement: Element
  #blockProviders: BlockProvider[]
  #textarea: HTMLTextAreaElement
  constructor(options: NeoMDEOptions) {
    this.#listeners = {
      beforerender: [],
      render: [],
      change: [],
    }
    this.#content = options.initialContent?.trim() || ""
    const blockProviders = options.blockProviders ?? defaultBlockProviders()
    this.#blockProviders = blockProviders.flat()
    this.#output = []
    this.#textarea = options.textarea
    this.#displayElement = options.displayElement

    this.bindEventListeners()
    this.render()
  }

  public on<T extends NeoEvent>(type: T, callback: NeoEventCallback<T>): void {
    this.#listeners[type].push({ callback })
  }
  public once<T extends NeoEvent>(
    type: T,
    callback: NeoEventCallback<T>
  ): void {
    this.#listeners[type].push({ callback, once: true })
  }
  public off<T extends NeoEvent>(type: T, callback: NeoEventCallback<T>): void {
    const listeners = this.#listeners[type]
    const idx = listeners.findIndex(
      (listener) => listener.callback === callback
    )
    if (idx !== -1) {
      listeners.splice(idx, 1)
    }
  }

  public getContent(): string {
    return this.#content
  }
  public getContentAtRange(range: { start: number; end: number }): string {
    if (range.start === range.end) {
      return ""
    }
    return this.#content.slice(range.start, range.end)
  }
  public setContent(content: string): void {
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
  public insertContent(offset: number, content: string): void {
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
  ): void {
    if (range.start === range.end) {
      return
    }
    const newContent =
      this.#content.slice(0, range.start) +
      content +
      this.#content.slice(range.end)
    this.setContent(newContent)
  }

  private bindEventListeners(): void {
    this.#textarea.addEventListener("input", () => {
      this.setContent(this.#textarea.value)
    })

    this.#textarea.addEventListener("change", () => {
      this.setContent(this.#textarea.value)
    })
  }

  private render(): void {
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
    const lines = this.parseLines()

    let currentLineIdx = 0
    let prevProvider: BlockProvider | undefined = undefined
    let currentProvider: BlockProvider | undefined = undefined
    let currentBlock: Block | undefined = undefined

    while (currentLineIdx < lines.length) {
      const prevLine = lines[currentLineIdx - 1] as Line | undefined
      const currentLine = lines[currentLineIdx]

      if (!currentProvider) {
        for (const blockProvider of this.#blockProviders) {
          if (currentLine.content !== blockProvider.start) continue
          currentProvider = blockProvider
          currentBlock = {
            provider: blockProvider,
            lines: [],
            startLine: currentLine,
          }
          break
        }
        if (!currentProvider && prevProvider) {
          const canCreateFromPrev = !!(
            prevProvider?.useEndOfPrevAsStartOfNext &&
            prevLine?.content === prevProvider.start
          )

          if (canCreateFromPrev) {
            currentProvider = prevProvider
            currentBlock = {
              provider: prevProvider,
              lines: [currentLine],
              startLine: prevLine,
            }
            currentLineIdx++
            continue
          }
        }

        currentLineIdx++
        continue
      }

      if (currentLine.content === currentProvider.end) {
        prevProvider = currentProvider as BlockProvider | undefined
        currentBlock!.endLine = currentLine
        blocks.push(currentBlock!)
        currentBlock = undefined
        currentProvider = undefined
        currentLineIdx++
        continue
      }

      currentBlock!.lines.push(currentLine)
      currentLineIdx++
    }

    if (currentBlock) {
      blocks.push(currentBlock)
    }

    const output: Node[] = []
    for (const block of blocks) {
      const transformedLines: TransformedLine[] = []
      const { transformers } = block.provider

      const lineTransformers = transformers.filter(
        (t) => t.type === "line"
      ) as Transformer<"line">[]

      const blockTransformers = transformers.filter(
        (t) => t.type === "block"
      ) as Transformer<"block">[]

      for (const line of block.lines) {
        let childNodes: Node[] = [document.createTextNode(line.content)]
        // Apply line-level transformations and add to transformed lines
        const transformedLine = transformLine(
          line,
          lineTransformers,
          childNodes,
          this
        )
        transformedLines.push(transformedLine)
      }

      const { output: transformedBlockOutput } = transformBlock(
        block.lines,
        blockTransformers,
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

  private parseLines(): Line[] {
    const lines: Line[] = []
    let idx = 0
    let start = 0
    let end = 0
    const splitContent = ["", ...this.#content.split("\n")]
    for (const line of splitContent) {
      end += line.length
      lines.push({
        content: line + "\n",
        idx,
        start: start + idx - 1,
        end: end + idx - 1,
      })
      start = end
      idx++
    }
    return lines
  }
}
