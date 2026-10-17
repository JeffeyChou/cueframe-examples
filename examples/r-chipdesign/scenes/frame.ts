// Background, chrome (chapter tag, progress line, headline per narration line) and subtitles.
import { cue, scene } from '@cueframe/core'
import { subtitles } from '@cueframe/recipes/subtitles.js'
import script from '../script.json'
import { blocking, C, css, CUES, el, MONO, rich, SANS, start } from '../lib.js'

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
    // One headline per change of title: the old one leaves, then the new one arrives.
    const changes: { at: number; title: string; eyebrow: string }[] = []
    for (const l of script.lines) {
      if (changes.at(-1)?.title === l.title) continue
      changes.push({ at: start(l.id), title: l.title, eyebrow: EYEBROW[l.id[0]!]! })
    }
    const ids = changes.map((_, i) => `h${i}`)
    const b = blocking(ids)
    changes.forEach((c, i) => {
      const h = ctx.key(b.set(el(root, 'div'), { [ids[i]!]: { x: 110, y: 128, w: 1500, h: 100 }, ...(i + 1 < ids.length ? { [ids[i + 1]!]: null } : {}) }), `head-${i}`)
      el(h, 'div', { left: '0', top: '0' }, c.eyebrow).className = 'chip-eyebrow'
      rich(el(h, 'div', { left: '0', top: '24px', font: `700 54px ${SANS}`, color: C.text, letterSpacing: '.02em', whiteSpace: 'nowrap' }), c.title)
    })
    ctx.layouts(changes.map((c, i) => ({ id: ids[i]!, at: i ? c.at - 0.2 : 0, motion: { 'head-*': { dur: 0.25 }, [`head-${i}`]: { delay: 0.25 } } })), b.apply)
    const draw = subtitles(ctx, { y: 972, font: 'Noto Sans SC', size: 38, color: C.text, shadow: '0 0 14px #000, 0 0 4px #000' })
    return { bar, draw, total: CUES.total! }
  },
  render(f, s) {
    s.bar.style.width = `${(1920 * Math.min(1, f.t / s.total)).toFixed(1)}px`
    s.draw(f)
  },
})
