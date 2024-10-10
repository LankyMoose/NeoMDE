import { useEffect, useRef } from "kaioken"
import { createTransformer, NeoMDE } from "neo-mde"

export function App() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const displayElementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!textAreaRef.current || !displayElementRef.current) return
    new NeoMDE({
      transformers: [
        createTransformer("line", (ctx) => {
          if (ctx.content.startsWith("- ")) {
            ctx.output = document.createElement("li")
          }
          return ctx
        }),
        createTransformer("block", (ctx) => {
          if (ctx.children.every((n) => n.nodeName.toLowerCase() === "li")) {
            ctx.output = document.createElement("ul")
          }
          return ctx
        }),
      ],
      textarea: textAreaRef.current,
      displayElement: displayElementRef.current,
      initialContent: ``,
    })
    return () => {
      //mde.destroy()
    }
  }, [])
  return (
    <div>
      <textarea className="p-2 w-full min-h-48" ref={textAreaRef} />
      <div className="prose prose-invert" ref={displayElementRef} />
    </div>
  )
}
