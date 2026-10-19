// The counter shots, side elevation: Claude in its booth on the right, the traveler at the counter on
// the left. s02 establishes the hall (wall clocks, the sign dropping, the queue posts); s05 is
// Kevin's full-width comma; s07 is Lim and the fan of cards.
import { cue, scene } from '@cueframe/core'
import {
  BODY, BOOTH, C, GROUND, JOST, SANS, STYLE, blink, booth, bubble, camera, card, envelope, lens, mixAt, officer, outBack, outCubic,
  passport, pieces, pose, punct, ring, room, s, seg, stageSvg, stamp, stampMark, stanchion, start, text, traveler, wallClock,
} from '../lib.js'

/** Claude behind the counter and its stamp hand; the stamp comes down at `hit`. */
function claudeAt(mid: Element, front: Element) {
  const claude = officer(mid, 200)
  // The arm: a salmon stroke from Claude's side, over the counter, to the stamp's handle.
  const arm = s(front, 'path', { fill: 'none', stroke: C.claude, 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  const hand = stamp(front, 0.9)
  return {
    /** The stamp rests on the counter, rises, presses onto `target` (the passport) at `hit`, comes back. */
    set(t: number, hit: number, look = -1, target = { x: 1030, y: BOOTH.counter - 50 }) {
      const down = envelope(t, hit - 0.15, { in: 0.12, hold: 0.25, out: 0.35 }, STYLE)
      const reach = seg(t, hit - 0.6, hit - 0.15, outCubic) * (1 - seg(t, hit + 0.45, hit + 0.9, outCubic))
      claude.set(pose({ ...BODY, x: 1410, y: BOOTH.counter + 40, look }, blink(t, 3), { mode: 'add', w: down, v: { sy: -0.06, sx: 0.04 } }))
      const rest = { x: 1100, y: BOOTH.counter - 12 }
      const hx = rest.x + (target.x + 30 - rest.x) * reach, hy = rest.y + (target.y - rest.y) * reach - 70 * reach * (1 - down) + down * 8
      hand.set({ x: hx, y: hy, rot: -6 + reach * 10 * (1 - down) })
      arm.setAttribute('d', `M1330 ${BOOTH.counter - 40} Q${(1330 + hx) / 2 + 30} ${hy - 150} ${hx + 6} ${hy - 104}`)
    },
  }
}

export const hall = scene({
  id: 's02',
  at: cue('scene.s02.start'),
  end: cue('scene.s02.end'),
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    room(world)
    const zones: [string, number, number, boolean][] = [['LOS ANGELES', 18, 0, false], ['TOKYO', 10, 0, false], ['SINGAPORE', 9, 0, false], ['BEIJING', 9, 0, true]]
    zones.forEach(([city, hh, mm, taped], i) => wallClock(world, 190 + i * 250, 230, 78, city, hh, mm, taped))
    for (let i = 0; i < 4; i++) stanchion(world, 140 + i * 240, i < 3 ? 380 + i * 240 : undefined)
    const b = booth(world)
    const sign = s(world, 'g')
    s(sign, 'line', { x1: 1250, x2: 1250, y1: 0, y2: 120, stroke: C.ink, 'stroke-width': 4 })
    s(sign, 'line', { x1: 1570, x2: 1570, y1: 0, y2: 120, stroke: C.ink, 'stroke-width': 4 })
    s(sign, 'rect', { x: 1150, y: 120, width: 520, height: 210, fill: C.red })
    text(sign, 1410, 186, '本口岸暂不接待', { size: 46, font: SANS, weight: 900, fill: C.cream, anchor: 'middle', spacing: 6 })
    text(sign, 1410, 296, 'UTC+8', { size: 104, font: JOST, weight: 700, fill: C.cream, anchor: 'middle', spacing: 4 })
    const c = claudeAt(b.mid, b.front)
    const t0 = start('s02')
    return { world, sign, c, t0, drop: t0 + 1.2, hit: t0 + 5.2, hit2: t0 + 6.1 }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 960 + 40 * seg(t, st.t0, st.t0 + 8), y: 540, zoom: 1 + 0.03 * seg(t, st.t0, st.t0 + 8) })
    // The sign drops on its wires and swings to rest.
    const k = seg(t, st.drop, st.drop + 0.5, outBack)
    const swing = Math.sin((t - st.drop) * 7) * Math.exp(-(t - st.drop) * 3) * (t > st.drop + 0.5 ? 1.6 : 0)
    st.sign.setAttribute('transform', `translate(0 ${(-360 * (1 - k)).toFixed(1)}) rotate(${swing.toFixed(2)} 1410 0)`)
    // Two taps on the ink pad.
    st.c.set(t, t < st.hit + 0.6 ? st.hit : st.hit2, 0.4)
  },
})

export const kevin = scene({
  id: 's05',
  at: cue('scene.s05.start'),
  end: cue('scene.s05.end'),
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    room(world)
    stanchion(world, 120, 360)
    stanchion(world, 360)
    const b = booth(world)
    const kev = traveler(world, 'kevin', 400)
    const pass = passport(b.front, 'USA', C.navy, 130)
    const mark = stampMark(b.front, 0.42, 5)
    // The message, on a card pinned above the counter.
    const msg = s(world, 'g')
    s(msg, 'rect', { x: 238, y: 128, width: 1100, height: 190, fill: C.ink, opacity: 0.16 })
    s(msg, 'rect', { x: 226, y: 114, width: 1100, height: 190, fill: C.cream, stroke: C.ink, 'stroke-width': 5 })
    text(msg, 262, 168, 'MESSAGE · KEVIN (CA, USA)', { size: 26, font: JOST, weight: 600, fill: C.grey, spacing: 3 })
    const parts = pieces(msg, 262, 262, ['Please help me check this code', '，', 'thanks', '！'], { size: 52, font: JOST, weight: 500 })
    const r1 = ring(msg, punct(parts[1]!), 11, { pad: 14 })
    const r2 = ring(msg, punct(parts[3]!), 23, { pad: 14 })
    const glass = lens(world, 96)
    const c = claudeAt(b.mid, b.front)
    const t0 = start('s05')
    return { world, kev, pass, mark, r1, r2, glass, c, parts, t0, scan: t0 + 0.8, ring1: t0 + 2.4, ring2: t0 + 3.4, hit: t0 + 4.6 }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 960, y: 540, zoom: 1 + 0.02 * seg(t, st.t0, st.hit) })
    // The lens slides along the line to the comma, then to the exclamation mark.
    const p1 = st.parts[1]!, p3 = st.parts[3]!
    const gx = mixAt(t, st.scan, st.ring1, 420, p1.x + p1.w / 2) + mixAt(t, st.ring1 + 0.3, st.ring2, 0, p3.x - p1.x + (p3.w - p1.w) / 2)
    st.glass.set({ x: gx, y: 230 + 6 * Math.sin(t * 3), o: 1 - seg(t, st.hit - 0.5, st.hit - 0.2) })
    st.r1.set(seg(t, st.ring1, st.ring1 + 0.45, outCubic))
    st.r2.set(seg(t, st.ring2, st.ring2 + 0.45, outCubic))
    // The stamp lands on the passport; Kevin's hat jumps askew and stays.
    const jolt = seg(t, st.hit, st.hit + 0.25, outBack)
    st.kev.set(pose({ ...BODY, hat: 0, x: 760, y: GROUND, look: 1 }, { mode: 'add', w: envelope(t, st.hit, { in: 0.06, out: 0.4 }, STYLE), v: { sy: -0.05, sx: 0.04 } }, { mode: 'add', w: jolt, v: { hat: 1 } }))
    st.pass.set({ x: 1010, y: BOOTH.counter - 94, rot: -4 })
    st.mark.set({ x: 1010, y: BOOTH.counter - 80, rot: -8, o: t >= st.hit ? 1 : 0 })
    st.c.set(t, st.hit, -1)
  },
})

export const lim = scene({
  id: 's07',
  at: cue('scene.s07.start'),
  end: cue('scene.s07.end'),
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    room(world)
    const b = booth(world)
    const fan = s(world, 'g')
    const labels = ['年终总结', '述职报告', '公积金提取', '思想汇报']
    const cards = labels.map((l) => card(fan, l, { w: 330, h: 200, size: 46 }))
    const who = traveler(world, 'lim', 360)
    const say = bubble(world, '我是新加坡人 lah，帮我写个年终总结 lah。', { size: 44 })
    const last = cards[3]!
    const box = last.label.getBBox()
    const r = ring(last.g, { x: box.x, y: box.y, w: box.width, h: box.height }, 41, { pad: 18 })
    const pass = passport(b.front, 'SINGAPORE', C.red, 130)
    const mark = stampMark(b.front, 0.42, 9)
    const c = claudeAt(b.mid, b.front)
    const t0 = start('s07')
    return { world, cards, who, say, r, pass, mark, c, t0, talk: t0 + 0.3, fan: t0 + 3.6, ring: t0 + 7.2, hit: t0 + 8.6 }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, { x: 960, y: 540, zoom: 1 + 0.025 * seg(t, st.fan, st.hit) })
    st.who.set(pose({ ...BODY, hat: 0, x: 720, y: GROUND, look: 1 }, blink(t, 6), { mode: 'add', w: envelope(t, st.hit, { in: 0.06, out: 0.4 }, STYLE), v: { sy: -0.05, hat: 0.6 } }))
    st.say.set({ x: 760, y: 470, o: seg(t, st.talk, st.talk + 0.2) * (1 - seg(t, st.fan - 0.3, st.fan)), s: 0.9 + 0.1 * seg(t, st.talk, st.talk + 0.25, outBack) })
    // The cards fly out of the booth one by one and fan above Lim; the last one comes forward.
    st.cards.forEach((cd, i) => {
      const k = seg(t, st.fan + i * 0.55, st.fan + i * 0.55 + 0.5, outBack)
      const front = i === 3 ? seg(t, st.ring - 0.6, st.ring - 0.1, outCubic) : 0
      cd.set({ x: mixAt(k, 0, 1, 1300, 300 + i * 290) + front * 120, y: mixAt(k, 0, 1, 560, 330 - (i % 2) * 40) + front * 40, rot: (i - 1.5) * 5 * k * (1 - front), s: (0.4 + 0.6 * k) * (1 + 0.18 * front), o: k > 0 ? 1 : 0 })
    })
    st.r.set(seg(t, st.ring, st.ring + 0.5, outCubic))
    st.pass.set({ x: 1010, y: BOOTH.counter - 94, rot: -4 })
    st.mark.set({ x: 1010, y: BOOTH.counter - 80, rot: 7, o: t >= st.hit ? 1 : 0 })
    st.c.set(t, st.hit, -1)
  },
})
