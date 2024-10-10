export type WordTransformerContext = {
  content: string
  output?: Element | Text
}

export type LineTransformerContext = {
  content: string
  output?: Element | Text
}

export type BlockTransformerContext = {
  lines: string[]
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
}

type Transformers = {
  block: Transformer<"block">[]
  line: Transformer<"line">[]
  word: Transformer<"word">[]
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

export function createTransformer<T extends TransformerType>(
  type: T,
  transform: TransformerCallback<T>
): Transformer<T> {
  return { type, transform }
}

const defaultTransformers: Transformers = {
  block: [
    createTransformer("block", (context) => {
      context.output = document.createElement("p")
      return context
    }),
  ],
  line: [
    createTransformer("line", (context) => {
      if (context.content.startsWith("# ")) {
        context.output = document.createElement("h1")
        context.content = context.content.slice(2)
      }
      return context
    }),
  ],
  word: [
    // createTransformer("word", (context) => {
    //   context.output = document.createElement("span")
    //   context.output.textContent = context.content
    //   return context
    // }),
  ],
}

export class NeoMDE {
  #content: string
  #output: Node[]
  #displayElement: Element
  #transformers: Transformers
  #textarea: HTMLTextAreaElement
  constructor(options: NeoMDEOptions) {
    this.#content = options.initialContent || ""
    this.#transformers = {
      block: [...defaultTransformers.block],
      line: [...defaultTransformers.line],
      word: [...defaultTransformers.word],
    }
    if (options.transformers) {
      for (const transformer of options.transformers) {
        this.#transformers[transformer.type].push(transformer.transform as any)
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
    this.#content = content
    this.render()
  }

  private render() {
    const blocks: Block[] = [{ lines: [] }]
    const lines: Line[] = this.#content
      .split("\n")
      .map((line) => ({ content: line + "\n" }))

    for (const line of lines) {
      if (line.content.trim() === "") {
        blocks.push({ lines: [] })
      } else {
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
          const node = this.transformWord(word, this.#transformers.word)
          transformedWords.push(node)
        }

        const transformedLine = this.transformLine(
          line.content,
          this.#transformers.line,
          transformedWords
        )
        transformedLines.push(transformedLine)
      }

      const blockNode = this.transformBlock(
        block.lines,
        this.#transformers.block,
        transformedLines
      )
      output.push(blockNode)
    }

    this.#output = output
    this.#textarea.value = this.#content
    this.#displayElement.replaceChildren(...this.#output)
  }

  private transformWord(
    content: string,
    transformers: Transformer<"word">[]
  ): Node {
    const transformed = transformers.reduce<WordTransformerContext>(
      (ctx, { transform }) => transform(ctx),
      {
        content,
        output: undefined,
      }
    )

    return transformed.output || document.createTextNode(transformed.content)
  }
  private transformLine(
    content: string,
    transformers: Transformer<"line">[],
    children: Node[]
  ): TransformedLine {
    const transformed = transformers.reduce<LineTransformerContext>(
      (ctx, { transform }) => transform(ctx),
      {
        content,
        output: undefined,
      }
    )

    if (transformed.output instanceof Element) {
      transformed.output.append(...children)
      transformed.output.normalize()
    }

    return {
      output: transformed.output ?? children,
    }
  }
  private transformBlock(
    lines: Line[],
    transformers: Transformer<"block">[],
    children: TransformedLine[]
  ): Node {
    const transformed = transformers.reduce<BlockTransformerContext>(
      (ctx, { transform }) => transform(ctx),
      {
        lines: lines.map((line) => line.content),
        output: undefined,
      }
    )

    if (!transformed.output) {
      transformed.output = document.createElement("p")
    }
    for (const line of children) {
      transformed.output.append(
        ...(Array.isArray(line.output) ? line.output : [line.output])
      )
    }

    transformed.output.normalize()

    return transformed.output
  }
}

type Line = {
  content: string
}

type TransformedLine = {
  output: Node | Node[]
}

type Block = {
  lines: Line[]
}
