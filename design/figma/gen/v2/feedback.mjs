// Feedback, two directions for Sam to pick: a form band in the footer, or a pill that opens a panel.
// Run: node gen/v2/feedback.mjs, which writes specs/feedback-a-footer.json and specs/feedback-b-panel.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LINE, band, col, row, text } from './parts.mjs'
import { pill } from './parts.mjs'
import { closing, footer } from './home.mjs'

const SPECS = resolve(import.meta.dirname, '../../specs')

export const FEEDBACK = {
  heading: 'Tell me what to fix.',
  lede: 'A bug, a wrong format, a missing piece. It comes straight to me.',
  message: 'What broke, or what is missing?',
  email: 'Email, if you want a reply',
  send: 'Send',
  sent: 'Sent. Thank you, I read every one.',
  pill: 'Feedback',
}

const field = (name, placeholder, h) => row(name, [text(placeholder, 'V2UI', { color: 'color.text.faint', name: 'Placeholder' })],
  { w: 'fill', ...(h ? { h, align: 'start' } : { align: 'center' }), pad: { block: 'space.snug', inline: 'space.snug' }, radius: 'radius.media', fill: 'color.surface.page', stroke: LINE })

const form = (name, extra = {}) => col(name, [
  field('Message', FEEDBACK.message, 120),
  row('Form end', [field('Email', FEEDBACK.email), pill(FEEDBACK.send, { primary: true })], { w: 'fill', gap: 'space.tight', align: 'center' }),
], { w: 'fill', gap: 'space.tight', ...extra })

export function feedbackFooter() {
  const band_ = band('Feedback', [row('Feedback row', [
    col('Feedback copy', [text(FEEDBACK.heading, 'V2H2', { name: 'Heading' }), text(FEEDBACK.lede, 'V2Lede', { color: 'color.text.soft', w: 'fill', name: 'Lede' })],
      { w: 'size.v2.half', gap: 'space.snug' }),
    form('Feedback form', { w: 'size.v2.half' }),
  ], { w: 'fill', justify: 'between', align: 'start' })], { pad: { block: 'space.v2.inner' } })
  const f = footer()
  return {
    screen: 'Dualkit · Feedback A · Footer form · Desktop',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    children: [closing(), { ...f, children: [band_, ...f.children] }],
  }
}

export function feedbackPanel() {
  const panel = col('Feedback panel', [
    text(FEEDBACK.heading, 'Title', { name: 'Heading' }),
    text(FEEDBACK.lede, 'V2Small', { color: 'color.text.soft', w: 'fill', name: 'Lede' }),
    form('Panel form'),
  ], { w: 360, gap: 'space.snug', pad: 'space.group', radius: 'radius.media', fill: 'color.surface.page', stroke: LINE, abs: { end: 32, top: 232 } })
  const trigger = row('Feedback trigger', [pill(FEEDBACK.pill)], { abs: { end: 32, top: 560 } })
  return {
    screen: 'Dualkit · Feedback B · Floating panel · Desktop',
    size: ['size.desktop', 'hug'], direction: 'ltr', lang: 'en', fill: 'color.surface.ground', textColor: 'color.text.primary',
    children: [closing(), footer(), panel, trigger],
  }
}

mkdirSync(SPECS, { recursive: true })
writeFileSync(resolve(SPECS, 'feedback-a-footer.json'), JSON.stringify(feedbackFooter(), null, 2) + '\n')
writeFileSync(resolve(SPECS, 'feedback-b-panel.json'), JSON.stringify(feedbackPanel(), null, 2) + '\n')
console.log('specs written')
