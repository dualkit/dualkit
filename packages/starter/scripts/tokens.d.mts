export type Token = { path: string; type: string; value: unknown; description: string; unit?: string }
export type TokenMap = Map<string, Token>
export type Resolver = { sets: Record<string, TokenMap>; modifiers: Record<string, { default: string; contexts: Record<string, TokenMap> }>; order: { kind: 'sets' | 'modifiers'; name: string }[] }
export function readResolver(path: string): Resolver
export function flatten(tree: unknown): TokenMap
export function resolveValue(map: TokenMap, path: string): unknown
export function resolveContext(resolver: Resolver, context: Record<string, string>): TokenMap
export function toCss(resolver: Resolver): string
export function toTailwind(resolver: Resolver): string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toFigma(resolver: Resolver): { collections: { name: string; modes: string[]; variables: any[] }[]; skipped: string[] }
export function build(resolverPath: string): Record<string, string>
export const PACKAGE_ROOT: string
