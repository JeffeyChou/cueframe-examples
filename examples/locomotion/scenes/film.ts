// The whole cut in one WebGL compositor: the plan picks the shot module for each frame, the shot
// draws through the look pass, and the slate sits on top. Shots own their three.js objects (mounted
// once here); the cut's glitch and the music come in `c.m`.
import { scene, type Frame } from '@cueframe/core'
import { shotAt } from '@cueframe/recipes/beatcut.js'
import { DUR, PLANS, SHOTS, T, type Kind, type Plan } from '../edit.js'
import { makeKit, type Kit } from '../lib/kit.js'
import { music, type ShotCtx, type ShotDef } from '../lib/shot.js'
import { slate, text, brackets, WIDE, GREY, INK } from '../lib/ui.js'
import { drawTrace, morph, type Poly } from '../lib/trace.js'
import { BEAT } from '../edit.js'
import { DEFS } from '../shots/index.js'

interface State { k: Kit; st: Partial<Record<Kind, unknown>> }

const planAt = (t: number): Plan => PLANS[shotAt(SHOTS, t).i]!
const def = (kind: Kind) => (DEFS[kind] ?? DEFS.placeholder!) as ShotDef<unknown>
const ctxOf = (f: Frame, s: State): ShotCtx => {
  const plan = planAt(f.t)
  return { f, k: s.k, plan, m: music(f, plan) }
}

export default scene({
  id: 'film',
  at: 0,
  dur: DUR,
  // the gallop moves a leg ~30 px a frame: without a shutter, thin legs strobe cell by cell (WCAG 2.3.1)
  blur: { samples: 6, shutter: 0.7, when: [[3.4, T.roll], [T.drop, T.machine], [T.gallop, T.finale]] },
  async mount(ctx) {
    const k = await makeKit(ctx)
    const st: State['st'] = {}
    const kinds = [...new Set(PLANS.map((p) => p.spec.kind))]
    for (const kind of kinds) st[kind] = await def(kind).mount?.(k)
    return { k, st } satisfies State
  },
  async prepare(f, s) {
    const c = ctxOf(f, s)
    const d = def(c.plan.spec.kind)
    const loads = d.loads?.(c, s.st[c.plan.spec.kind]) ?? []
    await Promise.all(loads.map(([id, n]) => s.k.clips[id]!.load(n)))
  },
  render(f, s) {
    const c = ctxOf(f, s)
    const { k, plan } = c
    const d = def(plan.spec.kind)
    const state = s.st[plan.spec.kind]
    k.comp.begin(f, '#000000')
    // the footage board must not carry pixels from earlier frames (crops sample their edges)
    k.board.g.fillStyle = '#000'
    k.board.g.fillRect(0, 0, k.board.canvas.width, k.board.canvas.height)
    d.draw(c, state)
    k.ui.draw(f, (g) => {
      d.ui?.(g, c, state)
      traceLayer(g, c, s)
      chapterLayer(g, c)
      if (plan.spec.kind !== 'card') {
        slate(g, f, {
          section: `${plan.section.title} — ${plan.section.latin}`,
          caption: caption(plan),
          shot: plan.shot.i,
          sixteenth: Math.floor((f.t / (60 / 140)) * 4) % 16,
          kick: c.m.kick.pulse,
          light: (plan.spec.kind === 'car' && plan.spec.view !== 'reveal') || plan.spec.kind === 'windtunnel',
        })
      }
    })
    k.fx.apply(f, k.comp)
  },
})

function caption(p: Plan): string {
  const s = p.spec
  const what = s.clip ? s.clip.toUpperCase() : `${s.kind.toUpperCase()}${s.view ? ' / ' + s.view.toUpperCase() : ''}`
  return `FIG. ${String(p.shot.i + 1).padStart(2, '0')} — ${what}${s.mode ? ' · ' + s.mode.toUpperCase() : ''}`
}

const ease = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }

/** The previous shot's trace at its last frame, for the morph across the cut. */
function prevTrace(c: ShotCtx, s: State): Poly[] | null {
  const prev = c.plan.prev
  if (!prev || prev.spec.trace !== c.plan.spec.trace) return null
  const d = def(prev.spec.kind)
  if (!d.trace) return null
  const span = prev.shot.end - prev.shot.at
  const m = { ...c.m, lt: span - 1 / 30, u: 1, beats: (span - 1 / 30) / BEAT }
  return d.trace({ f: c.f, k: c.k, plan: prev, m }, s.st[prev.spec.kind])
}

/** The red trace: drawn on along the animal over a beat, then carried to the car across the cut. */
function traceLayer(g: CanvasRenderingContext2D, c: ShotCtx, s: State): void {
  const { plan, m, f } = c
  if (!plan.spec.trace) return
  const d = def(plan.spec.kind)
  const cur = d.trace?.(c, s.st[plan.spec.kind])
  if (!cur || !cur.length) return
  const from = m.lt < 0.3 ? prevTrace(c, s) : null
  const lines = from ? morph(from, cur, ease(m.lt / 0.3)) : cur
  const on = from || plan.spec.trace === 'flow' ? 1 : ease((m.lt - BEAT * 0.5) / (BEAT * 1.5))
  const flow = plan.spec.trace === 'flow'
  if (flow) {
    lines.forEach((l, i) => drawTrace(g, f, [l], { on, color: i === 2 ? '#ff2a3a' : 'rgba(242,242,238,0.8)', width: i === 2 ? 2.5 : 1.3, nodes: 999, dash: f.t * 110 }))
    return
  }
  drawTrace(g, f, lines, { on, label: plan.spec.freeze && on >= 1 ? plan.section.feature : undefined })
}

/** Chapter opener: the chapter title and the borrowed feature for the first bar; the shot's fact below. */
function chapterLayer(g: CanvasRenderingContext2D, c: ShotCtx): void {
  const { plan, m, f, k } = c
  const sec = plan.section
  const light = (plan.spec.kind === 'car' && plan.spec.view !== 'reveal') || plan.spec.kind === 'windtunnel'
  if (sec.feature && plan.shot.n === 0 && m.lt < BEAT * 4) {
    const x = 120, y = 230
    const a = Math.min(1, m.lt / 0.08)
    g.globalAlpha = a
    g.fillStyle = 'rgba(0,0,0,0.55)'
    g.fillRect(x - 24, y - 52, 470, 150)
    text(g, f, sec.title, x, y, { font: WIDE, size: 30, track: 6 })
    // the feature types on one letter per sixteenth
    const n = Math.floor(m.lt / (BEAT / 4))
    const feat = sec.feature.slice(0, n)
    const r = text(g, f, `${feat}`, x, y + 44, { size: 20, color: '#ff2a3a' })
    if (feat.length === sec.feature.length) brackets(g, { x: r.x - 12, y: r.y - 6, w: r.w + 24, h: r.h + 12 }, '#ff2a3a', 1.5)
    text(g, f, sec.latin, x, y + 80, { size: 13, color: GREY })
    g.globalAlpha = 1
  }
  if (plan.spec.note) text(g, f, plan.spec.note, k.W / 2, k.H - 104, { size: 15, align: 'center', color: light ? '#141414' : INK })
}
