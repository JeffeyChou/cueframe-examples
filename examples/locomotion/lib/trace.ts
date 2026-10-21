// The red trace: a contour drawn on the animal that survives the cut and lands on the same feature
// of the car (spine → roofline, eye → headlight, body → profile). A trace is a polyline in stage px;
// two traces morph point by point after resampling by arc length. Drawn on the UI layer as a
// schematic: the line, square nodes, a few measured segments.
import * as THREE from 'three'
import type { Frame } from '@cueframe/core'
import type { Rect } from './look.js'
import { RED, GREY, text } from './ui.js'

export type Pt = [number, number]
export type Poly = Pt[]

/** Footage contours in plate coordinates (0..1), on the frame named in `frame` (plate index). */
export const FOOTAGE_TRACES: Record<string, { clip: string; frame: number; lines: Poly[] }> = {
  // the cheetah's back from rump to nose, and the haunch: the curve the car's rear arch borrows
  spine: {
    clip: 'cheetah-hunt', frame: 20,
    lines: [
      [[0.364, 0.566], [0.371, 0.535], [0.422, 0.517], [0.465, 0.514], [0.5, 0.51], [0.551, 0.521], [0.574, 0.517], [0.592, 0.559]],
      [[0.371, 0.535], [0.364, 0.566], [0.369, 0.601], [0.391, 0.625], [0.412, 0.618]],
    ],
  },
  // the shark's dorsal profile, tail to snout, and its belly
  body: {
    clip: 'shark', frame: 50,
    lines: [
      [[0.129, 0.465], [0.234, 0.535], [0.367, 0.556], [0.469, 0.5], [0.477, 0.368], [0.547, 0.458], [0.578, 0.479], [0.703, 0.514], [0.813, 0.583], [0.867, 0.646]],
      [[0.867, 0.646], [0.781, 0.681], [0.688, 0.667], [0.547, 0.625], [0.43, 0.611], [0.336, 0.639]],
    ],
  },
}

/** Map plate-normalized points through a crop (0..1 of the source) into a stage rect. */
export function throughCrop(lines: Poly[], crop: Rect, rect: Rect, flipX = false): Poly[] {
  return lines.map((l) => l.map(([u, v]) => {
    let x = (u - crop.x) / crop.w
    if (flipX) x = 1 - x
    return [rect.x + x * rect.w, rect.y + ((v - crop.y) / crop.h) * rect.h] as Pt
  }))
}

/** A circle as a polyline (for eyes and headlights). */
export function circle(cx: number, cy: number, r: number, n = 48): Poly {
  return Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2 - Math.PI / 2), cy + r * Math.sin((i / n) * Math.PI * 2 - Math.PI / 2)] as Pt)
}

/**
 * The silhouette of a projected mesh set, as its top contour (and bottom), left to right in stage px:
 * for `bins` columns the highest (lowest) projected vertex. `stride` skips vertices for speed.
 */
export function silhouette(meshes: (THREE.Mesh | THREE.LineSegments)[], cam: THREE.Camera, W: number, H: number, o: { bins?: number; stride?: number; bottom?: boolean; skip?: (m: THREE.Mesh | THREE.LineSegments) => boolean } = {}): Poly[] {
  const bins = o.bins ?? 48
  const top = new Float32Array(bins).fill(Infinity), bot = new Float32Array(bins).fill(-Infinity)
  let x0 = Infinity, x1 = -Infinity
  const v = new THREE.Vector3()
  const pts: number[] = []
  for (const m of meshes) {
    if (o.skip?.(m)) continue
    const pos = m.geometry.attributes.position!
    for (let i = 0; i < pos.count; i += o.stride ?? 7) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(cam)
      const x = (v.x * 0.5 + 0.5) * W, y = (0.5 - v.y * 0.5) * H
      pts.push(x, y)
      if (x < x0) x0 = x
      if (x > x1) x1 = x
    }
  }
  for (let i = 0; i < pts.length; i += 2) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(((pts[i]! - x0) / (x1 - x0)) * bins)))
    if (pts[i + 1]! < top[b]!) top[b] = pts[i + 1]!
    if (pts[i + 1]! > bot[b]!) bot[b] = pts[i + 1]!
  }
  const line = (arr: Float32Array): Poly => Array.from(arr, (y, b) => [x0 + ((b + 0.5) / bins) * (x1 - x0), y] as Pt).filter((p) => Number.isFinite(p[1]))
  return o.bottom ? [line(top), line(bot)] : [line(top)]
}

function length(l: Poly): number {
  let s = 0
  for (let i = 1; i < l.length; i++) s += Math.hypot(l[i]![0] - l[i - 1]![0], l[i]![1] - l[i - 1]![1])
  return s
}

/** Resample a polyline to n points evenly by arc length. */
export function resample(l: Poly, n: number): Poly {
  if (l.length < 2) return Array.from({ length: n }, () => l[0] ?? [0, 0])
  const L = length(l)
  const out: Poly = []
  let seg = 1, acc = 0
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * L
    while (seg < l.length - 1 && acc + Math.hypot(l[seg]![0] - l[seg - 1]![0], l[seg]![1] - l[seg - 1]![1]) < target) {
      acc += Math.hypot(l[seg]![0] - l[seg - 1]![0], l[seg]![1] - l[seg - 1]![1])
      seg++
    }
    const a = l[seg - 1]!, b = l[seg]!
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const t = Math.min(1, Math.max(0, (target - acc) / d))
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

/** Morph trace sets a → b at t (0..1); missing lines grow from / shrink to the other's first line. */
export function morph(a: Poly[], b: Poly[], t: number, n = 64): Poly[] {
  const k = Math.max(a.length, b.length)
  return Array.from({ length: k }, (_, i) => {
    const pa = resample(a[i] ?? a[0]!, n), pb = resample(b[i] ?? b[0]!, n)
    return pa.map((p, j) => [p[0] + (pb[j]![0] - p[0]) * t, p[1] + (pb[j]![1] - p[1]) * t] as Pt)
  })
}

/** Draw traces: `on` 0..1 draws them on along their length; nodes every few points; a length label. */
export function drawTrace(g: CanvasRenderingContext2D, f: Frame, lines: Poly[], o: { on?: number; color?: string; width?: number; label?: string; nodes?: number; dash?: number } = {}): void {
  const on = o.on ?? 1
  if (o.dash !== undefined) { g.setLineDash([22, 14]); g.lineDashOffset = -o.dash } else g.setLineDash([])
  g.strokeStyle = o.color ?? RED
  g.fillStyle = o.color ?? RED
  g.lineWidth = o.width ?? 2.5
  g.lineJoin = 'round'
  g.lineCap = 'round'
  lines.forEach((l0, li) => {
    const l = resample(l0, 64)
    const upto = Math.max(0, Math.min(l.length, Math.floor(on * l.length)))
    if (upto < 2) return
    g.beginPath()
    l.slice(0, upto).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    if (o.dash === undefined) {
      // a dark halo under the line, so red reads on red paint and on light grey
      const sc = g.strokeStyle, lw = g.lineWidth
      g.strokeStyle = 'rgba(0,0,0,0.55)'
      g.lineWidth = lw + 3
      g.stroke()
      g.strokeStyle = sc
      g.lineWidth = lw
    }
    g.stroke()
    const every = o.nodes ?? 8
    for (let i = 0; i < upto; i += every) g.fillRect(l[i]![0] - 3.5, l[i]![1] - 3.5, 7, 7)
    if (li === 0 && o.label && upto === l.length) {
      const [x, y] = l[Math.floor(l.length * 0.3)]!
      g.strokeStyle = 'rgba(255,42,58,0.7)'
      g.lineWidth = 1
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 70); g.lineTo(x + 40, y - 70); g.stroke()
      text(g, f, o.label, x + 48, y - 64, { size: 14, color: RED })
      text(g, f, `L ${length(l0).toFixed(1)} px`, x + 48, y - 44, { size: 12, color: GREY })
      g.strokeStyle = o.color ?? RED
      g.lineWidth = o.width ?? 2.5
    }
  })
  g.setLineDash([])
}
