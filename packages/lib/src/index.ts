const BLOCK_ELEMENTS = [
  "address",
  "article",
  "aside",
  "blockquote",
  "canvas",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "noscript",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]

export function isBlockElement(node: Node) {
  return BLOCK_ELEMENTS.indexOf(node.nodeName.toLowerCase()) > -1
}

export type WordTransformerContext = {
  content: string
  output?: Element | Text
}

export type LineTransformerContext = {
  content: string
  children: Node[]
  output?: Element | Text
}

export type BlockTransformerContext = {
  lines: string[]
  children: Node[]
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
    createTransformer("block", (ctx) => {
      if (ctx.children.some(isBlockElement)) {
        return ctx
      }
      ctx.output = document.createElement("p")
      return ctx
    }),
  ],
  line: [
    createTransformer("line", (ctx) => {
      if (ctx.content.startsWith("# ")) {
        ctx.output = document.createElement("h1")
      }
      return ctx
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
    this.#content = options.initialContent?.trim() || ""
    this.#transformers = {
      block: [...defaultTransformers.block],
      line: [...defaultTransformers.line],
      word: [...defaultTransformers.word],
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

      const { output: transformedBlockOutput } = this.transformBlock(
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
        children,
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
  ): TransformedBlock {
    const transformed = transformers.reduce<BlockTransformerContext>(
      (ctx, { transform }) => transform(ctx),
      {
        lines: lines.map((line) => line.content),
        children: children.map((line) => line.output).flat(),
        output: undefined,
      }
    )

    if (transformed.output) {
      for (const line of children) {
        transformed.output.append(
          ...(Array.isArray(line.output) ? line.output : [line.output])
        )
      }
      transformed.output.normalize()
      return {
        output: transformed.output,
      }
    }

    return {
      output: children,
    }
  }
}

type Line = {
  content: string
}

type TransformedLine = {
  output: Node | Node[]
}

type TransformedBlock = {
  output: Node | TransformedLine[]
}

type Block = {
  lines: Line[]
}
