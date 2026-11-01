import { describe, expect, it } from 'vitest'
import { findEnglish } from '../src/missed'

const texts = (code: string): string[] => findEnglish(code, 'a.tsx').map((m) => m.text)

describe('findEnglish', () => {
  it('finds JSX text', () => {
    expect(texts('const A = () => <h1>Monthly revenue</h1>')).toEqual(['Monthly revenue'])
  })
  it('finds user-facing attributes and ignores the rest', () => {
    expect(texts('const A = () => <input placeholder="Your email" className="flex gap-2" type="email" />')).toEqual(['Your email'])
  })
  it('finds both branches of a ternary inside JSX', () => {
    expect(texts('const A = ({ on }) => <b>{on ? "Active now" : "Paused for now"}</b>')).toEqual(['Active now', 'Paused for now'])
  })
  it('finds labels in data arrays', () => {
    expect(texts('const nav = [{ title: "Sales report", href: "/sales" }]')).toEqual(['Sales report'])
  })
  it('finds default values of props used as text', () => {
    expect(texts('function A({ label = "Save changes" }) { return <b>{label}</b> }')).toEqual(['Save changes'])
  })
  it('ignores punctuation, numbers, and text already translated', () => {
    expect(texts('const A = ({ t }) => <p>{t("a.b")} 42 / · $</p>')).toEqual([])
  })
  it('ignores code-like values', () => {
    expect(texts('const nav = [{ title: "dashboard_v2", name: "/x" }]')).toEqual([])
  })
  it('ignores Tailwind class lists stored in data', () => {
    expect(texts('const c = { title: "text-red-700 dark:text-red-400" }')).toEqual([])
  })
  it('reports unparsable files as empty rather than throwing', () => {
    expect(texts('const = <')).toEqual([])
  })
})
