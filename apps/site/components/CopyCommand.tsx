'use client'
import { useEffect, useRef, useState } from 'react'
import { CopyIcon } from './icons'

/** A command you click to copy. The sheet icon cross-fades to a tick for 1.6s. */
export function CopyCommand({ command, swapping = false }: { command: string; swapping?: boolean }) {
  const [copied, setCopied] = useState(false)
  const code = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      const range = document.createRange()
      if (code.current) range.selectNodeContents(code.current)
      const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(range)
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button type="button" className={`cmd${copied ? ' copied' : ''}`} onClick={copy} aria-label={`Copy ${command}`}>
      <code ref={code} className={swapping ? 'swap-in' : undefined} key={command}>{command}</code>
      <CopyIcon />
    </button>
  )
}
