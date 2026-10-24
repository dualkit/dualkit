/** Scope reading shared by the string and format passes: which function is a component, and which names a scope binds. */

export type Node = { type?: string; start?: number; end?: number; [key: string]: unknown }

export const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

const isPascal = (name: unknown): boolean => typeof name === 'string' && /^[A-Z]/.test(name)
export const idName = (node: Node | undefined): unknown => (node?.type === 'Identifier' ? node.name : undefined)

const WRAPPERS = new Set(['memo', 'forwardRef'])

/** Whether a call is `memo(...)`, `forwardRef(...)`, or the same on `React`. */
function isWrapper(call: Node | undefined): boolean {
  const callee = call?.type === 'CallExpression' ? (call.callee as Node) : undefined
  if (callee?.type === 'Identifier') return WRAPPERS.has(callee.name as string)
  return callee?.type === 'MemberExpression' && idName(callee.object as Node) === 'React'
    && WRAPPERS.has(idName(callee.property as Node) as string)
}

/**
 * Whether the function at `ancestors[at]` is a component: PascalCase by its own or its variable's name, or
 * the default export, through any number of memo and forwardRef wrappers.
 */
function isComponent(ancestors: Node[], at: number): boolean {
  const fn = ancestors[at]!
  if (isPascal(idName(fn.id as Node))) return true
  let above = at - 1
  while (above >= 0 && isWrapper(ancestors[above])) above--
  const holder = ancestors[above]
  if (holder?.type === 'VariableDeclarator' && isPascal(idName(holder.id as Node))) return true
  return holder?.type === 'ExportDefaultDeclaration'
}

/** The nearest enclosing component function, or null. */
export function componentOf(ancestors: Node[]): Node | null {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    if (FUNCTIONS.has(ancestors[i]!.type!) && isComponent(ancestors, i)) return ancestors[i]!
  }
  return null
}

/** The names a binding pattern declares. */
function patternNames(pattern: Node | null | undefined): string[] {
  if (!pattern) return []
  switch (pattern.type) {
    case 'Identifier': return [pattern.name as string]
    case 'AssignmentPattern': return patternNames(pattern.left as Node)
    case 'RestElement': return patternNames(pattern.argument as Node)
    case 'TSParameterProperty': return patternNames(pattern.parameter as Node)
    case 'ArrayPattern': return ((pattern.elements as Node[]) ?? []).flatMap(patternNames)
    case 'ObjectPattern': return ((pattern.properties as Node[]) ?? []).flatMap((p) => patternNames((p.type === 'RestElement' ? p : p.value) as Node))
    default: return []
  }
}

/** Whether a statement is a translation hook convert adds: `const t = useTranslations()`, `const { t } = useTranslation()` or `const t = await getTranslations()`. */
export function isOwnHook(statement: Node): boolean {
  const [d, extra] = (statement.declarations as Node[] | undefined) ?? []
  if (statement.type !== 'VariableDeclaration' || !d || extra) return false
  const init = (d.init as Node | null)?.type === 'AwaitExpression' ? ((d.init as Node).argument as Node) : (d.init as Node | null)
  if (init?.type !== 'CallExpression' || ((init.arguments as Node[]) ?? []).length) return false
  const callee = idName(init.callee as Node)
  const id = d.id as Node
  if (id.type === 'Identifier') return id.name === 't' && (callee === 'useTranslations' || callee === 'getTranslations')
  return callee === 'useTranslation' && patternNames(id).join() === 't'
}

/** The names a statement declares in its block. */
function statementNames(statement: Node): string[] {
  const s = statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration' ? (statement.declaration as Node | null) : statement
  if (!s) return []
  if (s.type === 'VariableDeclaration') return isOwnHook(s) ? [] : ((s.declarations as Node[]) ?? []).flatMap((d) => patternNames(d.id as Node))
  if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') return patternNames(s.id as Node)
  if (s.type === 'ImportDeclaration') return ((s.specifiers as Node[]) ?? []).map((spec) => (spec.local as Node).name as string)
  return []
}

/** The names a scope-making node binds, other than a hook convert added. */
export function scopeNames(node: Node): string[] {
  if (FUNCTIONS.has(node.type!)) return [...((node.params as Node[]) ?? []).flatMap(patternNames), ...(node.type === 'FunctionExpression' ? patternNames(node.id as Node) : [])]
  if (node.type === 'BlockStatement' || node.type === 'Program') return ((node.body as Node[]) ?? []).flatMap(statementNames)
  if (node.type === 'CatchClause') return patternNames(node.param as Node)
  if (/^For(In|Of)?Statement$/.test(node.type!)) {
    const head = (node.init ?? node.left) as Node | null
    return head?.type === 'VariableDeclaration' ? statementNames(head) : []
  }
  return []
}

/** Whether a binding named `t` other than convert's own hook is visible where a string sits. */
export const tInScope = (ancestors: Node[]): boolean => ancestors.some((node) => scopeNames(node).includes('t'))
