import { useEffect, useRef } from "kaioken"
import { NeoMDE } from "neo-mde"
import defaultBlockProviders from "neo-mde/defaults"

export function App() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const displayElementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!textAreaRef.current || !displayElementRef.current) return
    const mde = new NeoMDE({
      blockProviders: [defaultBlockProviders()],
      textarea: textAreaRef.current,
      displayElement: displayElementRef.current,
      initialContent: `
hello _**world**_! it's ~~fucking~~ _great_ to be **here** 😁

### test _italic in heading_

- **_bold italics_**
- [link test](https://github.com/LankyMoose/neo-mde)
- \`some code\`
- [ ] checkbox
- [x] checked checkbox

1. list item
2. list item
3. list item

> _test blockquote_

---

\`\`\`
console.log("hello world")

function hello() {
  console.log("hello world")
}
\`\`\`

![image](http://upload.wikimedia.org/wikipedia/commons/8/8a/Banana-Single.jpg) banana
`.trimStart(),
    })
    return () => mde.destroy()
  }, [])
  return (
    <div>
      <textarea className="p-2 w-full min-h-96 mb-4" ref={textAreaRef} />
      <div
        //contentEditable
        className="prose prose-invert text-2xl p-4 bg-neutral-800 rounded"
        ref={displayElementRef}
      />
    </div>
  )
}
