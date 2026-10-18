// Background, and the chrome built from script.json by the explainer recipe.
import { cue, scene } from '@cueframe/core'
import { explainer } from '@cueframe/recipes/explainer.js'
import script from '../script.json'
import { C, css, CUES, el, MONO, SANS } from '../lib.js'

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

// Chrome from the script: chapter tags and cards, headlines with eyebrows, progress, subtitles.
export const chrome = explainer({
  script, cues: CUES,
  theme: { text: C.text, dim: C.dim, faint: C.faint, accent: C.cyan, warm: C.orange, alert: C.red, good: C.green, sans: SANS, mono: MONO },
  subtitles: { y: 972, font: 'Noto Sans SC', size: 38, color: C.text, shadow: '0 0 14px #000, 0 0 4px #000' },
})
