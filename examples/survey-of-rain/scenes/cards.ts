// Title and end cards: DOM text over the montage, so `audit` reads them as text.
import { scene } from '@cueframe/core'
import { DUR } from '../edit.js'

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const fade = (t: number, a: number, b: number, d = 0.6) => Math.min(ease((t - a) / d), ease((b - t) / d))

function card(root: HTMLElement, zh: string, en: string, note: string) {
  const el = root.appendChild(document.createElement('div'))
  Object.assign(el.style, { position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', color: '#fff' })
  const a = el.appendChild(document.createElement('div'))
  a.textContent = zh
  Object.assign(a.style, { font: '600 132px "Noto Serif SC"', letterSpacing: '0.18em', marginRight: '-0.18em' })
  const b = el.appendChild(document.createElement('div'))
  b.textContent = en
  Object.assign(b.style, { font: '400 28px "JetBrains Mono"', letterSpacing: '0.42em', marginRight: '-0.42em' })
  const c = el.appendChild(document.createElement('div'))
  c.textContent = note
  Object.assign(c.style, { font: '400 20px "JetBrains Mono"', letterSpacing: '0.2em', opacity: '0.7', marginTop: '18px' })
  return el
}

export default scene({
  id: 'cards',
  layer: 'overlay',
  at: 0,
  dur: DUR,
  mount(ctx) {
    const title = card(ctx.root, '雨的测绘', 'A SURVEY OF RAIN', '33 SPECIMENS · 59.2 S · 104.9 BPM')
    const scrim = ctx.root.appendChild(document.createElement('div'))
    Object.assign(scrim.style, { position: 'absolute', inset: '0', background: '#020814' })
    const end = card(ctx.root, '测绘完毕', 'END OF SURVEY', 'FOOTAGE & MUSIC MIXKIT · OVERLAY AFTER COMFYUI-SCHEMATIC')
    return { title, end, scrim }
  },
  render(f, s) {
    s.title.style.opacity = fade(f.t, 0.9, 6.1).toFixed(3)
    s.end.style.opacity = fade(f.t, DUR - 4.6, DUR + 1).toFixed(3)
    s.scrim.style.opacity = (0.72 * fade(f.t, DUR - 4.9, DUR + 1, 0.9)).toFixed(3)
  },
})
