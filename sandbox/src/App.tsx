import { useEffect, useRef } from "kaioken"
import { NeoMDE, NeoMDEOptions } from "neo-mde"

export function App() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const displayElementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!textAreaRef.current || !displayElementRef.current) return
    const mde = new NeoMDE({
      textarea: textAreaRef.current,
      displayElement: displayElementRef.current,
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
