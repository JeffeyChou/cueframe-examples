// s01: the arrivals hall wakes up: the camera starts on the row of world clocks (Beijing taped over)
// and pushes along the wall to the booth, where a cap drops onto Claude on "守边境".
// s03: the queue, panned from its far end to the front: every traveler in a disguise, a passport up,
// and now and then a small "在吗？" over the crowd.
import { scene } from '@cueframe/core'
import {
  BODY, BOOTH, C, GROUND, JOST, blink, pose, booth, bubble, camPath, camera, inOutCubic, mulberry, officer, outBack, outCubic, passport,
  room, s, seg, stageSvg, stanchion, text, traveler, wallClock, type Disguise, type Eyes,
} from '../lib.js'
import { K, SHOT } from '../timing.js'

export const opening = scene({
  id: 'opening',
  at: SHOT.s01[0],
  end: SHOT.s01[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    room(world)
    const zones: [string, number, number, boolean][] = [['LOS ANGELES', 18, 41, false], ['TOKYO', 10, 41, false], ['SINGAPORE', 9, 41, false], ['BEIJING', 9, 41, true]]
    zones.forEach(([city, hh, mm, taped], i) => wallClock(world, 190 + i * 250, 230, 78, city, hh, mm, taped))
    text(world, 560, 470, 'ARRIVALS · 国际到达', { size: 40, font: JOST, weight: 700, fill: C.navy, anchor: 'middle', spacing: 8 })
    for (let i = 0; i < 4; i++) stanchion(world, 140 + i * 240, i < 3 ? 380 + i * 240 : undefined)
    const b = booth(world)
    const claude = officer(b.mid, 200)
    const cap = s(b.front, 'g')
    const cam = camPath([
      { t: SHOT.s01[0], x: 560, y: 300, zoom: 1.7 },
      { t: SHOT.s01[0] + 1.6 },
      { t: K.capOn - 0.4, x: 1180, y: 520, zoom: 1.35, ease: inOutCubic },
      { t: SHOT.s01[1], x: 1150, y: 530, zoom: 1.3 },
    ])
    return { world, claude, cap, cam }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, st.cam(t))
    // Before the cap Claude has none (the cap rides above, out of frame, and drops on "守边境").
    const drop = seg(t, K.capOn, K.capOn + 0.35, outBack)
    const bounce = Math.max(0, Math.sin((t - K.capOn - 0.35) * 18)) * Math.exp(-(t - K.capOn - 0.35) * 6) * (t > K.capOn + 0.35 ? 1 : 0)
    st.claude.set(pose({ ...BODY, x: 1410, y: BOOTH.counter + 40, look: -0.6, capY: -420 * (1 - drop), sy: 1 - 0.05 * bounce, eyes: (drop > 0.9 ? 'open' : 'line') as Eyes }, blink(t, 9)))
  },
})

export const queue = scene({
  id: 'queue',
  at: SHOT.s03[0],
  end: SHOT.s03[1],
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    room(world)
    // The queue runs leftwards from the booth (x 1400) for 30 travelers, between posts.
    const rnd = mulberry(30)
    const kinds: Disguise[] = ['kevin', 'tanaka', 'lim', 'dev', 'mike']
    const countries: Record<Disguise, [string, string]> = { kevin: ['USA', C.navy], mike: ['USA', C.navy], dev: ['USA', C.navy], tanaka: ['JAPAN', '#7A1F2B'], lim: ['SINGAPORE', C.red] }
    const N = 22, GAP = 300
    for (let i = 0; i <= N; i++) stanchion(world, 1250 - i * GAP - 115, i < N ? 1250 - (i + 1) * GAP - 115 : undefined)
    const b = booth(world)
    officer(b.mid, 200).set({ x: 1410, y: BOOTH.counter + 40, look: -1 })
    const people = Array.from({ length: N }, (_, i) => {
      const kind = kinds[Math.floor(rnd() * 5)]!
      const h = kind === 'lim' || kind === 'mike' ? 230 + rnd() * 30 : 270 + rnd() * 50
      const v = traveler(world, kind, h)
      const [c, cover] = countries[kind]
      const p = passport(world, c, cover, 70)
      return { v, p, x: 960 - i * GAP + (rnd() - 0.5) * 30, h, seed: rnd() * 10 }
    })
    const mumbles = [2, 6, 10, 15, 19].map((i) => ({ i, b: bubble(world, '在吗？', { size: 34 }), at: SHOT.s03[0] + 1.5 + (i / N) * 7 + rnd() }))
    const x0 = 960 - (N - 1) * GAP
    const cam = camPath([
      { t: SHOT.s03[0], x: x0 + 300, y: 560, zoom: 1.15 },
      { t: SHOT.s03[1] - 1.2, x: 900, y: 560, zoom: 1.0, ease: inOutCubic },
      { t: SHOT.s03[1], x: 960, y: 540, zoom: 1 },
    ])
    return { world, people, mumbles, cam }
  },
  render(f, st) {
    const t = f.t
    camera(st.world, st.cam(t))
    st.people.forEach((q, i) => {
      // Shuffling: a small step forward now and then; the passport held up beside the face.
      const step = Math.max(0, Math.sin(t * 1.3 + q.seed)) ** 8 * 10
      q.v.set({ x: q.x + step, y: GROUND - step * 0.6, look: 1, blink: (Math.sin(t * 2 + q.seed * 3) > 0.985 ? 1 : 0) })
      q.p.set({ x: q.x + q.h * 0.42 + step, y: GROUND - q.h * 0.55, rot: 8 + Math.sin(t * 2 + i) * 2 })
    })
    st.mumbles.forEach((m) => {
      const k = seg(t, m.at, m.at + 0.2, outBack) * (1 - seg(t, m.at + 1.4, m.at + 1.6))
      const p = st.people[m.i]!
      m.b.set({ x: p.x + 20, y: GROUND - p.h - 30, o: k > 0 ? 1 : 0, s: Math.max(0.001, k * 0.8) })
    })
    void outCubic
  },
})
