import type {
  Block,
  BlockProvider,
  Line,
  NeoEvent,
  NeoEventListener,
  NeoEventCallback,
  NeoMDEOptions,
  TransformedLine,
  Transformer,
} from "./types"
import defaultBlockProviders from "./defaults"
import { getNeoNodeInfo } from "./node"
import { transformLine, transformBlock } from "./transformer"

type SelectionWithAnchorNode = Omit<Selection, "anchorNode"> & {
  anchorNode: Node
}

export class NeoMDE {
  #onDestroyed: (() => void)[]
  #selectedLines: number[]
  #listeners: {
    [key in NeoEvent]: NeoEventListener<key>[]
  }
  #content: string
  #output: Node[]
  #blocks: Block[]
  #blockProviders: BlockProvider[]
  #textarea: HTMLTextAreaElement
  #displayElement: HTMLElement

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
    this.#blocks = []
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
    const el = this.#displayElement

    const setSelectedLines = (selection: SelectionWithAnchorNode) => {
      const anchorNode = selection.anchorNode
      const startInfo = getNeoNodeInfo(anchorNode)
      if (startInfo === null) return
      const endInfo =
        "extentNode" in selection && selection.extentNode !== anchorNode
          ? getNeoNodeInfo(selection.extentNode as Node)
          : null

      const newSelectedLines: number[] = []
      if (endInfo === null) {
        newSelectedLines.push(startInfo.lineIdx)
      } else {
        const min = Math.min(startInfo.lineIdx, endInfo.lineIdx)
        const max = Math.max(startInfo.lineIdx, endInfo.lineIdx)
        for (let i = min; i <= max; i++) {
          newSelectedLines.push(i)
        }
      }

      if (
        newSelectedLines.length === this.#selectedLines.length &&
        newSelectedLines.every((v, i) => v === this.#selectedLines[i])
      ) {
        return
      }
      //const anchorOffset = selection.anchorOffset
      this.#selectedLines = newSelectedLines
      this.render()

      console.log(
        "new selection",
        newSelectedLines,
        selection.anchorNode,
        selection.anchorOffset
      )

      // const x = this.#output[1]!.childNodes[0]!

      // const selObj = window.getSelection()!
      //selObj.setPosition(x, anchorOffset)
    }

    const getSelection = (): SelectionWithAnchorNode | null => {
      const sel = document.getSelection()
      if (sel === null || sel.anchorNode === null) return null
      if (!el.contains(sel.anchorNode)) return null
      return sel as SelectionWithAnchorNode
    }

    const handleMouseMove = () => {
      const sel = getSelection()
      if (sel === null) return
      setSelectedLines(sel as SelectionWithAnchorNode)
    }
    el.addEventListener("mousedown", (e) => {
      const sel = getSelection()
      if (sel !== null) setSelectedLines(sel)
      if (e.button !== 0) return
      console.log("l mdown")
      el.addEventListener("mousemove", handleMouseMove)
    })
    el.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return
      console.log("l mup")
      const sel = getSelection()
      if (sel !== null) setSelectedLines(sel)
      el.removeEventListener("mousemove", handleMouseMove)
    })

    // el.addEventListener("keyup", checkSelection)
    // el.addEventListener("input", checkSelection)
    // el.addEventListener("paste", checkSelection)

    const handleChange = () => {
      this.setContent(this.#textarea.value)
    }
    this.#textarea.addEventListener("input", handleChange)
    this.#textarea.addEventListener("change", handleChange)

    this.#onDestroyed.push(() => {
      this.#textarea.removeEventListener("input", handleChange)
      this.#textarea.removeEventListener("change", handleChange)
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
        block,
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
    this.#blocks = blocks
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
