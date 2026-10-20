// The whole cut in one frame canvas: footage from frame sources, one window grammar per shot
// (recipes/beatcut.ts), the schematic apparatus on top (recipes/schematic.ts), points from the
// clips' KLT tracks and their score channel.
import { fitRect, scene, type Frame, type FrameSource } from '@cueframe/core'
import { drawWindow, hitIn, pulse, select, shotAt, type Paint, type Rect } from '@cueframe/recipes/beatcut.js'
import {
  chain, connections, crosshair, density, detections, flowAngle, follow, glide, labels, pickPoints, pixelZone, rays,
  scanline, scanSelect, slate, style, telemetry, type Cand, type Label,
} from '@cueframe/recipes/schematic.js'
import { BREATH, CLIPS, DUR, PLANS, SHOTS, type Plan } from '../edit.js'

const W = 1920, H = 1080
const FULL: Rect = { x: 0, y: 0, w: W, h: H }
const MONO = '"JetBrains Mono", monospace'
const COBALT = '#0b5cff'
/** Seconds of a clip shown before its cut (an insert shows it early); some clips start on their moment. */
const LEAD = 0.4
const CLIP_LEAD: Record<string, number> = { 'lightning-city': 1.62, 'lightning-clouds': 0.9 }

interface State { g: CanvasRenderingContext2D; src: Record<string, FrameSource> }

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0')
const planAt = (t: number): Plan => PLANS[shotAt(SHOTS, t).i]!

/** The clip second a plan shows `clip` at `t`: the insert of a growing window runs on the next shot's clock. */
function clipSec(p: Plan, clip: string, t: number): number {
  const next = PLANS[p.shot.i + 1]
  const at = clip === p.clip || !next || next.clip !== clip ? p.shot.at : next.shot.at
  return t - at + (CLIP_LEAD[clip] ?? LEAD)
}

function frameOf(st: State, p: Plan, clip: string, t: number): number {
  return st.src[clip]!.frameAt(Math.max(0, clipSec(p, clip, t)))
}

/** Tracked points of a clip drawn into `area`, with their scores, at time t. */
function cands(st: State, p: Plan, t: number, area: Rect): Cand[] {
  const s = st.src[p.clip]!
  const k = frameOf(st, p, p.clip, t)
  const fit = fitRect(s.w, s.h, area)
  const out: Cand[] = []
  for (const id of s.tracks()) {
    const q = s.track(id, k, fit)
    if (!q.visible || q.x < area.x + 24 || q.y < area.y + 24 || q.x > area.x + area.w - 24 || q.y > area.y + area.h - 24) continue
    out.push({ id, x: q.x, y: q.y, score: q.values?.score ?? 0 })
  }
  return out
}

export default scene({
  id: 'montage',
  at: 0,
  dur: DUR,
  async mount(ctx) {
    const g = ctx.canvas('frame', { frame: true })
    const src: Record<string, FrameSource> = {}
    for (const id of CLIPS) src[id] = await ctx.frames(`build/plates/${id}`, { cache: 6 })
    return { g, src } satisfies State
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
    const paint = (clip: string): Paint => (gg, r) => { st.src[clip]!.draw(gg, frameOf(st, p, clip, t), r) }
    const breath = t >= BREATH[0] && t < BREATH[1]

    let area: Rect = FULL
    if (breath) {
      g.fillStyle = COBALT
      g.fillRect(0, 0, W, H)
    } else {
      const win = drawWindow(g, p.kind, {
        stage: f.stage, shot, t, frame: f.frame, base: paint(p.clip), insert: paint(p.insert),
        grade: p.grade, alt: p.alt, accent: section.id === 'surface' ? '#ff6a2a' : COBALT,
        // windows jump on accents; slivers flick on every hat too
        sel: p.kind === 'sliver' ? { tier: 1 } : { tier: 0 },
      })
      if (p.kind === 'letterbox' && win.rect) area = win.rect
    }

    // the drop and the lightning: a white flash that decays over a quarter second
    const flashAt = [20.57].find((a) => t >= a && t < a + 0.3)
    if (flashAt !== undefined) {
      g.save()
      g.globalCompositeOperation = 'screen'
      g.globalAlpha = Math.pow(1 - (t - flashAt) / 0.3, 2)
      g.fillStyle = '#dfe9ff'
      g.fillRect(0, 0, W, H)
      g.restore()
    }

    const dn = density(breath ? 0 : p.density)
    const sk = style(f.stage, { palette: 'whiteOnDark', font: MONO, alpha: dn.alpha })
    const items: Label[] = []
    const { k, since, hit } = hitIn(shot, t)
    const tc = `${pad2(shot.i + 1)}.${pad2((t - shot.at) * f.fps)}`

    if (!breath) {
      const zoom = area.w / W
      const opts = { max: dn.points, spacing: 130, minR: 12 * zoom, maxR: 46 * zoom, seed: p.clip }
      const accents = select(shot.hits, { tier: 0 })
      const scanAt = (n: number) => (n === 0 ? shot.at : accents[n - 1]!.t)
      const ids = (n: number) => scanSelect(`survey:${shot.i}`, n, (i, keep) => pickPoints(cands(st, p, scanAt(i), FULL), { ...opts, keep, swap: 2 }))
      const now = cands(st, p, t, area)
      const pts = follow(ids(k + 1), now, opts)
      const age = (q: { id: string }) => {
        let n = k + 1
        while (n > 0 && ids(n - 1).includes(q.id)) n--
        return t - scanAt(n)
      }
      const mid = (q: { x: number; y: number }) => Math.abs(q.x - area.x - area.w / 2) < area.w * 0.3 && Math.abs(q.y - area.y - area.h / 2) < area.h * 0.3
      const centre = { x: area.x + area.w / 2, y: area.y + area.h / 2 }
      const focusOf = (n: number) => follow(ids(n), now, opts).find(mid) ?? centre
      const focus = k < 0 ? focusOf(0) : glide(focusOf(k), focusOf(k + 1), since)
      const flow = flowAngle(pts, follow(ids(k + 1), cands(st, p, t - 1 / f.fps, area), opts)) ?? -1.2

      const z = pts.filter((q) => !mid(q))[0]
      if (z && dn.zones && p.kind !== 'letterbox') {
        const zx = Math.min(W - 300, Math.max(100, z.x + 40)), zy = Math.min(H - 260, Math.max(120, z.y + 30))
        items.push(...pixelZone(g, zx, zy, 200, 160, 20, sk, { tag: `REGION_${pad2(shot.i + 1)}`, target: z }))
      }
      const kick = hit?.kind === 'kick' ? pulse(since) : 0
      crosshair(g, focus.x, focus.y, sk, { mode: dn.reticle, scale: 1 + 0.3 * kick })
      connections(g, pts, dn.connect * zoom, age, sk)
      if (p.overlay === 'chain' && dn.chain) items.push(...chain(g, focus.x, focus.y, sk, { angle: flow, grow: (t - shot.at) / 0.5, r: 170 * zoom }))
      if (p.overlay === 'rays' && dn.rays) items.push(...rays(g, focus, pts.filter((q) => q !== focus), sk, { seed: shot.i, grow: (t - shot.at) / 0.3, clear: 40 }))
      items.push(...detections(g, pts, age, sk, { labels: dn.labels }))
      const snare = hitIn(shot, t, { tier: 0, kinds: ['snare'] })
      if (snare.hit) scanline(g, snare.since / 0.15, sk, { area })
      const hats = hitIn(shot, t, { tier: 1 }).k + 1
      if (dn.labels) {
        items.push(...telemetry(g, sk.margin, H - sk.margin - 150, [
          `SCAN ${pad2(k + 1)}/${pad2(accents.length)}`, `PTS ${pad2(pts.length)}`,
          `FLOW ${String(Math.round(((flow * 180) / Math.PI + 450) % 360)).padStart(3, '0')}°`, 'SCORE 0.##',
        ], shot.i * 100 + hats, sk))
      }
    } else {
      crosshair(g, W / 2, H / 2, sk, { mode: 'brackets' })
    }
    items.push(...slate(sk, {
      tl: `SCHEMATIC / RAIN · ${section.title}`,
      tr: tc,
      bl: breath ? 'HOLD' : `${p.clip.toUpperCase()} · ${p.kind.toUpperCase()}`,
      br: hit ? `HIT ${hit.kind.toUpperCase()} ${hit.s.toFixed(2)}` : section.id === 'surface' ? '#FF6A2A' : '#0B5CFF',
    }))
    labels(g, items, sk, { audit: f.audit })
  },
})
