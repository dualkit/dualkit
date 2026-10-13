// One frame with all eight components, English on the left and Arabic on the right.
import { col, row, rect, text } from './parts.mjs'

const ROWS = [
  ['Button', 'Arrows flip with the reading direction; other icons stay.', { Variant: 'Primary', State: 'Default' }],
  ['Field', 'Values like email and IBAN stay left to right inside Arabic.', { State: 'Filled' }],
  ['Digit input', 'Takes Arabic-Indic digits; the boxes never reverse.', { State: 'Typing' }],
  ['Amount', 'AED and SAR in either digit system, isolated from the sentence.', { Currency: 'AED' }],
  ['Date', 'Gregorian and Umm al-Qura Hijri, pinned to Gulf time.', { Calendar: 'Gregorian' }],
  ['Tabs', 'Order and arrow keys follow the direction.', { Active: 'First' }],
  ['Sheet', 'Opens from the side reading ends on; actions mirror.', {}],
  ['Toast', 'Mixed Arabic and English messages read in the right order.', { Tone: 'Success' }],
]

const hline = (name) => rect(name, 1, 1, 'color.border.subtle', { w: 'fill', h: 1 })

export function overview() {
  const cell = (name, props, script) => col(`${name} ${script}`, [{ instance: name, name: `${name} instance`, props: { Script: script, ...props } }],
    { w: 'fill', align: script === 'Ar' ? 'end' : 'start', pad: { block: 'space.stack.lg' } })
  const line = ([name, why, props]) => [
    row(`${name} row`, [
      col(`${name} about`, [text(name, 'En/Title', { name: 'Name' }), text(why, 'En/Caption', { name: 'Why', color: 'color.text.secondary', w: 'fill' })], { w: 280, gap: 'space.stack.xs', pad: { block: 'space.stack.lg' } }),
      cell(name, props, 'En'), cell(name, props, 'Ar'),
    ], { w: 'fill', gap: 'space.stack.xl', align: 'start' }),
    hline(`${name} rule`),
  ]
  return {
    screen: 'Starter · Overview · EN and AR', size: [1600, 'hug'], direction: 'ltr', lang: 'en',
    fill: 'color.surface.ground', textColor: 'color.text.primary', pad: { block: 'space.stack.xl', inline: 'space.stack.xl' }, gap: 'space.stack.lg',
    children: [
      col('Intro', [
        text('Dualkit Starter', 'En/Heading', { name: 'Title' }),
        text('Eight components, each drawn in both directions from one token file.', 'En/Body', { name: 'Lede', color: 'color.text.secondary' }),
      ], { gap: 'space.stack.sm', pad: { bottom: 'space.stack.lg' } }),
      row('Column heads', [
        row('Head spacer', [], { w: 280, h: 1 }),
        text('English, left to right', 'En/Label', { name: 'English head', color: 'color.text.secondary', w: 'fill' }),
        text('العربية، من اليمين إلى اليسار', 'Ar/Label', { name: 'Arabic head', color: 'color.text.secondary', w: 'fill', align: 'end' }),
      ], { w: 'fill', gap: 'space.stack.xl' }),
      hline('Head rule'),
      ...ROWS.flatMap(line),
    ],
  }
}
