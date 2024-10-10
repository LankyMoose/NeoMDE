import { useEffect, useRef } from "kaioken"
import { createTransformer, NeoMDE } from "neo-mde"

export function App() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const displayElementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!textAreaRef.current || !displayElementRef.current) return
    new NeoMDE({
      transformers: [
        createTransformer("word", (ctx) => {
          if (
            ctx.content.startsWith("**") &&
            ctx.content.trimEnd().endsWith("**")
          ) {
            ctx.output = document.createElement("strong")
            ctx.output.textContent = ctx.content.trimEnd().slice(2, -2)
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
