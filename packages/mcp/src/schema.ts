import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

/** Longest text the format and validate tools accept in one field. */
export const MAX_TEXT_LENGTH = 1000

/**
 * A zod error option that words a missing field and a wrong one as sentences: "Add amount: a number." or
 * "amount must be a number."
 */
export const says = (name: string, what: string) => ({
  error: (issue: { input?: unknown }) => (issue.input === undefined ? `Add ${name}: ${what}.` : `${name} must be ${what}.`),
})

export const text = (name: string, what: string) =>
  z.string(says(name, what)).max(MAX_TEXT_LENGTH, { error: `${name} must be at most ${MAX_TEXT_LENGTH.toLocaleString('en')} characters.` })

/** "a, b or c" */
export const oneOf = (values: readonly string[]): string =>
  values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`

/** `kind` names the tool's variant; any other key is reported as not applying to it. */
export const strictFor = <S extends z.ZodRawShape>(kind: string, shape: S) =>
  z.strictObject(shape, {
    error: (issue) => (issue.code === 'unrecognized_keys' ? `${oneOf(issue.keys)} does not apply to kind ${kind}.` : undefined),
  })

/**
 * The SDK checks arguments against the listed schema before a handler runs, and words a failure as a zod issue
 * dump. Every field here passes any value through that check while keeping its JSON schema, so the handler
 * validates with the strict schema and answers in a plain sentence.
 */
export function lenient<S extends Record<string, z.ZodType>>(shape: S): S {
  // zod's JSON schema export calls the catch with no context to find a default; undefined leaves none.
  const passThrough = (ctx: { input: unknown } | undefined): unknown => ctx?.input
  return Object.fromEntries(Object.entries(shape).map(([key, schema]) => [key, schema.catch(passThrough as never)])) as unknown as S
}

/** The first problem with the input, as one sentence. */
export function firstProblem(error: z.ZodError): string {
  const issue = error.issues[0]
  const message = issue?.message ?? 'The input is not valid.'
  if (/[.?]$/.test(message)) return message
  const where = issue && issue.path.length > 0 ? ` (${issue.path.join('.')})` : ''
  return `The input is not valid${where}: ${message.replace(/^./, (c) => c.toLowerCase())}.`
}

export const result = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
export const failure = (message: string): CallToolResult => ({ content: [{ type: 'text', text: message }], isError: true })

type Extra = { signal?: AbortSignal }
type Run<T> = (input: T, signal?: AbortSignal) => CallToolResult | Promise<CallToolResult>

/** The tool's reply for any input: a strict parse, then the handler, with every error turned into a sentence. */
export function handle<T>(schema: z.ZodType<T>, run: Run<T>): (args: unknown, extra?: Extra) => Promise<CallToolResult> {
  return async (args, extra) => {
    const parsed = schema.safeParse(args ?? {})
    if (!parsed.success) return failure(firstProblem(parsed.error))
    try {
      return await run(parsed.data, extra?.signal)
    } catch (error) {
      return failure(unexpected(error))
    }
  }
}

/** What a tool says when something fails that the input did not cause. */
export const INTERNAL_ERROR = 'Dualkit could not finish this call. Try again, and if it fails again, report it with the input you sent.'

/**
 * @dualkit/format throws RangeError for input it cannot use, and that message is written for the caller, so it is
 * kept (first line only, never the stack). Any other error can carry paths or internals: the client gets one plain
 * sentence and the detail goes to stderr, where an MCP host keeps the server's log.
 */
export function unexpected(error: unknown): string {
  const message = error instanceof RangeError ? error.message.split('\n')[0]!.trim() : ''
  if (message !== '') return /[.?]$/.test(message) ? message : `${message}.`
  logError(error)
  return INTERNAL_ERROR
}

export function logError(error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`dualkit-mcp: ${detail}\n`)
}
