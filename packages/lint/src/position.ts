/** Offsets of each line start. \r\n, \n and a lone \r each end a line. */
export function lineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 10) starts.push(i + 1)
    else if (c === 13 && text.charCodeAt(i + 1) !== 10) starts.push(i + 1)
  }
  return starts
}

/** 1-based line and column; the column counts UTF-16 code units from the line start. */
export function positionAt(starts: readonly number[], offset: number): { line: number; column: number } {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((starts[mid] ?? 0) <= offset) lo = mid
    else hi = mid - 1
  }
  return { line: lo + 1, column: offset - (starts[lo] ?? 0) + 1 }
}
