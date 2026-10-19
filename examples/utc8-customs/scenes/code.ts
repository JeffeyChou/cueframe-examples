// s08: the developer says nothing and turns the laptop round. The screen fills the frame: an editor
// over a terminal, lines typed on one by one, three clues ringed in red, then the stamp lands on
// the screen glass.
import { cue, scene } from '@cueframe/core'
import { C, JOST, MONO, camera, mixAt, outCubic, pieces, ring, s, seg, stageSvg, stampMark, start, text } from '../lib.js'

const SIZE = 40
/** Each editor line as pieces; a piece named in RINGS gets a ring. */
const EDITOR: string[][] = [
  ["app.post('/api/denglu', async (req, res) => {"],
  ['  const ', 'yongHuMing', ' = req.body.yongHuMing'],
  ['  const miMa = req.body.miMa'],
  ['  ', '// 老板说明天上线，先这样'],
  ["  if (miMa === '123456') return res.send('ok')"],
  ['})'],
]
const TERMINAL = ['$ npm config set registry https://', 'registry.npmmirror.com']
const RINGS = ['yongHuMing', '// 老板说明天上线，先这样', 'registry.npmmirror.com']

export const code = scene({
  id: 's08',
  at: cue('scene.s08.start'),
  end: cue('scene.s08.end'),
  mount(ctx) {
    const svg = stageSvg(ctx, C.paper)
    const world = s(svg, 'g')
    // Laptop lid filling the frame, the dev's hood at the bottom left.
    s(world, 'rect', { x: 120, y: 60, width: 1680, height: 1000, rx: 36, fill: C.ink })
    s(world, 'rect', { x: 160, y: 100, width: 1600, height: 900, fill: C.screen })
    s(world, 'rect', { x: 160, y: 100, width: 1600, height: 56, fill: '#2A3060' })
    ;['#C7432F', '#E3A72F', '#7A8B6F'].forEach((c, i) => s(world, 'circle', { cx: 196 + i * 34, cy: 128, r: 10, fill: c }))
    text(world, 960, 138, 'denglu.js — seattle-startup', { size: 24, font: JOST, weight: 500, fill: '#9AA0C8', anchor: 'middle', spacing: 1 })
    const lines: SVGGElement[] = []
    const boxes: { x: number; y: number; w: number; h: number }[] = []
    EDITOR.forEach((parts, i) => {
      const g = s(world, 'g')
      text(g, 196, 236 + i * 70, String(i + 1), { size: SIZE * 0.8, font: MONO, weight: 400, fill: '#5A6090' })
      const ps = pieces(g, 260, 236 + i * 70, parts, { size: SIZE, font: MONO, weight: 500, fill: parts[0]!.trim().startsWith('//') || parts[1]?.startsWith('//') ? '#9DB08E' : C.cream })
      ps.forEach((p, k) => { if (RINGS.includes(parts[k]!)) boxes.push(p) })
      lines.push(g)
    })
    s(world, 'rect', { x: 160, y: 720, width: 1600, height: 280, fill: '#12152E' })
    text(world, 196, 768, 'TERMINAL', { size: 22, font: JOST, weight: 600, fill: '#5A6090', spacing: 3 })
    const term = s(world, 'g')
    const tp = pieces(term, 196, 850, TERMINAL, { size: SIZE * 0.9, font: MONO, weight: 500, fill: C.mustard })
    boxes.push(tp[1]!)
    lines.push(term)
    const rings = boxes.map((b, i) => ring(world, b, 60 + i * 7, { pad: 9, width: 8 }))
    // The back of the developer's hooded head, bottom left.
    const hood = s(world, 'g')
    s(hood, 'rect', { x: -20, y: 880, width: 420, height: 400, rx: 120, fill: '#5E5A55' })
    s(hood, 'rect', { x: 50, y: 950, width: 280, height: 300, rx: 90, fill: C.grey })
    const mark = stampMark(world, 1.1, 13, C.screen)
    const t0 = start('s08')
    return { world, lines, rings, hood, mark, t0, type: t0 + 0.6, ring: t0 + 5.2, hit: t0 + 11 }
  },
  render(f, st) {
    const t = f.t
    // Turned round: the lid swings in from the side, then a slow push.
    const turn = seg(t, st.t0, st.t0 + 0.7, outCubic)
    camera(st.world, { x: 960 + (1 - turn) * 700, y: 540, zoom: 1 + 0.04 * seg(t, st.t0 + 0.7, st.hit) })
    st.lines.forEach((g, i) => { g.style.opacity = String(seg(t, st.type + i * 0.55, st.type + i * 0.55 + 0.2)) })
    st.rings.forEach((r, i) => r.set(seg(t, st.ring + i * 1.6, st.ring + i * 1.6 + 0.45, outCubic)))
    st.mark.set({ x: 1380, y: 560, rot: -10, s: mixAt(t, st.hit, st.hit + 0.12, 1.25, 1), o: t >= st.hit ? 1 : 0 })
  },
})
