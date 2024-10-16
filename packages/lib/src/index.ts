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
  #onDestroyed: (() => void)[]
  #selectedLines: number[]
  #listeners: {
    [key in NeoEvent]: NeoEventListener<key>[]
  }
  #content: string
  #output: Node[]
  #blockProviders: BlockProvider[]
  #textarea: HTMLTextAreaElement
  #displayElement: Element

  constructor(options: NeoMDEOptions) {
    this.#onDestroyed = []
    this.#selectedLines = []
    this.#listeners = {
      beforerender: [],
      render: [],
      change: [],
    }
    this.#content = options.initialContent || ""
    this.#output = []
    this.#blockProviders = (
      options.blockProviders ?? defaultBlockProviders()
    ).flat()
    this.#textarea = options.textarea
    this.#displayElement = options.displayElement

    this.bindEventListeners()
    this.render()
  }

  public destroy(): void {
    while (this.#onDestroyed.length) {
      this.#onDestroyed.pop()!()
    }
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

  public getActiveLines(): number[] {
    return this.#selectedLines
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
    const handleChange = () => {
      this.setContent(this.#textarea.value)
    }
    this.#textarea.addEventListener("input", handleChange)
    this.#textarea.addEventListener("change", handleChange)

    const handleSelectionChange = (event: Event) => {
      const target = event.target as HTMLTextAreaElement
      // Get the start and end positions of the selection
      const selectionStart = target.selectionStart
      const selectionEnd = target.selectionEnd

      // Get the lines before and after selection start/end
      const linesBeforeStart = target.value
        .substring(0, selectionStart)
        .split("\n")
      const linesBeforeEnd = target.value.substring(0, selectionEnd).split("\n")

      // Calculate the range of line numbers affected
      const startLine = linesBeforeStart.length
      const endLine = linesBeforeEnd.length
      const newSelectedLines = []
      for (let i = startLine - 1; i < endLine; i++) {
        newSelectedLines.push(i + 1)
      }

      const linesChanged =
        newSelectedLines.length !== this.#selectedLines.length ||
        newSelectedLines.some((line, idx) => line !== this.#selectedLines[idx])

      if (linesChanged) {
        this.#selectedLines = newSelectedLines
        this.render()
      }
    }

    this.#textarea.addEventListener("selectionchange", handleSelectionChange)

    this.#onDestroyed.push(() => {
      this.#textarea.removeEventListener("input", handleChange)
      this.#textarea.removeEventListener("change", handleChange)
      this.#textarea.removeEventListener(
        "selectionchange",
        handleSelectionChange
      )
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
    if (this.#content === "") {
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

    main: while (currentLineIdx < lines.length) {
      const prevLine = lines[currentLineIdx - 1]
      const currentLine = lines[currentLineIdx]!

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
      if (currentProvider && currentBlock) {
        if (currentLine.content === currentProvider.end) {
          prevProvider = currentProvider as BlockProvider | undefined
          currentBlock!.endLine = currentLine
          blocks.push(currentBlock!)
          currentBlock = undefined
          currentProvider = undefined
          currentLineIdx++
          continue
        }
        if (currentBlock.lines.length === 0) {
          // check if we are at the start of a block
          for (const blockProvider of this.#blockProviders) {
            if (currentLine.content !== blockProvider.start) continue
            currentProvider = blockProvider
            currentBlock = {
              provider: blockProvider,
              lines: [],
              startLine: currentLine,
            }
            currentLineIdx++
            continue main
          }
        }
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
        // Apply line-level transformations and add to transformed lines
        const transformedLine = transformLine(line, lineTransformers, this)
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
        content: line,
        idx,
        start: start + idx - 1,
      })
      start = end
      idx++
    }
    return lines
  }
}
