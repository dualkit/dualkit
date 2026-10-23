import { renameSync, writeFileSync } from 'node:fs'

/** Write to a temp file in the same folder, then rename, so a killed process never leaves half a file. */
export function writeFileAtomic(file: string, data: string | Buffer): void {
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, data)
  renameSync(temp, file)
}
