// Background, chrome (chapter tag, progress line, headline per narration line) and subtitles.
import { cue, scene } from '@cueframe/core'
import { subtitles } from '@cueframe/recipes/subtitles.js'
import script from '../script.json'
import { C, css, CUES, el, MONO, rich, SANS, seg, start } from '../lib.js'

const EYEBROW: Record<string, string> = { c: 'ABSTRACTION', h: 'HARDWARE DESCRIPTION', r: 'REGISTER TRANSFER LEVEL', d: 'SOFTWARE ≠ HARDWARE' }

export const bg = scene({
  id: 'bg',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    css(ctx)
    el(ctx.root, 'div', { inset: '0', background: `radial-gradient(120% 90% at 60% 45%, #0d161c 0%, ${C.bg} 70%)` })
    const g = ctx.canvas('grid')
    g.strokeStyle = 'rgba(56,214,232,0.05)'
    g.lineWidth = 1
    for (let x = 0; x <= 1920; x += 48) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 1080); g.stroke() }
    for (let y = 0; y <= 1080; y += 48) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(1920, y + 0.5); g.stroke() }
    el(ctx.root, 'div', { inset: '0', background: 'radial-gradient(80% 70% at 50% 50%, transparent 55%, #000a 100%)' })
    return {}
  },
  render() {},
})

export const chrome = scene({
  id: 'chrome',
  at: 0,
  end: cue('total'),
  layer: 'overlay',
  mount(ctx) {
    const root = ctx.root
    const bar = el(root, 'div', { left: '0', top: '0', height: '3px', background: C.cyan, boxShadow: `0 0 12px ${C.cyan}` })
    const tag = el(root, 'div', { left: '72px', top: '40px', display: 'flex', gap: '14px', alignItems: 'center', font: `500 20px ${SANS}`, color: C.dim })
    el(tag, 'span', { position: 'static', background: C.cyan, color: '#001218', font: `700 18px ${MONO}`, padding: '2px 8px', borderRadius: '3px' }, '02')
    el(tag, 'span', { position: 'static' }, '没法一个个画，就"写"出来')
    const ep = el(root, 'div', { right: '72px', top: '42px', font: `500 18px ${MONO}`, color: C.dim, letterSpacing: '.2em' }, 'CUEFRAME · EP.02')
    tag.dataset.cfAudit = ep.dataset.cfAudit = 'chrome'
    const eyebrow = el(root, 'div', { left: '110px', top: '128px' })
    eyebrow.className = 'chip-eyebrow'
    // Headline changes: a line whose title differs from the previous line's.
    const changes: { at: number; title: string; eyebrow: string }[] = []
    for (const l of script.lines) {
      if (changes.at(-1)?.title === l.title) continue
      changes.push({ at: start(l.id), title: l.title, eyebrow: EYEBROW[l.id[0]!]! })
    }
    const heads = changes.map((c) => {
      const h = el(root, 'div', { left: '110px', top: '152px', font: `700 54px ${SANS}`, color: C.text, letterSpacing: '.02em', whiteSpace: 'nowrap' })
      rich(h, c.title)
      return h
    })
    const draw = subtitles(ctx, { y: 972, font: 'Noto Sans SC', size: 38, color: C.text, shadow: '0 0 14px #000, 0 0 4px #000' })
    return { bar, eyebrow, heads, changes, draw, total: CUES.total! }
  },
  render(f, s) {
    s.bar.style.width = `${(1920 * Math.min(1, f.t / s.total)).toFixed(1)}px`
    let i = -1
    while (i + 1 < s.changes.length && s.changes[i + 1]!.at <= f.t + 0.2) i++
    const cur = s.changes[i]
    const prev = s.changes[i - 1]
    const k = cur ? seg(f.t, cur.at - 0.2, cur.at + 0.25) : 0
    s.heads.forEach((h, j) => {
      const o = j === i ? k : j === i - 1 ? 1 - k : 0
      h.style.opacity = String(o)
      h.style.transform = `translateY(${(j === i ? 1 - k : -k) * 18}px)`
    })
    s.eyebrow.textContent = cur?.eyebrow ?? ''
    s.eyebrow.style.opacity = String(cur ? Math.max(k, prev?.eyebrow === cur.eyebrow ? 1 : 0) : 0)
    s.draw(f)
  },
})
