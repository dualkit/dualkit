export type SpringOptions = { zeta: number; settleMs: number; fps?: number }

const SETTLE_BAND = 0.02

/** Unit step response of a damped oscillator with natural frequency omega (rad per second). */
function stepResponse(zeta: number, omega: number, t: number): number {
  if (zeta >= 1) {
    if (zeta === 1) return 1 - (1 + omega * t) * Math.exp(-omega * t)
    const s = Math.sqrt(zeta * zeta - 1)
    const r1 = -omega * (zeta - s)
    const r2 = -omega * (zeta + s)
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1)
  }
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const decay = Math.exp(-zeta * omega * t)
  return 1 - decay * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
}

/** Time in seconds after which the response stays within 2% of the target, for omega = 1. */
function unitSettleSeconds(zeta: number): number {
  const dt = 0.001
  let settled = 0
  for (let t = 0; t < 400; t += dt) {
    if (Math.abs(1 - stepResponse(zeta, 1, t)) > SETTLE_BAND) settled = t
  }
  return settled + dt
}

export function springKeyframes(from: number, to: number, { zeta, settleMs, fps = 60 }: SpringOptions): number[] {
  if (!(zeta > 0) || !(settleMs > 0) || !(fps > 0)) throw new RangeError('springKeyframes: zeta, settleMs and fps must be positive')
  // Settle time scales as 1 / omega, so solve once at omega = 1.
  const omega = unitSettleSeconds(zeta) / (settleMs / 1000)
  const frames = Math.ceil((settleMs / 1000) * fps)
  const out: number[] = []
  for (let i = 0; i < frames; i++) out.push(from + (to - from) * stepResponse(zeta, omega, i / fps))
  out.push(to)
  return out
}
