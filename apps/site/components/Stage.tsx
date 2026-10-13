'use client'
import { formatHijri, formatMoney } from '@dualkit/format'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { measureKeyed, playFlip, prefersReducedMotion, useVisible } from '@/lib/motion'
import { BackIcon } from './icons'
import { Segmented } from './Segmented'

type Lang = 'en' | 'ar'
const DUE = new Date('2026-02-18T12:00:00Z')
const ZONE = 'Asia/Dubai'
const AUTO_MS = 4000

const CARD: Record<Lang, Record<string, string>> = {
  en: { title: 'Payment summary', amountL: 'Amount due', amount: formatMoney(1234.5, { currency: 'AED' }), dueL: 'Due date', due: '18 Feb 2026',
    hijriL: 'Hijri', hijri: formatHijri(DUE, { timeZone: ZONE }), items: 'You have 3 items in this order', phoneL: 'Mobile for the receipt', pay: 'Pay now' },
  ar: { title: 'ملخص الدفع', amountL: 'المبلغ المستحق', amount: formatMoney(1234.5, { currency: 'AED', locale: 'ar' }), dueL: 'تاريخ الاستحقاق', due: '18 فبراير 2026',
    hijriL: 'هجري', hijri: formatHijri(DUE, { locale: 'ar', timeZone: ZONE }), items: 'لديك 3 عناصر في هذا الطلب', phoneL: 'رقم الجوال للإيصال', pay: 'إتمام الدفع' },
}
const OPTIONS = [{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية', lang: 'ar' }] as const

/** One card flipping between English and Arabic. Every keyed element springs to its mirrored place. */
export function Stage({ caption }: { caption: string }) {
  const [lang, setLang] = useState<Lang>('en')
  const [auto, setAuto] = useState(true)
  const [held, setHeld] = useState(false)
  const [stageRef, visible] = useVisible<HTMLDivElement>()
  const card = useRef<HTMLDivElement>(null)
  const before = useRef<Map<string, DOMRect> | null>(null)

  const change = (next: Lang) => { if (card.current) before.current = measureKeyed(card.current); setLang(next) }
  useLayoutEffect(() => {
    if (card.current && before.current) playFlip(card.current, before.current)
    before.current = null
  }, [lang])
  useEffect(() => {
    if (!auto || held || !visible || prefersReducedMotion()) return
    const t = setInterval(() => change(lang === 'en' ? 'ar' : 'en'), AUTO_MS)
    return () => clearInterval(t)
  }, [auto, held, visible, lang])

  const c = CARD[lang]
  return (
    <>
      <div className="stage rise" style={{ animationDelay: '1000ms' }} ref={stageRef}
        onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
        <Segmented label="Language" options={OPTIONS} value={lang} onChange={(v) => { setAuto(false); change(v) }} />
        <div className="pay" ref={card} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} onPointerDown={() => setAuto(false)}>
          <div className="head"><span className="back" data-k="back"><BackIcon /></span><span className="title" data-k="title">{c.title}</span></div>
          <div><div className="amt-l" data-k="amtl">{c.amountL}</div><div className="amt" data-k="amt"><bdi suppressHydrationWarning>{c.amount}</bdi></div></div>
          <div className="rows">
            <div className="row"><span className="k" data-k="duel">{c.dueL}</span><span data-k="due"><bdi>{c.due}</bdi></span></div>
            <div className="row"><span className="k" data-k="hijl">{c.hijriL}</span><span data-k="hij"><bdi suppressHydrationWarning>{c.hijri}</bdi></span></div>
          </div>
          <div className="items" data-k="items">{c.items}</div>
          <div>
            <div className="field-l" data-k="phl">{c.phoneL}</div>
            <div className="phone" dir="ltr" data-k="phone"><span className="cc">+971</span><span>050 123 4567</span><span className="ltr-flag">stays LTR</span></div>
          </div>
          <div className="btn" data-k="pay">{c.pay}</div>
        </div>
      </div>
      <p className="stage-cap">{caption}</p>
    </>
  )
}
