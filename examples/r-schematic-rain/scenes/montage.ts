import { scene } from '@cueframe/core'
import type { Frame, Plate } from '@cueframe/core'
import { DUR, SHOTS, shotAt, lastHit, lastScan, type Shot } from '../edit.js'
import { circles, connections, crosshair, chain, pixelZone, slate, label, type Pt } from '../schematic.js'

const W = 1920, H = 1080
const BLUE = '#0b5cff'
const ORANGE = '#ff5a1e'
const CLIPS = [...new Set(SHOTS.flatMap((s) => [s.clip, s.insert]))]

interface PointsFile { frames: number; points: Record<string, { born: number; len: number; s: number[] }> }
interface State { g: CanvasRenderingContext2D; tmp: CanvasRenderingContext2D; base: Plate[]; ins: Plate[]; pts: Record<string, PointsFile> }

// cueframe: a plate is placed by start/from only; a clip shown before its cut (as an insert) needs a lead.
const LEAD = 1

function rect(s: Shot, k: number): [number, number, number, number] {
  // deterministic window per hit index
  let h = (s.i * 7919 + (k + 1) * 104729) >>> 0
  const r = () => ((h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296)
  const w = 360 + r() * 700, hh = 300 + r() * 420
  return [W / 2 - w / 2 + (r() - 0.5) * 520, H / 2 - hh / 2 + (r() - 0.5) * 260, w, hh]
}

function grade(g: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, tone: string) {
  g.save()
  g.filter = 'grayscale(1) contrast(1.15)'
  g.drawImage(img, x, y, w, h)
  g.filter = 'none'
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = tone
  g.fillRect(x, y, w, h)
  g.globalCompositeOperation = 'screen'
  g.fillStyle = '#04122a'
  g.fillRect(x, y, w, h)
  g.restore()
}

function tint(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.save()
  g.globalCompositeOperation = 'color'
  g.fillStyle = color
  g.fillRect(x, y, w, h)
  g.globalCompositeOperation = 'soft-light'
  g.fillRect(x, y, w, h)
  g.restore()
}

function selectPoints(st: State, s: Shot, scanT: number, f: Frame): Pt[] {
  const p = st.base[s.i]!
  const file = st.pts[s.clip]!
  const fr = Math.round((scanT - Math.max(0, s.at - LEAD)) * 30) + (s.at < LEAD ? Math.round((LEAD - s.at) * 30) : 0)
  const cand: { id: string; s: number }[] = []
  for (const [id, q] of Object.entries(file.points)) {
    const i = fr - q.born
    if (i >= 0 && i < q.len) cand.push({ id, s: q.s[i]! })
  }
  cand.sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1))
  const max = cand[0]?.s ?? 1
  const out: Pt[] = []
  for (const c of cand) {
    if (out.length >= 16) break
    const q = p.track(c.id, f)
    if (!q.visible) continue
    if (out.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < 110)) continue
    const j = 0.6 + ((c.id.length * 31 + out.length * 17) % 10) / 12
    out.push({ id: c.id, x: q.x, y: q.y, r: (10 + 34 * (c.s / max)) * j, s: c.s / max })
  }
  return out
}

export default scene({
  id: 'montage',
  at: 0,
  dur: DUR,
  async mount(ctx) {
    const g = ctx.canvas('frame', { frame: true })
    const tmp = document.createElement('canvas').getContext('2d')!
    // cueframe: one plate per use; every plate keeps decoding its frame even when this shot is not drawn.
    const base: Plate[] = [], ins: Plate[] = []
    const pts: Record<string, PointsFile> = {}
    const opts = (at: number) => ({ start: Math.max(0, at - LEAD), from: at < LEAD ? Math.round((LEAD - at) * 30) : 0 })
    for (const s of SHOTS) {
      base.push(await ctx.plate(`build/plates/${s.clip}`, opts(s.at)))
      ins.push(await ctx.plate(`build/plates/${s.insert}`, opts(s.at)))
    }
    for (const p of [...base, ...ins]) p.layer.style.visibility = 'hidden'
    for (const id of CLIPS) pts[id] = await (await fetch(`/build/plates/${id}/points.json`)).json() as PointsFile
    return { g, tmp, base, ins, pts } satisfies State
  },
  render(f, st) {
    const { g } = st
    const t = f.t
    const s = shotAt(t)
    const base = st.base[s.i]!.el
    const ins = st.ins[s.i]!.el
    const { k, since } = lastHit(s, t)
    const tone = s.mode === 'split' ? '#9fb6d8' : '#4f86e8'
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)

    // --- footage + colour blocks ---
    if (s.mode === 'strobe' && t > s.at + 0.3) {
      const boxed = f.frame % 2 === 0
      if (boxed) grade(g, base, W * 0.25, H * 0.27, W * 0.5, H * 0.46, tone)
      else grade(g, base, 0, 0, W, H, tone)
    } else grade(g, base, 0, 0, W, H, tone)

    const [x, y, w, h] = rect(s, k)
    const p = (s.end - t) < 0.5 && s.mode === 'grow' ? (0.5 - (s.end - t)) / 0.5 : 0
    if (s.mode === 'tint') tint(g, x, y, w, h, BLUE)
    if (s.mode === 'grow') {
      const gx = x * (1 - p), gy = y * (1 - p), gw = w + (W - w) * p, gh = h + (H - h) * p
      g.save(); g.beginPath(); g.rect(gx, gy, gw, gh); g.clip()
      grade(g, ins, 0, 0, W, H, '#6aa0ff'); tint(g, gx, gy, gw, gh, BLUE)
      g.restore()
    }
    if (s.mode === 'pip' && k >= 0) {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip()
      grade(g, ins, 0, 0, W, H, '#3f78e0')
      g.restore()
    }
    if (s.mode === 'sliver' && k >= 0 && since < 0.2) {
      const sw = 60 + (k % 3) * 30
      g.save(); g.beginPath(); g.rect(x + w * 0.6, y, sw, h * 1.1); g.clip()
      grade(g, ins, 0, 0, W, H, '#c9d6ee')
      g.restore()
    }
    if (s.mode === 'circle' && k >= 0) {
      g.save(); g.beginPath(); g.arc(W / 2, H / 2, 260, 0, Math.PI * 2); g.clip()
      grade(g, ins, 0, 0, W, H, k % 2 ? '#e8f0ff' : '#3f78e0')
      g.restore()
    }
    if (s.mode === 'split') {
      const sx = k % 2 ? W * 0.32 : W * 0.68
      g.save(); g.beginPath(); g.rect(sx, 0, W - sx, H); g.clip()
      g.filter = 'grayscale(1) contrast(1.3)'; g.drawImage(base, 0, 0, W, H); g.filter = 'none'
      g.globalCompositeOperation = 'multiply'; g.fillStyle = ORANGE; g.fillRect(sx, 0, W - sx, H)
      g.globalCompositeOperation = 'screen'; g.fillStyle = '#3a0c00'; g.fillRect(sx, 0, W - sx, H)
      g.restore()
    }

    // --- schematic overlay ---
    const scanT = lastScan(s, t)
    const pts = selectPoints(st, s, scanT, f)
    const age = t - scanT
    const focus = pts[0] ?? { x: W / 2, y: H / 2 }
    crosshair(g, focus.x, focus.y, W, H, 200)
    connections(g, pts, 330, age)
    circles(g, pts, age)
    chain(g, focus.x, focus.y, 70, (s.i * 0.9 + 0.4), 9, 0.78, (t - s.at) / 0.6)
    const z = pts[3]
    if (z && s.mode !== 'strobe') pixelZone(g, st.tmp, Math.min(W - 240, z.x + 30), Math.min(H - 200, z.y + 20), 200, 160, 20)
    const tc = (n: number) => String(Math.floor(n)).padStart(2, '0')
    slate(g, W, H, 'SCHEMATIC / RAIN', `${tc(s.i + 1)}.${tc((t - s.at) * 30)}`, s.clip.toUpperCase(), s.mode === 'split' ? ORANGE : BLUE)
    if (k >= 0 && since < 0.1) label(g, `HIT ${s.hits[k]!.kind.toUpperCase()}`, W - 56, H - 86, 13, 'rgba(255,255,255,0.7)', 'right')
  },
})
