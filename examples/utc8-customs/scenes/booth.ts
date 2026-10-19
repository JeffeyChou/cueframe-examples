// The counter shots, side elevation: Claude in its booth on the right, the traveler at the counter on
// the left. s02 the hall and the sign; s04–s05 Kevin; s06 Tanaka; s07 Lim; s09 Mike; s14 Kevin again,
// in a kimono. After each stamp a short exchange, in speech bubbles (Claude speaks from its window).
// Every time comes from timing.ts (the narration and the dialogue lines).
import { scene, type MountContext } from '@cueframe/core'
import {
  BODY, BOOTH, C, GROUND, JOST, MONO, SANS, STYLE, blink, booth, bubble, camera, card, envelope, inOutCubic, lens, mixAt, officer,
  outBack, outCubic, passport, pieces, pose, punct, ring, room, s, seg, stageSvg, stamp, stampMark, stanchion, text, traveler, wallClock,
  type Disguise,
} from '../lib.js'
import { K, LINE, SHOT } from '../timing.js'

const AT_COUNTER = 760

type Bubble = ReturnType<typeof bubble>
/** A bubble shown while its line is spoken (and `hold` s after), popping in. */
function speak(b: Bubble, t: number, line: string, at: { x: number; y: number }, hold = 0.6) {
  const [a, z] = LINE(line)
  const k = seg(t, a - 0.12, a + 0.12, outBack) * (1 - seg(t, z + hold, z + hold + 0.12))
  b.set({ x: at.x, y: at.y, o: k > 0 ? 1 : 0, s: Math.max(0.001, k) })
}
/** Claude's bubble: from its window, toward the traveler. */
const claudeBubble = (parent: Element, str: string) => bubble(parent, str, { size: 44, dir: -1 })
const FROM_CLAUDE = { x: 1330, y: 500 }

/** Claude behind the counter and its stamp arm: the stamp rests on the counter and presses onto
 * `target` at the nearest hit. */
function claudeAt(mid: Element, front: Element) {
  const claude = officer(mid, 200)
  const arm = s(front, 'path', { fill: 'none', stroke: C.claude, 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  const hand = stamp(front, 0.9)
  return {
    claude,
    set(t: number, hits: readonly number[], o: { look?: number; lookY?: number; eyes?: 'open' | 'line' | 'wide'; target?: { x: number; y: number }; extra?: Partial<typeof BODY & { cap: number }> } = {}) {
      const target = o.target ?? { x: 1030, y: BOOTH.counter - 50 }
      const hit = hits.reduce((b, h) => (Math.abs(t - h) < Math.abs(t - b) ? h : b), hits[0] ?? -99)
      const down = envelope(t, hit - 0.15, { in: 0.12, hold: 0.25, out: 0.35 }, STYLE)
      const reach = seg(t, hit - 0.6, hit - 0.15, outCubic) * (1 - seg(t, hit + 0.45, hit + 0.9, outCubic))
      claude.set(pose({ ...BODY, lookY: 0, cap: 0, eyes: o.eyes ?? 'open', x: 1410, y: BOOTH.counter + 40, look: o.look ?? -1, ...o.extra }, blink(t, 3),
        { mode: 'add', w: down, v: { sy: -0.06, sx: 0.04 } }, { mode: 'add', w: 1, v: { lookY: o.lookY ?? 0 } }))
      const rest = { x: 1100, y: BOOTH.counter - 12 }
      const hx = rest.x + (target.x + 30 - rest.x) * reach, hy = rest.y + (target.y - rest.y) * reach - 70 * reach * (1 - down) + down * 8
      hand.set({ x: hx, y: hy, rot: -6 + reach * 10 * (1 - down) })
      arm.setAttribute('d', `M1330 ${BOOTH.counter - 40} Q${(1330 + hx) / 2 + 30} ${hy - 150} ${hx + 6} ${hy - 104}`)
    },
  }
}

/** Walk in from the left to the counter, then (after `out`) walk back out: x, a step bob, facing. */
function walk(t: number, inAt: number, out = Infinity, from = -260) {
  const k = seg(t, inAt, inAt + 1.2, outCubic)
  const back = seg(t, out, out + 1.3, inOutCubic)
  const x = from + (AT_COUNTER - from) * k - (AT_COUNTER - from) * back
  const moving = (k > 0 && k < 1) || (back > 0 && back < 1)
  return { x, y: GROUND - (moving ? Math.abs(Math.sin(t * 11)) * 14 : 0), face: back > 0 ? -1 : 1 }
}

/** The common counter set: room, posts, booth, Claude and a traveler with a passport. */
function counter(ctx: MountContext, who: Disguise, country: string, cover: string, o: { kimono?: boolean; hat?: boolean } = {}) {
  const svg = stageSvg(ctx, C.paper)
  const world = s(svg, 'g')
  room(world)
  stanchion(world, 120, 360)
  stanchion(world, 360)
  const back = s(world, 'g')
  const b = booth(world)
  const person = traveler(world, who, who === 'lim' || who === 'mike' ? 360 : 400, o)
  const pass = passport(b.front, country, cover, 130)
  const mark = stampMark(b.front, 0.42, country.length)
  const c = claudeAt(b.mid, b.front)
  const top = s(world, 'g')
  return { svg, world, b, back, who: person, pass, mark, c, top }
}
type Counter = ReturnType<typeof counter>

/** The passport flies from the traveler's hand to the counter at `slap`; the mark appears at `hit`. */
function passportOn(st: Counter, t: number, slap: number, hit: number, rot = -4) {
  const k = seg(t, slap - 0.25, slap, outCubic)
  st.pass.set({ x: mixAt(k, 0, 1, AT_COUNTER + 90, 1010), y: mixAt(k, 0, 1, GROUND - 180, BOOTH.counter - 94) - Math.sin(k * Math.PI) * 60, rot, o: t >= slap - 0.25 ? 1 : 0 })
  st.mark.set({ x: 1010, y: BOOTH.counter - 80, rot: rot * 2, o: t >= hit ? 1 : 0 })
}

/** A message card above the counter: a small heading, then lines of pieces (for rings). */
function message(parent: Element, head: string, lines: string[][], o: { x?: number; y?: number; w?: number; size?: number; font?: string } = {}) {
  const g = s(parent, 'g')
  const x = o.x ?? 226, y = o.y ?? 100, w = o.w ?? 1100, size = o.size ?? 50
  const h = 80 + lines.length * size * 1.45
  s(g, 'rect', { x: x + 12, y: y + 14, width: w, height: h, fill: C.ink, opacity: 0.16 })
  s(g, 'rect', { x, y, width: w, height: h, fill: C.cream, stroke: C.ink, 'stroke-width': 5 })
  text(g, x + 36, y + 50, head, { size: 26, font: JOST, weight: 700, fill: C.grey, spacing: 3 })
  const boxes = lines.map((parts, i) => pieces(g, x + 36, y + 80 + size * 1.0 + i * size * 1.45, parts, { size, font: o.font ?? JOST, weight: 700 }))
  return { g, boxes, set(p: { y?: number; o: number }) { g.setAttribute('transform', `translate(0 ${(p.y ?? 0).toFixed(1)})`); g.style.opacity = String(p.o) } }
}

export const hall = scene({
  id: 'hall',
  at: SHOT.s02[0],
  end: SHOT.s02[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    room(world)
    const zones: [string, number, number, boolean][] = [['LOS ANGELES', 18, 41, false], ['TOKYO', 10, 41, false], ['SINGAPORE', 9, 41, false], ['BEIJING', 9, 41, true]]
    zones.forEach(([city, hh, mm, taped], i) => wallClock(world, 190 + i * 250, 230, 78, city, hh, mm, taped))
    for (let i = 0; i < 4; i++) stanchion(world, 140 + i * 240, i < 3 ? 380 + i * 240 : undefined)
    const b = booth(world)
    const sign = s(world, 'g')
    s(sign, 'line', { x1: 1250, x2: 1250, y1: -400, y2: 120, stroke: C.ink, 'stroke-width': 4 })
    s(sign, 'line', { x1: 1570, x2: 1570, y1: -400, y2: 120, stroke: C.ink, 'stroke-width': 4 })
    s(sign, 'rect', { x: 1150, y: 120, width: 520, height: 210, fill: C.red })
    text(sign, 1410, 186, '本口岸暂不接待', { size: 46, font: SANS, weight: 900, fill: C.cream, anchor: 'middle', spacing: 6 })
    text(sign, 1410, 296, 'UTC+8', { size: 104, font: JOST, weight: 700, fill: C.cream, anchor: 'middle', spacing: 4 })
    const c = claudeAt(b.mid, b.front)
    return { world, sign, c }
  },
  render(f, st) {
    const t = f.t
    const [a, z] = SHOT.s02
    camera(st.world, { x: 960 + 40 * seg(t, a, z), y: 540, zoom: 1 + 0.03 * seg(t, a, z) })
    const k = seg(t, K.drop, K.drop + 0.5, outBack)
    const swing = t > K.drop + 0.5 ? Math.sin((t - K.drop) * 7) * Math.exp(-(t - K.drop - 0.5) * 2.5) * 2 : 0
    st.sign.setAttribute('transform', `translate(0 ${(-420 * (1 - k)).toFixed(1)}) rotate(${swing.toFixed(2)} 1410 0)`)
    // Claude looks up at the sign as it lands, then stamps the counter on "不入境".
    const up = envelope(t, K.drop + 0.3, { in: 0.3, hold: 1.4, out: 0.4 })
    st.c.set(t, [K.tap2], { look: 0.3, lookY: -up, target: { x: 1060, y: BOOTH.counter - 10 } })
  },
})

export const kevin = scene({
  id: 'kevin',
  at: SHOT.s04[0],
  end: SHOT.s05[1],
  mount(ctx) {
    const st = counter(ctx, 'kevin', 'USA', C.navy)
    const say = bubble(st.top, 'Hello，在吗？', { size: 50 })
    const msg = message(st.top, 'MESSAGE · KEVIN (CA, USA)', [['Hello', '，', '在吗', '？'], ['Please help me check this code', '，', 'thanks', '！']])
    const l1 = msg.boxes[0]!, l2 = msg.boxes[1]!
    const rings = [ring(msg.g, l1[2]!, 5, { pad: 12 }), ring(msg.g, punct(l1[1]!), 7, { pad: 10 }), ring(msg.g, punct(l2[1]!), 11, { pad: 12 }), ring(msg.g, punct(l2[3]!), 23, { pad: 12 })]
    const glass = lens(st.top, 96)
    const k2 = bubble(st.top, 'I am really from California!', { size: 44 }), k3 = bubble(st.top, '……五道口。', { size: 50 })
    const cq = claudeBubble(st.top, '加州哪儿的？')
    return { ...st, say, msg, rings, glass, l1, l2, k2, k3, cq }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 960, y: 540, zoom: 1 + 0.02 * seg(t, K.ringZaima - 1, K.stamp5) })
    const w = walk(t, K.kevinIn, K.kevinOut)
    const jolt = seg(t, K.stamp5, K.stamp5 + 0.25, outBack)
    st.who.set(pose({ ...BODY, hat: 0, x: w.x, y: w.y, look: w.face, sx: w.face },
      blink(t, 2), { mode: 'add', w: envelope(t, K.stamp5, { in: 0.06, out: 0.4 }, STYLE), v: { sy: -0.05 } }, { mode: 'add', w: jolt, v: { hat: 1 } },
      { mode: 'add', w: envelope(t, K.hello, { in: 0.12, hold: 0.5, out: 0.3 }, STYLE), v: { rot: 6, sy: 0.04 } },
      { mode: 'add', w: envelope(t, LINE('s05-kevin')[0], { in: 0.1, hold: 1.2, out: 0.3 }, STYLE), v: { sy: 0.08, rot: 4 } },
      { mode: 'add', w: envelope(t, LINE('s05-kevin2')[0], { in: 0.3, hold: 1.0, out: 0.3 }), v: { sy: -0.06, rot: -6 } }))
    passportOn(st, t, K.slap, K.stamp5)
    speak(st.k2, t, 's05-kevin', { x: w.x + 40, y: GROUND - 430 })
    speak(st.cq, t, 's05-claude', FROM_CLAUDE)
    speak(st.k3, t, 's05-kevin2', { x: w.x + 40, y: GROUND - 430 })
    // "Hello，在吗？" as a bubble, then as the first line of the message card.
    const b = seg(t, K.hello - 0.1, K.hello + 0.15, outBack) * (1 - seg(t, SHOT.s05[0] - 0.2, SHOT.s05[0]))
    st.say.set({ x: w.x + 40, y: GROUND - 430, o: b > 0 ? 1 : 0, s: Math.max(0.001, b) })
    st.msg.set({ y: -30 * (1 - seg(t, SHOT.s05[0] - 0.2, SHOT.s05[0] + 0.3, outCubic)), o: seg(t, SHOT.s05[0] - 0.2, SHOT.s05[0] + 0.2) * (1 - seg(t, K.stamp5 + 0.4, K.stamp5 + 0.7)) })
    st.rings[0]!.set(seg(t, K.ringZaima, K.ringZaima + 0.4, outCubic))
    st.rings[1]!.set(seg(t, K.ringComma - 0.2, K.ringComma + 0.15, outCubic))
    st.rings[2]!.set(seg(t, K.ringComma + 0.25, K.ringComma + 0.6, outCubic))
    st.rings[3]!.set(seg(t, K.ringComma + 0.7, K.ringComma + 1.05, outCubic))
    // The lens hovers over "在吗", then over the full-width marks of the second line.
    const z = st.l1[2]!, c2 = st.l2[3]!
    const gx = mixAt(t, K.ringZaima - 0.8, K.ringZaima - 0.1, 300, z.x + z.w / 2) + mixAt(t, K.ringComma - 0.9, K.ringComma + 0.6, 0, c2.x - z.x)
    const gy = mixAt(t, K.ringComma - 0.9, K.ringComma - 0.3, z.y + z.h / 2, c2.y + c2.h / 2)
    st.glass.set({ x: gx, y: gy + 6 * Math.sin(t * 3), o: seg(t, K.ringZaima - 1, K.ringZaima - 0.7) * (1 - seg(t, K.stamp5 - 0.6, K.stamp5 - 0.3)) })
    st.c.set(t, [K.stamp5], { look: -1 })
  },
})

export const tanaka = scene({
  id: 'tanaka',
  at: SHOT.s06[0],
  end: SHOT.s06[1],
  mount(ctx) {
    const st = counter(ctx, 'tanaka', 'JAPAN', '#7A1F2B')
    const say = bubble(st.top, 'すみません。', { size: 50 })
    const msg = message(st.top, 'MESSAGE · TANAKA (TOKYO, JP)', [['帮我把这段话', '翻译成日语']], { font: SANS, w: 820, x: 240 })
    const r = ring(msg.g, msg.boxes[0]![1]!, 31, { pad: 12 })
    const cq = claudeBubble(st.top, '那您用日语，再说一遍需求？'), t2 = bubble(st.top, '……すみません。', { size: 50 })
    return { ...st, say, msg, r, cq, t2 }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 960, y: 540, zoom: 1 + 0.025 * seg(t, K.request, K.stamp6) })
    const w = walk(t, SHOT.s06[0] - 0.4, K.stamp6 + 1.0)
    const bows = K.bows.reduce((m, b) => Math.max(m, envelope(t, b, { in: 0.16, hold: 0.08, out: 0.2 })), 0)
    st.who.set(pose({ ...BODY, bow: 0, x: w.x, y: w.y, look: w.face, sx: w.face }, blink(t, 4), { mode: 'add', w: bows, v: { bow: 1 } },
      { mode: 'add', w: envelope(t, K.stamp6, { in: 0.06, out: 0.4 }, STYLE), v: { sy: -0.05 } },
      { mode: 'add', w: envelope(t, LINE('s06-tanaka2')[0] - 0.3, { in: 0.3, hold: 0.8, out: 0.3 }), v: { bow: 0.6 } }))
    passportOn(st, t, K.bows[2]! + 0.5, K.stamp6)
    const b = seg(t, K.bows[1]!, K.bows[1]! + 0.2, outBack) * (1 - seg(t, K.request - 0.2, K.request))
    st.say.set({ x: w.x + 40, y: GROUND - 440, o: b > 0 ? 1 : 0, s: Math.max(0.001, b) })
    st.msg.set({ y: -30 * (1 - seg(t, K.request, K.request + 0.4, outCubic)), o: seg(t, K.request, K.request + 0.3) * (1 - seg(t, LINE('s06-claude')[0] - 0.3, LINE('s06-claude')[0])) })
    st.r.set(seg(t, K.ringJa, K.ringJa + 0.5, outCubic))
    speak(st.cq, t, 's06-claude', FROM_CLAUDE)
    speak(st.t2, t, 's06-tanaka2', { x: w.x + 40, y: GROUND - 440 })
    // "……すみません": Claude holds still a beat (eyes flat), then stamps.
    st.c.set(t, [K.stamp6], { look: -1, ...(t > LINE('s06-tanaka2')[0] && t < K.stamp6 - 0.2 ? { eyes: 'line' as const } : {}) })
  },
})

export const lim = scene({
  id: 'lim',
  at: SHOT.s07[0],
  end: SHOT.s07[1],
  mount(ctx) {
    const st = counter(ctx, 'lim', 'SINGAPORE', C.red)
    // Two clocks above the booth showing the same time: Singapore is UTC+8 too.
    const clocks = s(st.back, 'g')
    wallClock(clocks, 1400, 160, 56, 'SINGAPORE', 9, 41)
    wallClock(clocks, 1620, 160, 56, 'BEIJING', 9, 41, true)
    const eq = text(clocks, 1510, 186, '=', { size: 90, font: JOST, weight: 700, fill: C.red, anchor: 'middle' })
    const fan = s(st.top, 'g')
    const cards = ['年终总结', '述职报告', '公积金提取', '思想汇报'].map((l) => card(fan, l, { w: 320, h: 196, size: 44 }))
    const last = cards[3]!
    const box = last.label.getBBox()
    const r = ring(last.g, { x: box.x, y: box.y, w: box.width, h: box.height }, 41, { pad: 16 })
    const say = bubble(st.top, '我是新加坡人 lah，帮我写个年终总结 lah。', { size: 44 })
    const l2 = bubble(st.top, '我们新加坡也要写的 lah！', { size: 46 }), l3 = bubble(st.top, '……那是什么 lah？', { size: 50 })
    const cq = claudeBubble(st.top, '新加坡写的叫 performance review。')
    return { ...st, cards, r, say, eq, l2, l3, cq }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 960, y: 540, zoom: 1 + 0.025 * seg(t, K.fan, K.stamp7) })
    const w = walk(t, SHOT.s07[0] - 0.5)
    st.who.set(pose({ ...BODY, hat: 0, x: w.x - 40, y: w.y, look: 1 }, blink(t, 6),
      { mode: 'add', w: envelope(t, K.lim + 0.3, { in: 0.1, hold: 0.1, out: 0.2 }) + envelope(t, K.lim + 2.3, { in: 0.1, hold: 0.1, out: 0.2 }), v: { sy: 0.05 } },
      { mode: 'add', w: envelope(t, K.stamp7, { in: 0.06, out: 0.4 }, STYLE), v: { sy: -0.05, hat: 0.6 } }))
    passportOn(st, t, K.lim + 0.6, K.stamp7, 4)
    const b = seg(t, K.lim - 0.1, K.lim + 0.15, outBack) * (1 - seg(t, K.fan - 0.3, K.fan))
    st.say.set({ x: w.x, y: GROUND - 400, o: b > 0 ? 1 : 0, s: Math.max(0.001, 0.9 * b) })
    st.cards.forEach((cd, i) => {
      const k = seg(t, K.fan + i * 0.45, K.fan + i * 0.45 + 0.5, outBack)
      const front = i === 3 ? seg(t, K.ringReport - 0.5, K.ringReport, outCubic) : 0
      const gone = seg(t, K.stamp7 + 0.4, K.stamp7 + 0.8)
      cd.set({ x: mixAt(k, 0, 1, 1300, 230 + i * 250) + front * 60, y: mixAt(k, 0, 1, 560, 290 - (i % 2) * 36) + front * 30 - gone * 80, rot: (i - 1.5) * 5 * k * (1 - front), s: Math.max(0.001, (0.4 + 0.6 * k) * (1 + 0.15 * front)), o: k > 0 ? 1 - gone : 0 })
    })
    st.r.set(seg(t, K.ringReport, K.ringReport + 0.45, outCubic))
    // The glance: Claude looks up at the two clocks (same time), an "=" shows; it lets it go.
    const g = envelope(t, K.glance, { in: 0.25, hold: 0.7, out: 0.25 })
    st.eq.style.opacity = String(g)
    st.c.set(t, [K.stamp7], { look: g > 0.1 ? 0 : -1, lookY: -1.2 * g })
    speak(st.l2, t, 's07-lim2', { x: w.x - 20, y: GROUND - 400 })
    speak(st.cq, t, 's07-claude', FROM_CLAUDE)
    speak(st.l3, t, 's07-lim3', { x: w.x - 20, y: GROUND - 400 })
  },
})

export const mike = scene({
  id: 'mike',
  at: SHOT.s09[0],
  end: SHOT.s09[1],
  mount(ctx) {
    const st = counter(ctx, 'mike', 'USA', C.navy)
    // Mike's day on New York time, 18:00 → 14:00 the next day: on from 21:00, off 00:00–01:30, on until 11:30.
    const bar = s(st.top, 'g')
    const X0 = 260, X1 = 1300, Y = 220, HOURS = 20
    const pos = (h: number) => X0 + (h - 18) / HOURS * (X1 - X0)
    s(bar, 'rect', { x: X0 - 40, y: Y - 120, width: X1 - X0 + 80, height: 250, fill: C.cream, stroke: C.ink, 'stroke-width': 5 })
    text(bar, X0, Y - 70, 'MIKE · ACTIVE HOURS · NEW YORK TIME', { size: 26, font: JOST, weight: 700, fill: C.grey, spacing: 3 })
    s(bar, 'rect', { x: X0, y: Y - 30, width: X1 - X0, height: 60, fill: '#E5D6B6' })
    const on: [number, number][] = [[21, 24], [25.5, 35.5]]
    const fills = on.map(([a]) => s(bar, 'rect', { x: pos(a), y: Y - 30, width: 0, height: 60, fill: C.sage }))
    for (let h = 18; h <= 38; h += 3) {
      s(bar, 'line', { x1: pos(h), x2: pos(h), y1: Y + 30, y2: Y + 44, stroke: C.ink, 'stroke-width': 3 })
      text(bar, pos(h), Y + 82, `${String(h % 24).padStart(2, '0')}:00`, { size: 28, font: MONO, weight: 500, anchor: 'middle' })
    }
    const lunch = text(bar, (pos(24) + pos(25.5)) / 2, Y + 11, '午休', { size: 30, font: SANS, weight: 900, fill: C.red, anchor: 'middle' })
    const r = ring(bar, { x: pos(24), y: Y - 30, w: pos(25.5) - pos(24), h: 60 }, 51, { pad: 14 })
    const say = bubble(st.top, "I'm just… 作息健康。", { size: 48 })
    const cq = claudeBubble(st.top, '纽约现在几点？'), m2 = bubble(st.top, '……北京时间，九点。', { size: 48 })
    return { ...st, bar, fills, on, pos, lunch, r, say, cq, m2 }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 960, y: 540, zoom: 1 + 0.02 * seg(t, K.barOn, K.stamp9) })
    const w = walk(t, SHOT.s09[0] - 0.3, K.stamp9 + 0.9)
    st.who.set(pose({ ...BODY, hat: 0, x: w.x, y: w.y, look: w.face, sx: w.face }, blink(t, 7),
      { mode: 'add', w: envelope(t, K.mike, { in: 0.2, hold: 1.6, out: 0.3 }), v: { rot: -5, look: -0.6 } },
      { mode: 'add', w: envelope(t, K.stamp9, { in: 0.06, out: 0.4 }, STYLE), v: { sy: -0.05, hat: 0.7 } }))
    passportOn(st, t, SHOT.s09[0] + 1.0, K.stamp9)
    st.bar.style.opacity = String(seg(t, K.barOn - 0.3, K.barOn) * (1 - seg(t, LINE('s09-claude')[0] - 0.3, LINE('s09-claude')[0])))
    // The day lights up from 21:00 as the narration reaches midnight, then the rest after the gap.
    const sweep = 18 + mixAt(t, K.barOn, K.ringLunch + 1.2, 0, 1) * 20
    st.fills.forEach((r, i) => {
      const [a, b] = st.on[i]!
      r.setAttribute('width', Math.max(0, st.pos(Math.min(b, sweep)) - st.pos(a)).toFixed(1))
    })
    st.lunch.style.opacity = String(seg(t, K.ringLunch, K.ringLunch + 0.3))
    st.r.set(seg(t, K.ringLunch, K.ringLunch + 0.45, outCubic))
    speak(st.say, t, 's09-mike', { x: w.x + 30, y: GROUND - 350 })
    speak(st.cq, t, 's09-claude', FROM_CLAUDE)
    speak(st.m2, t, 's09-mike2', { x: w.x + 30, y: GROUND - 350 })
    st.c.set(t, [K.stamp9], { look: -1 })
  },
})

export const again = scene({
  id: 'again',
  at: SHOT.s14[0],
  end: SHOT.s14[1],
  mount(ctx) {
    const st = counter(ctx, 'kevin', 'JAPAN', '#7A1F2B', { kimono: true, hat: false })
    const say = bubble(st.top, 'すみません，在吗？', { size: 50 })
    const cq = claudeBubble(st.top, 'Kevin，帽子不错。'), k2 = bubble(st.top, '……我叫田中。', { size: 50 })
    return { ...st, say, cq, k2 }
  },
  render(f, st) {
    const t = f.t
    // The same framing as s04, a slight push as Claude speaks.
    const stare = seg(t, LINE('s14-claude')[0] - 0.5, K.stamp14, inOutCubic)
    camera(st.world, { x: 960 + stare * 60, y: 540, zoom: 1 + 0.06 * stare })
    const w = walk(t, K.kevinBack)
    const bow = envelope(t, K.bowBack, { in: 0.3, hold: 0.6, out: 0.3 }, STYLE)
    st.who.set(pose({ ...BODY, bow: 0, x: w.x, y: w.y, look: 1 }, { mode: 'add', w: bow, v: { bow: 1 } },
      { mode: 'add', w: envelope(t, K.stamp14, { in: 0.06, out: 0.4 }, STYLE), v: { sy: -0.05 } }))
    passportOn(st, t, K.kevinBack + 1.3, K.stamp14)
    speak(st.say, t, 's14-kevin', { x: w.x + 40, y: GROUND - 440 }, 0.3)
    speak(st.cq, t, 's14-claude', FROM_CLAUDE)
    speak(st.k2, t, 's14-kevin2', { x: w.x + 40, y: GROUND - 440 })
    st.c.set(t, [K.stamp14], { look: -1, eyes: t > LINE('s14-kevin')[1] && t < LINE('s14-claude')[0] ? 'line' : 'open' })
  },
})
