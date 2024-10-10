import { useEffect, useRef } from "kaioken"
import { createTransformer, NeoMDE } from "neo-mde"

export function App() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const displayElementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!textAreaRef.current || !displayElementRef.current) return
    const mde = new NeoMDE({
      transformers: [
        createTransformer("line", (context) => {
          if (context.content.startsWith("# ")) {
            if (context.output instanceof HTMLElement) {
              context.output.classList.add("something")
              return context
            }
            context.output = document.createElement("h1")
          }
          return context
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
      <textarea className="p-2" ref={textAreaRef} />
      <div className="prose prose-invert" ref={displayElementRef} />
    </div>
  )
}
