export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err<C extends string> = { readonly ok: false; readonly error: { readonly code: C; readonly message: string } }
export type Result<T, C extends string> = Ok<T> | Err<C>

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })
export const err = <C extends string>(code: C, message: string): Err<C> => ({ ok: false, error: { code, message } })
