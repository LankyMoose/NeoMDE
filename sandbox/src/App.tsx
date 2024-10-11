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
### test _italic in heading_

- a _**bold italics**_
- b [link](https://github.com/LankyMoose/neo-mde)
- c \`some code\`

hello _**world**_! it's ~~fucking~~ _great_ to be **here** 😁


`,
    })
    return () => {
      //mde.destroy()
    }
  }, [])
  return (
    <div>
      <textarea className="p-2 w-full min-h-48 mb-4" ref={textAreaRef} />
      <div
        className="prose prose-invert text-2xl p-4 bg-neutral-800 rounded"
        ref={displayElementRef}
      />
    </div>
  )
}
