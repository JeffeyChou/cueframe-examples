// The whole cut in one frame canvas: footage from frame sources, one window grammar per shot
// (kits/beatcut.ts) and a live "vision analysis" on top (`analysis`, lib/schematic.ts): nodes
// from each clip's block-score grid riding the tracks, a lattice, boxes with float data, flow trails.
// The music drives it continuously (low band: the lattice breathes; high band: the flow) and on hits
// (kick: chroma + a dashed wave; snare: blocks move, boxes re-lock with an RGB split).
import { scene, type Frame, type FrameFit, type FrameSource } from '@cueframe/core'
import { chroma, drawWindow, hitIn, pulse, shotAt, type Paint, type Rect } from '../../../kits/beatcut.js'
import { analysis, BlockGrid, boxes, crosshair, labels, slate, style, type Label } from '../lib/schematic.js'
import { BREATH, CLIPS, DUR, PLANS, SHOTS, type Plan } from '../edit.js'

const W = 1920, H = 1080, FPS = 30
const FULL: Rect = { x: 0, y: 0, w: W, h: H }
const MONO = '"JetBrains Mono", monospace'
const COBALT = '#0b5cff'
/** Seconds of a clip shown before its cut (an insert shows it early); some clips start on their moment. */
const LEAD = 0.4
const CLIP_LEAD: Record<string, number> = { 'lightning-city': 1.62, 'lightning-clouds': 0.9 }
/** Clips whose highlights shimmer faster than 3 flashes a second (WCAG 2.3.1): drawn with less contrast. */
const CALM: Record<string, string> = { 'drops-puddle': 'contrast(0.65)' }

interface State { g: CanvasRenderingContext2D; src: Record<string, FrameSource>; grid: Record<string, BlockGrid> }

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0')
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
      const calm = CALM[clip], filter = gg.filter
      if (calm) gg.filter = filter === 'none' ? calm : `${filter} ${calm}`
      st.src[clip]!.draw(gg, frameOf(st, p, clip, t), { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h })
      gg.filter = filter
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
      g.globalAlpha = 0.45 * Math.pow(1 - (t - 20.57) / 0.25, 2)
      g.fillStyle = '#dfe9ff'
      g.fillRect(0, 0, W, H)
      g.restore()
    }

    const d = breath ? 0 : p.density
    const sk = style(f.stage, { palette: 'whiteOnDark', font: MONO, size: 16, alpha: 0.55 + 0.45 * d })
    const items: Label[] = []

    if (breath) {
      // everything clears but one lock box on the centre
      crosshair(g, W / 2, H / 2, sk, { mode: 'brackets', alpha: 0.9 })
      items.push(...boxes(g, [{ id: 'lock', nodes: [], x: W / 2 - 120, y: H / 2 - 70, w: 240, h: 140, score: 1 }], sk, {
        pad: 30, label: () => `LOCK  T−${(BREATH[1] - t).toFixed(3)}`,
      }))
    } else if (d > 0.02) {
      const s = st.src[p.clip]!
      const k = frameOf(st, p, p.clip, t)
      const fit: FrameFit = s.draw({ drawImage() {} }, k, area)
      const a = analysis(g, sk, {
        grid: st.grid[p.clip]!, k, k0: frameOf(st, p, p.clip, shot.at), fit, area, density: d, shot: shot.i,
        // nodes ride every track; trails follow the shot's best-scored ones
        tracks: { ids: s.tracks(), flow: tracked(st, p), at: (id, j) => { const q = s.track(id, j, fit); return q.visible ? q : null } },
        music: { low, high, kick, snare, kickSince: kickHit.hit ? kickHit.since : undefined, snareSince: snareHit.hit ? snareHit.since : undefined },
      }, { zone: p.kind === 'letterbox' ? false : {} })
      items.push(...a.labels)
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
