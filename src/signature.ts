type Signature = { hash: string; count: number }

function signature(root: Element): Signature {
  let hash = 0x811c9dc5
  let count = 0
  for (const element of [root, ...root.querySelectorAll("*")]) {
    count++
    const text = [
      element.tagName,
      element.getAttribute("role"),
      element.getAttribute("aria-label"),
      element.getAttribute("data-slot"),
    ].join("|")
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  return { hash: (hash >>> 0).toString(16).padStart(8, "0"), count }
}

export { signature }
export type { Signature }
