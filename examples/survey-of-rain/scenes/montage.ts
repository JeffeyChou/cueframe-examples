// The whole cut in one frame canvas: footage from frame sources, one window grammar per shot
// (recipes/beatcut.ts) and a live "vision analysis" on top (recipes/schematic.ts): nodes from each
// clip's block-score grid joined into a lattice, boxes around clusters carrying float data, optical
// flow trails from the KLT tracks. The music drives it continuously (low band: the lattice breathes;
// high band: flow and labels) and on hits (kick: chroma + a dashed square wave; snare: blocks move,
// boxes re-lock with an RGB split).
import { scene, type Frame, type FrameFit, type FrameSource } from '@cueframe/core'
import { chroma, drawWindow, hitIn, pulse, shotAt, type Paint, type Rect } from '@cueframe/recipes/beatcut.js'
import {
  BlockGrid, boxes, chain, clusters, crosshair, dots, lattice, latticeEdges, labels, pixelZone, scanline, slate, style, trail, vectors,
  type Cluster, type Flow, type GridNode, type Label,
} from '@cueframe/recipes/schematic.js'
import { BREATH, CLIPS, DUR, PLANS, SHOTS, type Plan } from '../edit.js'

const W = 1920, H = 1080, FPS = 30
const FULL: Rect = { x: 0, y: 0, w: W, h: H }
const MONO = '"JetBrains Mono", monospace'
const COBALT = '#0b5cff'
const RED = '#ff2a3a', BLUE = '#2ad4ff'
/** Seconds of a clip shown before its cut (an insert shows it early); some clips start on their moment. */
const LEAD = 0.4
const CLIP_LEAD: Record<string, number> = { 'lightning-city': 1.62, 'lightning-clouds': 0.9 }

interface State { g: CanvasRenderingContext2D; src: Record<string, FrameSource>; grid: Record<string, BlockGrid> }

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0')
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}`
const planAt = (t: number): Plan => PLANS[shotAt(SHOTS, t).i]!

/** The clip second a plan shows `clip` at `t`: the insert of a growing window runs on the next shot's clock. */
function clipSec(p: Plan, clip: string, t: number): number {
  const next = PLANS[p.shot.i + 1]
  const at = clip === p.clip || !next || next.clip !== clip ? p.shot.at : next.shot.at
  return t - at + (CLIP_LEAD[clip] ?? LEAD)
}
const frameOf = (st: State, p: Plan, clip: string, t: number) => st.src[clip]!.frameAt(Math.max(0, clipSec(p, clip, t)))

/** The tracked features a shot follows: the best-scored ones at its first frame (memoised per shot). */
const trackMemo = new Map<number, string[]>()
function tracked(st: State, p: Plan): string[] {
  const hit = trackMemo.get(p.shot.i)
  if (hit) return hit
  const s = st.src[p.clip]!
  const k0 = frameOf(st, p, p.clip, p.shot.at)
  const ids = s.tracks()
    .map((id) => ({ id, q: s.track(id, k0) }))
    .filter((x) => x.q.visible)
    .sort((a, b) => (b.q.values?.score ?? 0) - (a.q.values?.score ?? 0) || (a.id < b.id ? -1 : 1))
    .slice(0, 24).map((x) => x.id)
  trackMemo.set(p.shot.i, ids)
  return ids
}

export default scene({
  id: 'montage',
  at: 0,
  dur: DUR,
  async mount(ctx) {
    const g = ctx.canvas('frame', { frame: true })
    const src: Record<string, FrameSource> = {}
    const grid: Record<string, BlockGrid> = {}
    for (const id of CLIPS) {
      src[id] = await ctx.frames(`build/plates/${id}`, { cache: 6 })
      grid[id] = await BlockGrid.load(`build/plates/${id}`)
    }
    return { g, src, grid } satisfies State
  },
  async prepare(f, st) {
    const p = planAt(f.t)
    for (const clip of new Set([p.clip, p.insert])) await st.src[clip]!.load(frameOf(st, p, clip, f.t))
  },
  render(f: Frame, st) {
    const { g } = st
    const t = f.t
    const p = planAt(t)
    const { shot, section } = p
    const breath = t >= BREATH[0] && t < BREATH[1]
    const low = f.env('low'), high = f.env('high')
    const kickHit = hitIn(shot, t, { tier: 0, kinds: ['kick'] })
    const snareHit = hitIn(shot, t, { tier: 0, kinds: ['snare'] })
    const kick = Math.max(kickHit.hit ? pulse(kickHit.since, 0.12) : 0, pulse(t - shot.at, 0.1))
    const snare = snareHit.hit ? pulse(snareHit.since, 0.14) : 0

    // a small push on every kick gives still stock footage a physical snap
    const punch = 1 + 0.03 * kick
    const paint = (clip: string): Paint => (gg, r) => {
      const w = r.w * punch, h = r.h * punch
      st.src[clip]!.draw(gg, frameOf(st, p, clip, t), { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h })
    }

    let area: Rect = FULL
    if (breath) {
      g.fillStyle = COBALT
      g.fillRect(0, 0, W, H)
    } else {
      const win = drawWindow(g, p.kind, {
        stage: f.stage, shot, t, frame: f.frame, base: paint(p.clip), insert: paint(p.insert),
        grade: p.grade, alt: p.alt, accent: COBALT,
        // blocks and windows move on the backbeat; slivers flick on hats; the letterbox on any accent
        sel: p.kind === 'sliver' ? { tier: 1 } : p.kind === 'letterbox' ? { tier: 0 } : { tier: 0, kinds: ['snare'] },
      })
      if (p.kind === 'letterbox' && win.rect) area = win.rect
      chroma(g, area, 10 * kick)
    }

    // the drop: one white flash that decays over a quarter second (a single flash, not a strobe)
    if (t >= 20.57 && t < 20.82) {
      g.save()
      g.globalCompositeOperation = 'screen'
      g.globalAlpha = 0.85 * Math.pow(1 - (t - 20.57) / 0.25, 2)
      g.fillStyle = '#dfe9ff'
      g.fillRect(0, 0, W, H)
      g.restore()
    }

    const d = breath ? 0 : p.density
    const sk = style(f.stage, { palette: 'whiteOnDark', font: MONO, size: 16, alpha: 0.55 + 0.45 * d, accents: { red: RED, blue: BLUE } })
    const items: Label[] = []

    if (breath) {
      // everything clears but one lock box on the centre
      crosshair(g, W / 2, H / 2, sk, { mode: 'brackets', alpha: 0.9 })
      items.push(...boxes(g, [{ id: 'lock', nodes: [], x: W / 2 - 120, y: H / 2 - 70, w: 240, h: 140, score: 1 }], sk, {
        pad: 30, label: () => `LOCK  T−${(BREATH[1] - t).toFixed(3)}`,
      }))
    } else if (d > 0.02) {
      const s = st.src[p.clip]!
      const grid = st.grid[p.clip]!
      const k = frameOf(st, p, p.clip, t)
      const k0 = frameOf(st, p, p.clip, shot.at)
      const fit: FrameFit = s.draw({ drawImage() {} }, k, area)
      const zoom = area.w / W
      const m = sk.margin * 1.7
      const within: Rect = { x: area.x + m, y: area.y + m, w: area.w - 2 * m, h: area.h - 2 * m }
      const readout: Rect = { x: 0, y: H - sk.margin - 190, w: sk.margin + 300, h: 190 + sk.margin }
      // the low band lowers the bar and stretches the lines: the lattice breathes with the 808
      const threshold = 0.24 - 0.1 * low
      const nodes: GridNode[] = grid.nodes(k, { smooth: 3, threshold, max: Math.round(16 + 44 * d), spacing: 2, fit, within, age: 12, from: k0 })
        .filter((n) => !(n.x < readout.x + readout.w && n.y > readout.y))
      const dist = (240 + 170 * low) * zoom

      const ranked = clusters(nodes, 3, { min: 3 }).filter((c) => c.nodes.length <= 7 && c.w < area.w * 0.3 && c.h < area.h * 0.4)
        .sort((a, b) => b.nodes.length - a.nodes.length || b.score - a.score)
      const groups: Cluster[] = ranked.slice(0, d > 0.7 ? 3 : 2).sort((a, b) => (a.id < b.id ? -1 : 1))
      const top = ranked[0]
      if (top && d >= 0.7 && p.kind !== 'letterbox') {
        const n0 = [...top.nodes].sort((a, b) => b.score - a.score)[0]!
        const zx = Math.min(W - 300, Math.max(140, n0.x - 84)), zy = Math.min(H - 280, Math.max(150, n0.y - 72))
        items.push(...pixelZone(g, zx, zy, 168, 144, 24, sk, { tag: `REGION_${pad2(shot.i + 1)}`, label: false }))
      }
      const ctr = nodes.length
        ? { x: nodes.reduce((a, n) => a + n.x, 0) / nodes.length, y: nodes.reduce((a, n) => a + n.y, 0) / nodes.length }
        : { x: W / 2, y: H / 2 }
      crosshair(g, ctr.x, ctr.y, sk, { mode: d < 0.5 ? 'brackets' : 'cross', alpha: 0.35, scale: zoom * (1 + 0.15 * kick) })
      // one faint construction chain, in every fourth shot only
      if (shot.i % 4 === 1) items.push(...chain(g, ctr.x, ctr.y, sk, { n: 2, r: 300 * zoom, angle: -0.6, alpha: 0.35, grow: (t - shot.at) / 0.5, centres: false }))

      // the kick's wave: a dashed rectangle that opens from the centre of mass and fades
      if (kickHit.hit && kickHit.since < 0.3) {
        const r = 60 + kickHit.since * 2600, a = 1 - kickHit.since / 0.3
        g.save()
        g.strokeStyle = BLUE
        g.globalAlpha = 0.55 * a
        g.lineWidth = 1.5
        g.setLineDash([10, 8])
        g.strokeRect(ctr.x - r, ctr.y - r * 0.62, 2 * r, 2 * r * 0.62)
        g.restore()
      }

      items.push(...lattice(g, nodes, sk, { dist, max: 5, grow: 8, alpha: 0.6 + 0.35 * d, accent: 0.08, lengths: 2 }))
      const flows: Flow[] = tracked(st, p).map((id) => ({
        id,
        pts: trail(k, 12, (j) => {
          if (j < k0) return null
          const q = s.track(id, j, fit)
          return q.visible ? q : null
        }),
      }))
      vectors(g, flows, sk, { len: 12, gain: 4, accent: 0.15, alpha: 0.45 + 0.55 * high })

      const mean = (c: Cluster, kk: number) => c.nodes.reduce((a, n) => a + grid.score(kk, n.col, n.row, 3), 0) / c.nodes.length
      items.push(...boxes(g, groups, sk, {
        pad: 26 * zoom, accent: 0.34, split: 9 * snare,
        label: (c) => `${c.id.toUpperCase().replace('_', '.')}  ${mean(c, k).toFixed(4)}  Δ${signed(mean(c, k) - mean(c, k - 4))}  n=${c.nodes.length}`,
      }))
      items.push(...dots(g, nodes, sk, { accent: 0.1, labels: d >= 0.25 }))
      if (snare > 0) scanline(g, snareHit.since / 0.15, sk, { area, alpha: 0.5 })

      // telemetry from the analysis itself
      if (d >= 0.25) {
        const edges = latticeEdges(nodes, dist, 5)
        const flowPx = flows.reduce((a, fl) => {
          const q = fl.pts
          return q.length > 1 ? a + Math.hypot(q[q.length - 1]!.x - q[q.length - 2]!.x, q[q.length - 1]!.y - q[q.length - 2]!.y) : a
        }, 0) / Math.max(1, flows.length)
        const lines = [
          `NODES ${pad2(nodes.length)}  EDGES ${pad2(edges.length)}`,
          `μ ${(nodes.reduce((a, n) => a + n.score, 0) / Math.max(1, nodes.length)).toFixed(4)}  θ ${threshold.toFixed(3)}`,
          `FLOW ${flowPx.toFixed(2)} px/f`,
          `LOW ${low.toFixed(3)}  HIGH ${high.toFixed(3)}`,
        ]
        const lh = Math.round(sk.size * 1.35), x = sk.margin, y = H - sk.margin - 150
        items.push(...lines.map((text, i): Label => ({ text, x: x + sk.size * 0.7, y: y + i * lh, base: 'top', alpha: 0.85, priority: 50, fixed: true })))
      }
    }

    items.push(...slate(sk, {
      tl: `SCHEMATIC / RAIN · ${section.title}`,
      tr: `${pad2(shot.i + 1)}.${pad2((t - shot.at) * FPS)}`,
      bl: breath ? 'HOLD' : `${p.clip.toUpperCase()} · ${p.kind.toUpperCase()}`,
      br: kickHit.hit && kickHit.since < 0.15 ? `KICK ${kickHit.hit.s.toFixed(2)}` : snareHit.hit && snareHit.since < 0.15 ? `SNARE ${snareHit.hit.s.toFixed(2)}` : '#0B5CFF',
    }))
    // the title card owns the middle while it shows
    const title: Rect[] = t < 6.4 ? [{ x: 420, y: 330, w: 1080, h: 420 }] : []
    labels(g, items, sk, { audit: f.audit, budget: 10, avoid: title })
  },
})
