// The full-frame evidence shots. s10: the October calendar — the "American users" vanish for the
// national holiday and all come back on a Saturday stamped 班. s11: the montage, one clue per beat
// on a full-bleed poster, each stamped, faster and faster; the last stamp falls on nothing.
// s15: the traffic chart on Pacific time, and Beijing time sliding in under it.
import { scene } from '@cueframe/core'
import {
  C, JOST, MONO, SANS, SERIF, camera, card, inOutCubic, mixAt, mulberry, outBack, outCubic, paperShape, ring, s, seg, stageSvg, stampMark, text,
} from '../lib.js'
import { K, SHOT } from '../timing.js'

// October 2026 starts on a Thursday. Holiday 1–7; the make-up workday shown is Saturday the 10th.
const FIRST = 4
const HOLIDAY = [1, 2, 3, 4, 5, 6, 7]
const MAKEUP = 10

export const calendar = scene({
  id: 'calendar',
  at: SHOT.s10[0],
  end: SHOT.s10[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    const X0 = 300, Y0 = 250, CW = 190, CH = 140
    paperShape(world, { rect: { x: X0 - 40, y: 80, w: CW * 7 + 80, h: CH * 5 + 220 } }, C.cream, { edge: 'cut', stock: 'fibre' })
    s(world, 'rect', { x: X0 - 40, y: 80, width: CW * 7 + 80, height: 100, fill: C.red })
    text(world, X0, 150, '十月 · OCTOBER', { size: 52, font: SANS, weight: 900, fill: C.cream, spacing: 6 })
    text(world, X0 + CW * 7, 150, '“美国用户”在线人数', { size: 32, font: SANS, weight: 900, fill: C.cream, anchor: 'end' })
    ;['日', '一', '二', '三', '四', '五', '六'].forEach((d, i) => text(world, X0 + i * CW + CW / 2, Y0 - 16, d, { size: 30, font: SANS, weight: 900, fill: C.grey, anchor: 'middle' }))
    const rnd = mulberry(10)
    const days = Array.from({ length: 31 }, (_, i) => {
      const d = i + 1, cell = FIRST + i
      const x = X0 + (cell % 7) * CW, y = Y0 + Math.floor(cell / 7) * CH
      const g = s(world, 'g')
      const bg = s(g, 'rect', { x: x + 4, y: y + 4, width: CW - 8, height: CH - 8, fill: '#F1E8D2' })
      text(g, x + 16, y + 44, String(d), { size: 34, font: JOST, weight: 700, fill: cell % 7 === 0 || cell % 7 === 6 ? C.red : C.ink })
      // The crowd: a row of little heads, as many as that day's users.
      const n = cell % 7 === 0 || cell % 7 === 6 ? 2 + Math.floor(rnd() * 2) : 7 + Math.floor(rnd() * 3)
      const heads = Array.from({ length: d === MAKEUP ? 18 : n }, (_, k) => s(g, 'circle', {
        cx: x + 24 + (k % 9) * 18, cy: y + CH - 50 + Math.floor(k / 9) * 22, r: 7, fill: [C.navy, C.sage, C.mustard, C.red][k % 4]!,
      }))
      return { d, x, y, bg, heads, base: n }
    })
    const ban = s(world, 'g')
    const m = days[MAKEUP - 1]!
    text(ban, 0, 34, '班', { size: 96, font: SERIF, weight: 900, fill: C.red, anchor: 'middle' })
    s(ban, 'rect', { x: -60, y: -60, width: 120, height: 120, rx: 10, fill: 'none', stroke: C.red, 'stroke-width': 8 })
    ban.setAttribute('transform', `translate(${m.x + CW - 70} ${m.y + 56})`)
    const r = ring(world, { x: m.x + CW - 130, y: m.y - 4, w: 120, h: 120 }, 101, { pad: 18, width: 9 })
    return { world, days, ban, r, m }
  },
  render(f, st) {
    const t = f.t
    const focus = seg(t, K.ban - 0.4, K.ban + 0.6, inOutCubic)
    camera(st.world, { x: 960 + focus * (st.m.x + 95 - 960) * 0.5, y: 560 + focus * (st.m.y + 70 - 560) * 0.5, zoom: 1 + 0.35 * focus })
    st.days.forEach((d) => {
      const holiday = HOLIDAY.includes(d.d)
      const gone = holiday ? seg(t, K.holiday + (d.d - 1) * 0.18, K.holiday + (d.d - 1) * 0.18 + 0.3) : 0
      d.bg.setAttribute('fill', holiday && gone > 0.5 ? '#CFC6B4' : '#F1E8D2')
      const flood = d.d === MAKEUP ? seg(t, K.flood, K.flood + 0.6) : 1
      d.heads.forEach((h, k) => {
        const shown = d.d === MAKEUP ? (k < d.base ? 0 : 1) * (k - d.base < flood * (d.heads.length - d.base) ? 1 : 0) || (t < K.flood && k < 2 ? 1 : 0) : (holiday ? 1 - gone : 1)
        h.style.opacity = String(shown)
      })
    })
    const k = seg(t, K.ban, K.ban + 0.14, outBack)
    st.ban.style.opacity = t >= K.ban ? '1' : '0'
    st.ban.setAttribute('transform', `translate(${st.m.x + 190 - 70} ${st.m.y + 56}) scale(${(1.4 - 0.4 * k).toFixed(3)}) rotate(-8)`)
    st.r.set(seg(t, K.ringBan, K.ringBan + 0.45, outCubic))
  },
})

const CLUES: { say: string; bg: string; ink: string; font?: string }[] = [
  { say: '收到请回复', bg: C.navy, ink: C.cream },
  { say: '辛苦了', bg: C.mustard, ink: C.ink },
  { say: '亲', bg: C.red, ink: C.cream },
  { say: '哈哈哈哈哈哈', bg: C.sage, ink: C.cream },
  { say: '[捂脸][旺柴][抱拳]', bg: C.cream, ink: C.ink, font: MONO },
  { say: '百度一下', bg: C.navy, ink: C.cream },
]

export const montage = scene({
  id: 'montage',
  at: SHOT.s11[0],
  end: SHOT.s11[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    // Before the first card: the counter seen from Claude's side, a stack of passports (a beat to breathe).
    const intro = s(svg, 'g')
    for (let i = 0; i < 9; i++) paperShape(intro, { rect: { x: 700 + (i % 3) * 12, y: 760 - i * 46, w: 520, h: 40 } }, [C.navy, '#7A1F2B', C.red][i % 3]!, { edge: 'cut' })
    text(intro, 960, 220, '今日待检', { size: 64, font: SANS, weight: 900, fill: C.navy, anchor: 'middle', spacing: 8 })
    const posters = CLUES.map((c, i) => {
      const g = s(svg, 'g')
      s(g, 'rect', { width: 1920, height: 1080, fill: c.bg })
      // A Bauhaus block per poster: a circle, a bar or a triangle in a contrasting colour.
      const shapes = [
        () => s(g, 'circle', { cx: 1560, cy: 260, r: 220, fill: C.red }),
        () => s(g, 'rect', { x: 0, y: 820, width: 1920, height: 90, fill: C.navy }),
        () => s(g, 'path', { d: 'M1920 1080 L1920 380 L1220 1080 Z', fill: C.mustard }),
        () => s(g, 'circle', { cx: 300, cy: 860, r: 260, fill: C.mustard }),
        () => s(g, 'rect', { x: 120, y: 120, width: 60, height: 840, fill: C.red }),
        () => s(g, 'path', { d: 'M0 0 L800 0 L0 640 Z', fill: C.red }),
      ]
      shapes[i]!()
      const cardG = card(g, '', { w: 1100, h: 360 })
      text(cardG.g, 0, 30, c.say, { size: c.say.length > 8 ? 76 : 110, font: c.font ?? SANS, weight: 900, anchor: 'middle', fill: C.ink })
      cardG.set({ x: 960, y: 520, rot: (i % 2 ? 2 : -2) })
      const mark = stampMark(g, 1.2, 200 + i)
      return { g, mark }
    })
    const miss = s(svg, 'g')
    s(miss, 'rect', { width: 1920, height: 1080, fill: C.paper })
    const missMark = stampMark(miss, 1.4, 300)
    return { intro, posters, miss, missMark }
  },
  render(f, st) {
    const t = f.t
    const cards = K.cards11
    st.intro.style.opacity = t < cards[0]! - 0.35 ? '1' : '0'
    st.posters.forEach((p, i) => {
      const a = cards[i]! - 0.35, b = i + 1 < cards.length ? cards[i + 1]! - 0.35 : K.miss11 - 0.35
      p.g.style.opacity = t >= a && t < b ? '1' : '0'
      const k = seg(t, cards[i]!, cards[i]! + 0.1, outBack)
      p.mark.set({ x: 1320 - (i % 3) * 120, y: 700 - (i % 2) * 60, rot: -14 + i * 5, s: 1 + 0.3 * (1 - k), o: t >= cards[i]! ? 1 : 0 })
    })
    // The last beat: a blank page; the stamp comes down on nothing and leaves only a faint ring.
    st.miss.style.opacity = t >= K.miss11 - 0.35 ? '1' : '0'
    st.missMark.set({ x: 960, y: 520, rot: -6, o: t >= K.miss11 ? 0.18 : 0, s: 1 })
    void mixAt
  },
})

export const traffic = scene({
  id: 'traffic',
  at: SHOT.s15[0],
  end: SHOT.s15[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.screen)
    const world = s(svg, 'g')
    const X0 = 220, X1 = 1700, Y0 = 760, Y1 = 260
    text(world, X0, 170, '美国用户 · 活跃度', { size: 52, font: SANS, weight: 900, fill: C.cream, spacing: 4 })
    text(world, X0, 222, 'US ACTIVE USERS · 24 H', { size: 26, font: JOST, weight: 700, fill: '#9AA0C8', spacing: 4 })
    // Activity over Pacific time: near zero overnight in Beijing (PT 9–17), a wall from PT 18:00.
    const act = (h: number) => {
      const bj = (h + 15) % 24
      const work = bj >= 9 && bj < 12 ? 1 : bj >= 13.5 && bj < 18 ? 0.95 : bj >= 18 && bj < 23.5 ? 0.6 : bj >= 12 && bj < 13.5 ? 0.25 : 0.05
      return work
    }
    let d = ''
    for (let i = 0; i <= 240; i++) {
      const h = i / 10
      const v = (act(h - 0.15) + act(h) + act(h + 0.15)) / 3 * 0.85 + 0.012 * Math.sin(h * 2.1)
      d += `${i ? 'L' : 'M'}${(X0 + (h / 24) * (X1 - X0)).toFixed(1)} ${(Y0 - v * (Y0 - Y1)).toFixed(1)}`
    }
    const area = s(world, 'path', { d: `${d} L${X1} ${Y0} L${X0} ${Y0} Z`, fill: C.mustard, opacity: 0.85 })
    const clip = s(s(world, 'defs'), 'clipPath', { id: ctx.id('reveal') })
    const reveal = s(clip, 'rect', { x: X0, y: 0, width: 0, height: 1080 })
    area.setAttribute('clip-path', `url(#${clip.id})`)
    s(world, 'line', { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: C.cream, 'stroke-width': 3 })
    const hx = (h: number) => X0 + (h / 24) * (X1 - X0)
    for (let h = 0; h <= 24; h += 3) text(world, hx(h), Y0 + 50, `${String(h % 24).padStart(2, '0')}:00`, { size: 28, font: MONO, weight: 500, fill: C.cream, anchor: 'middle' })
    text(world, X0 - 60, Y0 + 50, 'PT', { size: 26, font: JOST, weight: 700, fill: '#9AA0C8', anchor: 'end' })
    const peak = s(world, 'g')
    s(peak, 'line', { x1: hx(18), x2: hx(18), y1: Y1 - 40, y2: Y0, stroke: C.red, 'stroke-width': 4, 'stroke-dasharray': '10 8' })
    text(peak, hx(18), Y1 - 56, '18:00 上班', { size: 34, font: SANS, weight: 900, fill: C.red, anchor: 'middle' })
    // Beijing time: a second axis, 15 hours ahead.
    const bj = s(world, 'g')
    s(bj, 'rect', { x: X0, y: Y0 + 80, width: X1 - X0, height: 70, fill: C.red })
    for (let h = 0; h <= 24; h += 3) text(bj, hx(h), Y0 + 128, `${String((h + 15) % 24).padStart(2, '0')}:00`, { size: 28, font: MONO, weight: 500, fill: C.cream, anchor: 'middle' })
    text(bj, X0 - 60, Y0 + 128, '北京', { size: 26, font: SANS, weight: 900, fill: C.red, anchor: 'end' })
    const r = ring(world, { x: hx(18) - 52, y: Y0 + 94, w: 104, h: 40 }, 151, { pad: 14, width: 8 })
    return { world, reveal, X0, X1, peak, bj, r }
  },
  render(f, st) {
    const t = f.t
    st.reveal.setAttribute('width', ((st.X1 - st.X0) * seg(t, SHOT.s15[0] + 0.4, K.peak, inOutCubic)).toFixed(1))
    st.peak.style.opacity = String(seg(t, K.peak, K.peak + 0.3))
    const k = seg(t, K.bjAxis, K.bjAxis + 0.5, outCubic)
    st.bj.setAttribute('transform', `translate(${(-1700 * (1 - k)).toFixed(1)} 0)`)
    st.bj.style.opacity = k > 0 ? '1' : '0'
    st.r.set(seg(t, K.ringNine, K.ringNine + 0.45, outCubic))
    const push = seg(t, K.ringNine - 0.2, K.ringNine + 1.5, inOutCubic)
    camera(st.world, { x: 960 + push * 260, y: 540 + push * 160, zoom: 1 + 0.3 * push })
  },
})
