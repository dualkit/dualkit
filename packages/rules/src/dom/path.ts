const MAX_DEPTH = 4

type SiblingIndex = { nth: Map<Element, number>; total: Map<string, number> }

const GENERATED_ID = /[0-9a-f]{6,}|^:r[^:]*:$/i
const looksGenerated = (id: string): boolean => GENERATED_ID.test(id)
const escape = (doc: Document, value: string): string => doc.defaultView?.CSS?.escape?.(value) ?? value

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

  const unique = new Map<string, boolean>()
  const isUnique = (doc: Document, selector: string): boolean => {
    const hit = unique.get(selector)
    if (hit !== undefined) return hit
    let result = false
    try { result = doc.querySelectorAll(selector).length === 1 } catch { result = false }
    unique.set(selector, result)
    return result
  }

  /** The element's id as a selector, only when it is unique on the page and does not look generated. */
  const idPart = (node: Element): string | null => {
    if (!node.id || looksGenerated(node.id)) return null
    const selector = `${node.tagName.toLowerCase()}#${escape(node.ownerDocument, node.id)}`
    return isUnique(node.ownerDocument, selector) ? selector : null
  }

  /** An id, a data-testid or a class combination unique on the page names the element on its own. */
  const stable = (node: Element): string | null => {
    const tag = node.tagName.toLowerCase()
    const doc = node.ownerDocument
    const byId = idPart(node)
    if (byId) return byId
    const testId = node.getAttribute('data-testid')
    if (testId) {
      const selector = `${tag}[data-testid="${testId.replace(/["\\]/g, '\\$&')}"]`
      if (isUnique(doc, selector)) return selector
    }
    const classes = typeof node.className === 'string' ? node.className.trim().split(/\s+/).filter(Boolean) : []
    if (classes.length > 0) {
      const selector = `${tag}${classes.map((c) => `.${escape(doc, c)}`).join('')}`
      if (isUnique(doc, selector)) return selector
    }
    return null
  }

  const part = (node: Element): string => {
    const tag = node.tagName.toLowerCase()
    const byId = idPart(node)
    if (byId) return byId
    const cls = typeof node.className === 'string' ? node.className.trim().split(/\s+/)[0] : ''
    const parent = node.parentElement
    const index = parent ? indexOf(parent) : null
    const nth = index && (index.total.get(node.tagName) ?? 0) > 1 ? `:nth-of-type(${index.nth.get(node)})` : ''
    return `${tag}${cls ? `.${cls}` : ''}${nth}`
  }

  return (el) => {
    const known = memo.get(el)
    if (known !== undefined) return known
    const direct = stable(el)
    if (direct) { memo.set(el, direct); return direct }
    const parts: string[] = []
    let node: Element | null = el
    while (node && parts.length < MAX_DEPTH && node.tagName !== 'HTML') {
      parts.unshift(part(node))
      if (idPart(node)) break
      node = node.parentElement
    }
    const path = parts.join(' > ')
    memo.set(el, path)
    return path
  }
}
