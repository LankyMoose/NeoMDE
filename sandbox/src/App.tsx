import { useEffect, useRef } from "kaioken"
import { createDefaultTransformers, NeoMDE } from "neo-mde"

export function App() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const displayElementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!textAreaRef.current || !displayElementRef.current) return
    new NeoMDE({
      transformers: [createDefaultTransformers()],
      textarea: textAreaRef.current,
      displayElement: displayElementRef.current,
      initialContent: `
\`\`\`
console.log("hello world")
\`\`\`
`,
    })
    return () => {
      //mde.destroy()
    }
  }, [])
  return (
    <div>
      <textarea className="p-2 w-full min-h-96 mb-4" ref={textAreaRef} />
      <div
        className="prose prose-invert text-2xl p-4 bg-neutral-800 rounded"
        ref={displayElementRef}
      />
    </div>
  )
}
