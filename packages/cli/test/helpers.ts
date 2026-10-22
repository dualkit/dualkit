import type { Finding } from '@dualkit/rules'
import type { AuditResult } from '../src/audit'

export const finding = (p: Partial<Finding> = {}): Finding => ({
  rule: 'bidi/unisolated-number', group: 'bidi', severity: 'error', title: 'A number that will show in reverse',
  message: '"050 123 4567" is not isolated.', fix: 'Wrap the number in <bdi>.', docs: 'https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#bidi-unisolated-number',
  node: { id: 'p', snippet: '<p>050 123 4567</p>', box: { x: 10, y: 20, width: 100, height: 20 } }, ...p,
})
export const result = (findings: Finding[], extra: Partial<AuditResult> = {}): AuditResult => ({
  url: 'https://example.com/ar', date: '2026-10-16T12:00:00.000Z', width: 1280, height: 800, score: 72,
  findings, screenshot: 'iVBORw0KGgo=', pageHeight: 1600, unreadableStylesheets: 0, tags: {}, ...extra,
})
