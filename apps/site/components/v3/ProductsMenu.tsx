'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useReducer, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { V3 } from '@/lib/v3/copy'
import { LEAVE_MS, clickVia, MENU_CLOSED, PART_COUNT, benchCountdown, daysUntil, insideAny, menuReducer, nextBenchRun, type Box, type MenuVia } from '@/lib/v3/menu'
import { CopyIcon, Mark } from '../icons'
import { GlassLayer } from './GlassLayer'
import { Frame } from './primitives'

const SCROLL_CLOSE_PX = 24
const COPIED_MS = 1500
const DRAWER_ID = 'v3-products'
const NAV_LINKS = [['Docs', '/docs'], ['Bench', '/bench'], ['Updates', '/updates']] as const

/** Where each part's row and docs link go, and the command its install line copies (Bench has none). */
export type MenuPart = { href: string; command: string | null; docs: string; note: string | null }
export type MenuLatest = { title: string; date: string; href: string }

const ARROW = <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true"><path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
const GLYPH = {
  open: <svg viewBox="0 0 21 21" width="21" height="21" fill="none" aria-hidden="true"><path d="M3 7.5H18M3 13.5H18" stroke="currentColor" strokeWidth="1.5" /></svg>,
  close: <svg viewBox="0 0 21 21" width="21" height="21" fill="none" aria-hidden="true"><path d="M5 5L16 16M16 5L5 16" stroke="currentColor" strokeWidth="1.5" /></svg>,
}

/** The press that closed the menu from the scrim must not become a click on whatever lies under the scrim once it lifts. */
const SWALLOW_MS = 800
function swallowNextClick() {
  const swallow = (e: globalThis.MouseEvent) => { e.preventDefault(); e.stopPropagation() }
  addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => removeEventListener('click', swallow, { capture: true }), SWALLOW_MS)
}
const boxOf = (el: Element | null | undefined): Box[] => {
  if (!el) return []
  const r = el.getBoundingClientRect()
  return r.width && r.height ? [{ left: r.left, top: r.top, right: r.right, bottom: r.bottom }] : []
}

/** A click with detail 0 came from Enter or Space, so it opens without animation. */
const viaOf = (e: MouseEvent): MenuVia => clickVia(e.detail)

function CopyLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const code = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      // Clipboard refused (insecure origin or denied): select the command so it can be copied by hand, and claim nothing.
      const range = document.createRange()
      if (code.current) range.selectNodeContents(code.current)
      const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(range)
    }
  }
  return (
    <div className="v3-menu-cmd">
      <span className="v3-mono v3-menu-faint" aria-hidden="true">$</span>
      <code ref={code} className="v3-mono">{command}</code>
      {/* The icon and the word share one cell and crossfade, so the line never reflows. */}
      <button type="button" className="v3-menu-copy" onClick={copy} aria-label={`Copy ${command}`} data-copied={copied || undefined}>
        <CopyIcon /><span className="v3-small v3-menu-copied" aria-hidden="true">{V3.menu.copied}</span>
      </button>
      <span className="v3-sr" role="status" aria-live="polite">{copied ? V3.menu.copied : ''}</span>
    </div>
  )
}

export function ProductsMenu({ parts, previews, latest, benchDays, end }: {
  parts: readonly MenuPart[]
  previews: readonly ReactNode[]
  latest: MenuLatest | null
  /** Days to the next Bench run as the server saw it; null hides the Bench line. */
  benchDays: number | null
  end: ReactNode
}) {
  const [state, dispatch] = useReducer(menuReducer, MENU_CLOSED)
  const [days, setDays] = useState(benchDays)
  // The preview painting is fetched only once the menu may open: hover or focus on Products warms it, so the first
  // open paints without a flash and a page where the menu never opens never downloads it.
  const [warm, setWarm] = useState(false)
  const warmUp = useCallback(() => setWarm(true), [])
  const drawer = useRef<HTMLDivElement>(null)
  const desktopButton = useRef<HTMLButtonElement>(null)
  const phoneButton = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const rows = useRef<Array<HTMLAnchorElement | null>>([])
  const navRow = useRef<HTMLDivElement>(null)
  const path = usePathname()
  const close = useCallback(() => dispatch({ type: 'close' }), [])

  useEffect(close, [path, close])

  // Closing rules: Escape, a press anywhere outside the drawer's content (its empty band, the scrim, the rest of the
  // page), Products again, a scroll past 24px, and, for a menu the mouse opened, the mouse leaving the nav and the
  // drawer for LEAVE_MS.
  useEffect(() => {
    if (!state.open) return
    const openedAt = scrollY
    const content = () => drawer.current?.querySelector('.v3-menu-frame')
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      trigger.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      const inside = [content(), desktopButton.current, phoneButton.current].some((el) => el?.contains(t))
      if (inside) return
      close()
      if (!navRow.current?.contains(t)) swallowNextClick()
    }
    const onScroll = () => { if (Math.abs(scrollY - openedAt) > SCROLL_CLOSE_PX) close() }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      dispatch({ type: insideAny(e.clientX, e.clientY, [...boxOf(navRow.current), ...boxOf(content())]) ? 'back' : 'away' })
    }
    const onWindowOut = (e: globalThis.MouseEvent) => { if (!e.relatedTarget) dispatch({ type: 'away' }) }
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onDown)
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseout', onWindowOut)
    return () => {
      removeEventListener('keydown', onKey); removeEventListener('pointerdown', onDown); removeEventListener('scroll', onScroll)
      removeEventListener('pointermove', onMove); document.removeEventListener('mouseout', onWindowOut)
    }
  }, [state.open, close])

  // The leave delay: any move back over the nav or the drawer clears `away` and so cancels this timer.
  useEffect(() => {
    if (!state.away) return
    const id = setTimeout(() => dispatch({ type: 'away-elapsed' }), LEAVE_MS)
    return () => clearTimeout(id)
  }, [state.away])

  // Keyboard open: focus moves into the list. Any close with focus inside: focus goes back to the button.
  useEffect(() => {
    if (state.open) {
      if (state.via === 'keyboard') rows.current[0]?.focus()
      if (benchDays !== null) { const now = new Date(); setDays(daysUntil(nextBenchRun(now), now)) }
      return
    }
    if (drawer.current?.contains(document.activeElement)) trigger.current?.focus()
  }, [state.open]) // Runs on open and close only, not on every move.

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    trigger.current = e.currentTarget
    dispatch({ type: 'toggle', via: viaOf(e) })
  }
  const openFromKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowDown' || state.open) return
    e.preventDefault()
    trigger.current = e.currentTarget
    dispatch({ type: 'toggle', via: 'keyboard' })
  }
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (state.active + dir + PART_COUNT) % PART_COUNT
    dispatch({ type: 'move', dir })
    rows.current[next]?.focus()
  }

  const m = V3.menu
  const via = state.via ?? 'pointer'
  const linkProps = { onClick: close }

  return (
    <header className="v3-nav" data-open={state.open || undefined} data-warm={warm || state.open || undefined}>
      <div ref={navRow} className="v3-wrap v3-nav-row">
        <Link className="v3-nav-brand" href="/"><Mark />Dualkit</Link>
        <nav className="v3-nav-links" aria-label="Main">
          <button ref={desktopButton} type="button" className="v3-nav-link" aria-expanded={state.open} aria-controls={DRAWER_ID} onClick={toggle} onKeyDown={openFromKey}
            onPointerEnter={warmUp} onFocus={warmUp}>
            {V3.nav.links[0]}<span className="v3-nav-tick" aria-hidden="true" />
          </button>
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="v3-nav-link" aria-current={path.startsWith(href) ? 'page' : undefined}>
              {label}<span className="v3-nav-tick" aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className="v3-nav-end">
          {end}
          <button ref={phoneButton} type="button" className="v3-nav-burger" aria-expanded={state.open} aria-controls={DRAWER_ID} aria-label={state.open ? 'Close menu' : 'Open menu'} onClick={toggle} onKeyDown={openFromKey}>
            {state.open ? GLYPH.close : GLYPH.open}
          </button>
        </div>
      </div>
      <div className="v3-menu-scrim" aria-hidden="true" />
      <div id={DRAWER_ID} ref={drawer} className="v3-menu" data-open={state.open || undefined} data-via={via} data-step={state.step} inert={!state.open}>
        <div className="v3-wrap v3-menu-band">
          <Frame className="v3-menu-frame" joins={['var(--v3-menu-list)', 'calc(100% - var(--v3-menu-side))']}>
            <div className="v3-menu-cols">
              <ul className="v3-menu-list" onKeyDown={onListKey}>
                {m.parts.map(([no, name, line, tag], k) => (
                  <li key={name}>
                    <Link ref={(el) => { rows.current[k] = el }} href={parts[k]?.href ?? '/docs'} className="v3-menu-row" data-on={state.active === k || undefined}
                      onPointerEnter={() => dispatch({ type: 'hover', index: k, via: 'pointer' })} onFocus={() => dispatch({ type: 'hover', index: k, via: 'keyboard' })} {...linkProps}>
                      <span className="v3-small v3-menu-faint">{no}</span>
                      <span className="v3-menu-words"><span className="v3-step">{name}</span><span className="v3-small v3-menu-soft">{line}</span></span>
                      <span className="v3-small v3-menu-tag">{tag}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="v3-menu-preview">
                <div className="v3-painting v3-menu-painting" aria-hidden="true">
                  <GlassLayer active={state.active} animate={state.step !== 'keyboard'} />
                  {previews.map((p, k) => <div key={k} className="v3-menu-shot" data-part={k} data-on={state.active === k || undefined}>{p}</div>)}
                </div>
                <div className="v3-menu-foot">
                  {parts.map((p, k) => (
                    <div key={k} className="v3-menu-foot-part" data-on={state.active === k || undefined} inert={state.active !== k}>
                      {p.command ? <CopyLine command={p.command} /> : null}
                      <div className="v3-menu-foot-links">
                        <Link href={p.href} className="v3-menu-go" {...linkProps}>{p.docs}{ARROW}</Link>
                        {p.note ? <span className="v3-small v3-menu-faint">{p.note}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="v3-menu-install">
                <span className="v3-small v3-menu-faint">{m.installLabel}</span>
                <CopyLine command={m.command} />
              </div>

              <div className="v3-menu-side">
                <div className="v3-menu-block">
                  <span className="v3-small v3-menu-faint">{m.startLabel}</span>
                  <ul className="v3-menu-start">
                    {START_LINKS.map(([label, href]) => <li key={label}><Link href={href} {...linkProps}>{label}</Link></li>)}
                  </ul>
                </div>
                {latest ? (
                  <div className="v3-menu-block">
                    <span className="v3-small v3-menu-faint">{m.latest[0]}</span>
                    <Link href={latest.href} className="v3-menu-latest" {...linkProps}>{latest.title}</Link>
                    <span className="v3-small v3-menu-soft">{latest.date}</span>
                  </div>
                ) : null}
                {days !== null ? (
                  <div className="v3-menu-block">
                    <span className="v3-small v3-menu-faint">{m.bench[0]}</span>
                    <Link href="/bench" className="v3-menu-count" {...linkProps}><i aria-hidden="true" />{benchCountdown(days)}</Link>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="v3-menu-keys" aria-hidden="true">
              {m.keys.map(([key, what]) => <span key={what}><kbd className="v3-mono">{key}</kbd><span className="v3-small v3-menu-faint">{what}</span></span>)}
            </div>
          </Frame>
        </div>
      </div>
    </header>
  )
}

const START_HREFS: Record<string, string> = { 'Quick start': '/docs#skills', Docs: '/docs', Updates: '/updates', Status: '/status' }
const START_LINKS = V3.menu.start.map((label) => [label, START_HREFS[label] ?? '/docs'] as const)
