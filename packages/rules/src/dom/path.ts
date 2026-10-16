const MAX_DEPTH = 4

type SiblingIndex = { nth: Map<Element, number>; total: Map<string, number> }

/** A selector-like id for an element, memoised so a big page costs one pass over each sibling list. */
export function makePathOf(): (el: Element) => string {
  const memo = new Map<Element, string>()
  const siblings = new Map<Element, SiblingIndex>()

  const indexOf = (parent: Element): SiblingIndex => {
    const hit = siblings.get(parent)
    if (hit) return hit
    const seen = new Map<string, number>()
    const nth = new Map<Element, number>()
    for (const child of Array.from(parent.children)) {
      const n = (seen.get(child.tagName) ?? 0) + 1
      seen.set(child.tagName, n)
      nth.set(child, n)
    }
    const index = { nth, total: seen }
    siblings.set(parent, index)
    return index
  }

  const part = (node: Element): string => {
    const tag = node.tagName.toLowerCase()
    if (node.id) return `${tag}#${node.id}`
    const cls = typeof node.className === 'string' ? node.className.trim().split(/\s+/)[0] : ''
    const parent = node.parentElement
    const index = parent ? indexOf(parent) : null
    const nth = index && (index.total.get(node.tagName) ?? 0) > 1 ? `:nth-of-type(${index.nth.get(node)})` : ''
    return `${tag}${cls ? `.${cls}` : ''}${nth}`
  }

  return (el) => {
    const known = memo.get(el)
    if (known !== undefined) return known
    const parts: string[] = []
    let node: Element | null = el
    while (node && parts.length < MAX_DEPTH && node.tagName !== 'HTML') {
      parts.unshift(part(node))
      if (node.id) break
      node = node.parentElement
    }
    const path = parts.join(' > ')
    memo.set(el, path)
    return path
  }
}
