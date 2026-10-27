// The strip's cast and set, drawn with kits/comic.ts: the alarm clock (the lead), the pillow, the
// nightstand, the bed with its sleeper under the blanket, the window.
import type { MountContext } from '@cueframe/core'
import { COMIC, inkAttrs, printed, solid, starPath, type Plate } from '../../../kits/comic.js'
import { el, ellipseD, f2, place, polyD, rectD, type Pose } from '../../../kits/svg.js'

type Ctx = Pick<MountContext, 'id'>
const { ink, white, cyan, magenta, yellow } = COMIC
/** Printed red: magenta under yellow dots. Orange wood: yellow under magenta dots. */
export const RED: Plate[] = [{ flat: magenta, opacity: 0.9 }, { dots: yellow, r: 4, cell: 12 }]
export const WOOD: Plate[] = [{ flat: yellow, opacity: 0.85 }, { dots: magenta, r: 3.6, cell: 14 }]
export const BRASS: Plate[] = [{ flat: yellow }, { dots: magenta, r: 2.4, cell: 12 }]

export type Eyes = 'asleep' | 'open' | 'wide' | 'dizzy'
/**
 * The alarm clock: a red body, a white face with ticks, two brass bells and a hammer, little feet,
 * stroke eyes on the face. Origin: the body's centre (radius 95).
 */
export function alarmClock(ctx: Ctx, parent: Element) {
  const g = el(parent, 'g')
  const R = 95
  const legs = el(g, 'g')
  for (const sd of [-1, 1]) el(legs, 'path', { d: `M${sd * 52} ${R * 0.7}L${sd * 74} ${R + 22}`, ...inkAttrs(12) })
  const hammer = el(g, 'g')
  el(hammer, 'path', { d: `M0 ${-R + 4}V${-R - 46}`, ...inkAttrs(8) })
  printed(ctx, hammer, ellipseD(0, -R - 52, 13, 13), { fill: BRASS, line: 5 })
  for (const sd of [-1, 1]) {
    const bell = el(g, 'g', { transform: `rotate(${sd * 38}) translate(0 ${-R - 6})` })
    printed(ctx, bell, `M-50 8A50 46 0 0 1 50 8Z`, { fill: BRASS, line: 7, box: { x: -60, y: -50, w: 120, h: 70 } })
    printed(ctx, bell, rectD({ x: -9, y: -54, w: 18, h: 14 }), { line: 5 })
  }
  printed(ctx, g, ellipseD(0, 0, R, R), { fill: RED, line: 9 })
  printed(ctx, g, ellipseD(0, 4, R * 0.76, R * 0.76), { line: 5 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r0 = R * (i % 3 ? 0.66 : 0.6), r1 = R * 0.71
    el(g, 'path', { d: `M${f2(Math.sin(a) * r0)} ${f2(4 - Math.cos(a) * r0)}L${f2(Math.sin(a) * r1)} ${f2(4 - Math.cos(a) * r1)}`, ...inkAttrs(i % 3 ? 3 : 5) })
  }
  const hour = el(g, 'path', { ...inkAttrs(8) })
  const minute = el(g, 'path', { ...inkAttrs(5) })
  el(g, 'circle', { cx: 0, cy: 4, r: 7, fill: ink })
  const eyes = [-1, 1].map(() => el(g, 'path', { ...inkAttrs(7) }))
  return {
    g, R,
    /** `minute` 0..60 (the hour hand follows from 6:00), `hammer` in degrees, `sx`/`sy` squash. */
    set(p: Pose & { eyes: Eyes; minute: number; hammer?: number }) {
      place(g, p)
      const m = (p.minute / 60) * Math.PI * 2, h = ((6 + p.minute / 60) / 12) * Math.PI * 2
      minute.setAttribute('d', `M0 4L${f2(Math.sin(m) * R * 0.56)} ${f2(4 - Math.cos(m) * R * 0.56)}`)
      hour.setAttribute('d', `M0 4L${f2(Math.sin(h) * R * 0.36)} ${f2(4 - Math.cos(h) * R * 0.36)}`)
      hammer.setAttribute('transform', `rotate(${(p.hammer ?? 0).toFixed(2)} 0 ${-R})`)
      eyes.forEach((e, i) => {
        const x = (i ? 1 : -1) * 25, y = -20
        const d = p.eyes === 'asleep' ? `M${x - 11} ${y}q11 9 22 0`
          : p.eyes === 'open' ? `M${x} ${y - 9}V${y + 9}`
          : p.eyes === 'wide' ? `M${x} ${y - 15}V${y + 13}`
          : `M${x - 9} ${y - 9}L${x + 9} ${y + 9}M${x + 9} ${y - 9}L${x - 9} ${y + 9}`
        e.setAttribute('d', d)
        e.setAttribute('stroke-width', p.eyes === 'wide' ? '9' : '7')
      })
    },
  }
}

/** The pillow: a puffed white rectangle with cyan dots and pinched corners. Origin: its centre. */
export function pillow(ctx: Ctx, parent: Element, w = 280, h = 140) {
  const g = el(parent, 'g')
  const x = w / 2, y = h / 2
  const d = `M${-x} ${-y}Q0 ${-y + 18} ${x} ${-y}Q${x - 22} 0 ${x} ${y}Q0 ${y - 18} ${-x} ${y}Q${-x + 22} 0 ${-x} ${-y}Z`
  printed(ctx, g, d, { fill: [{ dots: cyan, r: 3.4, cell: 13 }], line: 7, box: { x: -x - 10, y: -y - 10, w: w + 20, h: h + 20 } })
  el(g, 'path', { d: `M${-x * 0.55} ${-y * 0.35}q${x * 0.3} ${y * 0.25} ${x * 0.6} 0M${-x * 0.2} ${y * 0.35}q${x * 0.3} ${-y * 0.2} ${x * 0.6} 0`, ...inkAttrs(4) })
  return { g, set(p: Pose) { place(g, p) } }
}

/** The nightstand: top slab, body and drawer, standing on y = floor. */
export function nightstand(ctx: Ctx, parent: Element, x: number, top: number, floor: number, w = 300) {
  const g = el(parent, 'g')
  for (const sd of [0.12, 0.88]) el(g, 'path', { d: `M${x + w * sd} ${floor - 30}V${floor}`, ...inkAttrs(14) })
  printed(ctx, g, rectD({ x: x + 12, y: top + 20, w: w - 24, h: floor - top - 50 }), { fill: WOOD, line: 8 })
  printed(ctx, g, rectD({ x, y: top, w, h: 26 }), { fill: WOOD, line: 8 })
  printed(ctx, g, rectD({ x: x + 40, y: top + 62, w: w - 80, h: (floor - top) * 0.32 }), { fill: [{ dots: magenta, r: 5, cell: 14 }], line: 6, white: false })
  el(g, 'circle', { cx: x + w / 2, cy: top + 62 + (floor - top) * 0.16, r: 9, fill: ink })
  return g
}

/** The bed seen from the side: frame and mattress, and the blanket over a sleeper's hump as its own
 * group, to append after the pillow. The pillow end is at x0. */
export function bed(ctx: Ctx, parent: Element, x0: number, top: number, floor: number, x1: number) {
  const g = el(parent, 'g')
  printed(ctx, g, rectD({ x: x0 - 30, y: top - 140, w: 34, h: floor - top + 140 }), { fill: WOOD, line: 8 })
  printed(ctx, g, rectD({ x: x0, y: top + 40, w: x1 - x0, h: floor - top - 70 }), { fill: WOOD, line: 8 })
  printed(ctx, g, rectD({ x: x0, y: top, w: x1 - x0, h: 48 }), { line: 7 })
  const hump = `M${x0 + 205} ${top + 30}C${x0 + 215} ${top - 190} ${x0 + 440} ${top - 200} ${x0 + 540} ${top - 70}C${x0 + 600} ${top - 120} ${x1 - 60} ${top - 80} ${x1} ${top - 30}V${top + 80}H${x0 + 140}Z`
  const blanket = el(g, 'g')
  printed(ctx, blanket, hump, { fill: [{ flat: magenta, opacity: 0.25 }, { dots: magenta, r: 6, cell: 16 }], line: 8 })
  el(blanket, 'path', { d: `M${x0 + 300} ${top - 120}q40 60 30 160M${x0 + 560} ${top - 80}q30 50 10 130`, ...inkAttrs(4) })
  return { g, blanket }
}

/** The sleeper: only a tuft of hair shows on the pillow, at the blanket's edge. Origin: its base. */
export function tuft(parent: Element, x: number, y: number) {
  return solid(parent, `M${x - 40} ${y}q-14 -56 26 -78q-6 30 14 22q4 -36 42 -42q-10 28 8 32q26 -24 54 -10q-32 14 -22 76Z`)
}

/** A window with a morning sky and the sun on the sill, curtains either side. */
export function window_(ctx: Ctx, parent: Element, x: number, y: number, w: number, h: number) {
  const g = el(parent, 'g')
  printed(ctx, g, rectD({ x, y, w, h }), { fill: [{ flat: yellow, opacity: 0.35 }, { dots: yellow, r: 5, cell: 16 }], line: 0 })
  printed(ctx, g, ellipseD(x + w * 0.68, y + h * 0.78, 80, 80), { fill: [{ flat: yellow }, { dots: magenta, r: 3, cell: 12 }], line: 7 })
  printed(ctx, g, rectD({ x: x - 16, y: y + h - 6, w: w + 32, h: 26 }), { line: 7 })
  el(g, 'path', { d: rectD({ x, y, w, h }), ...inkAttrs(12) })
  el(g, 'path', { d: `M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`, ...inkAttrs(9) })
  for (const sd of [-1, 1]) {
    const cx = sd < 0 ? x - 10 : x + w + 10
    const d = polyD(cx, y - 40, cx + sd * 120, y - 40, cx + sd * 70, y + h * 0.5, cx + sd * 110, y + h + 60, cx, y + h + 60)
    printed(ctx, g, d, { fill: [{ dots: magenta, r: 7, cell: 16 }], line: 7 })
  }
  printed(ctx, g, rectD({ x: x - 150, y: y - 60, w: w + 300, h: 24 }), { fill: WOOD, line: 7 })
  return g
}

/** A floating "Z" in Bangers with an ink outline; `set` with a pose. */
export function zed(parent: Element, size: number) {
  const g = el(parent, 'g')
  el(g, 'text', { 'font-size': size, 'font-family': 'Bangers, sans-serif', fill: white, stroke: ink, 'stroke-width': size * 0.12, 'paint-order': 'stroke', 'stroke-linejoin': 'round', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'Z')
  return { g, set(p: Pose) { place(g, p) } }
}

/** A small yellow star, inked. */
export function star(ctx: Ctx, parent: Element, r: number) {
  const g = el(parent, 'g')
  printed(ctx, g, starPath(r), { fill: [{ flat: yellow }], line: r * 0.2, box: { x: -r, y: -r, w: 2 * r, h: 2 * r } })
  return { g, set(p: Pose) { place(g, p) } }
}

