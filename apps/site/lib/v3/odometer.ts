export type OdometerColumn = { char: string; fromDigit: number | null; toDigit: number | null }

const isDigit = (c: string) => c >= '0' && c <= '9'

function split(s: string): { int: string[]; frac: string[] } {
  const i = s.indexOf('.')
  const int = (i === -1 ? s : s.slice(0, i)).split('').filter(isDigit)
  const frac = i === -1 ? [] : s.slice(i + 1).split('').filter(isDigit)
  return { int, frac }
}

/**
 * One column per character of `to`. Digits pair with the digit of `from` in the same
 * place value: integer digits align from the right, fractional digits from the point.
 * Separators and unpaired digits carry null.
 */
export function odometerColumns(from: string, to: string): OdometerColumn[] {
  const f = split(from)
  const t = split(to)
  const dot = to.indexOf('.')
  const intEnd = dot === -1 ? to.length : dot
  let intSeen = t.int.length
  let fracSeen = 0
  return to.split('').map((char, idx) => {
    if (!isDigit(char)) return { char, fromDigit: null, toDigit: null }
    const toDigit = Number(char)
    let src: string | undefined
    if (idx < intEnd) {
      intSeen -= 1
      src = f.int[f.int.length - (t.int.length - intSeen)]
    } else {
      src = f.frac[fracSeen]
      fracSeen += 1
    }
    return { char, fromDigit: src === undefined ? null : Number(src), toDigit }
  })
}
