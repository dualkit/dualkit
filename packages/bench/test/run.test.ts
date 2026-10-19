import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BenchError, loadScreens, type ModelEntry } from '../src/config'
import { fakeGenerate } from '../src/fake'
import type { Generate } from '../src/providers'
import { currentMonth, runBench } from '../src/run'
import { makeStore } from '../src/store'

const model = (id: string): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id, since: '2026-11' })
const screens = loadScreens().slice(0, 1)
const fastScore = async () => ({ ok: true as const, rulesPassed: 15, score: 40, missing: [], findings: [], screenshot: 'x', pageHeight: 800, unreadableStylesheets: 1 })

describe('runBench', () => {
  it('builds every model, screen, condition and run, then skips them on a rerun', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const opts = { month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore }
    expect(await runBench(opts)).toEqual({ built: 6, skipped: 0, failed: 0 })
    expect(await runBench(opts)).toEqual({ built: 0, skipped: 6, failed: 0 })
  })
  it('records garbage replies as failed builds and redoes them next time', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('fake-garbage')], screens, generate: fakeGenerate, store, score: fastScore })
    expect(out.failed).toBe(6)
    expect(store.list('2026-11').every((r) => !r.ok && r.error === 'No HTML in the reply')).toBe(true)
  })
  it('stops calling a model after three auth failures, and carries on with the next', async () => {
    let calls = 0
    const deny: Generate = async (m) => (m.id === 'locked' ? (calls++, { ok: false, error: 'HTTP 401: no', ms: 1 }) : fakeGenerate(m, { system: '', prompt: '' }))
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('locked'), model('fake-good')], screens, generate: deny, store, score: fastScore })
    expect(calls).toBe(3)
    expect(out.built).toBe(6)
  })
  it('stops calling a model after three identical 400s', async () => {
    let calls = 0
    const bad: Generate = async () => (calls++, { ok: false, error: 'HTTP 400: model does not support system prompts', ms: 1 })
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('bad')], screens, generate: bad, store, score: fastScore })
    expect(calls).toBe(3)
  })
  it('keeps calling a model whose 4xx errors differ, or that is rate limited', async () => {
    let calls = 0
    const varied: Generate = async () => (calls++, { ok: false, error: `HTTP 400: request ${calls}`, ms: 1 })
    await runBench({ month: '2026-11', models: [model('varied')], screens, generate: varied, store: makeStore(mkdtempSync(join(tmpdir(), 'run-'))), score: fastScore })
    expect(calls).toBe(6)
    let limited = 0
    const slow: Generate = async () => (limited++, { ok: false, error: 'HTTP 429: slow down', ms: 1 })
    await runBench({ month: '2026-11', models: [model('slow')], screens, generate: slow, store: makeStore(mkdtempSync(join(tmpdir(), 'run-'))), score: fastScore })
    expect(limited).toBe(6)
  })
  it('keeps going when scoring throws', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const boom = async () => { throw new Error('chromium died') }
    const out = await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: boom })
    expect(out.failed).toBe(6)
  })
})

describe('skills check', () => {
  it('throws a BenchError before any API call when a skill has no SKILL.md', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'skills-'))
    mkdirSync(join(dir, 'broken'))
    let calls = 0
    const counting: Generate = async (m, r) => { calls++; return fakeGenerate(m, r) }
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await expect(runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: counting, store, score: fastScore, skillsDir: dir })).rejects.toBeInstanceOf(BenchError)
    expect(calls).toBe(0)
  })
})

describe('build records', () => {
  it('store the finish reason, reasoning tokens, served model and unreadable stylesheets of a scored build', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore })
    expect(store.list('2026-11')[0]).toMatchObject({ ok: true, finish: 'stop', reasoningTokens: 0, servedModel: 'fake-good', unreadableStylesheets: 1 })
  })
  it('keep a reply cut off at the token cap as a failed build with its metadata', async () => {
    const capped: Generate = async () => ({ ok: false, error: 'Hit the token cap', ms: 9, reply: { text: '<html><body>half', usage: { input: 1, output: 12000 }, finish: 'length', reasoningTokens: 4000, servedModel: 'm-2026' } })
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('capped')], screens, generate: capped, store, score: fastScore })
    expect(out.failed).toBe(6)
    expect(store.list('2026-11')[0]).toMatchObject({ ok: false, error: 'Hit the token cap', reply: '<html><body>half', usage: { output: 12000 }, finish: 'length', reasoningTokens: 4000, servedModel: 'm-2026' })
  })
  it('leave the metadata null on a failure with no reply', async () => {
    const down: Generate = async () => ({ ok: false, error: 'HTTP 503: down', ms: 1 })
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('down')], screens, generate: down, store, score: fastScore })
    expect(store.list('2026-11')[0]).toMatchObject({ ok: false, reply: null, usage: null, finish: null, reasoningTokens: null, servedModel: null })
  })
})

describe('currentMonth', () => {
  it('is the UTC month', () => {
    expect(currentMonth(new Date('2026-11-01T00:30:00+04:00'))).toBe('2026-10')
  })
})
