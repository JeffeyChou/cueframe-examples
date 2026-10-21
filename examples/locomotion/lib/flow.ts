// Streamlines over a profile, as in a smoke tunnel: horizontal lines that rise over the object's
// top contour and relax with height. Pure geometry in stage px; the trace layer draws them.
import type { Poly } from './trace.js'

/** Height of the profile above `ground` at x (0 outside it), linearly interpolated. */
function heightAt(top: Poly, ground: number, x: number): number {
  if (!top.length || x < top[0]![0] || x > top[top.length - 1]![0]) return 0
  let i = 1
  while (i < top.length - 1 && top[i]![0] < x) i++
  const a = top[i - 1]!, b = top[i]!
  const t = (x - a[0]) / Math.max(1e-6, b[0] - a[0])
  return Math.max(0, ground - (a[1] + (b[1] - a[1]) * t))
}

/** n lines over `top` (a left-to-right top contour) from x0 to x1; `ground` is the base line in px. */
export function streamlines(top: Poly, ground: number, o: { n?: number; x0?: number; x1?: number; step?: number; gap?: number; sigma?: number } = {}): Poly[] {
  const n = o.n ?? 7, x0 = o.x0 ?? -40, x1 = o.x1 ?? 1960, step = o.step ?? 12
  const H = Math.max(20, ...top.map((p) => ground - p[1]))
  const xs: number[] = []
  for (let x = x0; x <= x1; x += step) xs.push(x)
  const raw = xs.map((x) => heightAt(top, ground, x))
  // smooth the bump so the air leads and trails the body
  const sig = (o.sigma ?? 70) / step, R = Math.ceil(sig * 3)
  const B = raw.map((_, i) => {
    let s = 0, w = 0
    for (let j = -R; j <= R; j++) { const k = i + j; if (k < 0 || k >= raw.length) continue; const ww = Math.exp(-(j * j) / (2 * sig * sig)); s += raw[k]! * ww; w += ww }
    return Math.max(raw[i]!, s / w)
  })
  const gap = o.gap ?? H * 0.26
  return Array.from({ length: n }, (_, i) => {
    const h = H * 0.12 + i * gap
    return xs.map((x, k) => {
      const b = B[k]!
      const lift = b * Math.exp(-Math.max(0, h - b * 0.5) / (2.2 * H))
      return [x, ground - h - lift - (b > 0 ? 10 : 0) * Math.min(1, b / 30)] as [number, number]
    })
  })
}
