// Fixed two-line bilingual caption band (EN over ZH), switching exactly on lyric times.
import { scene } from '@cueframe/core'
import { ANSI } from '../ascii-grid.js'
import { DUR, L, LINES, intensity, lineAt, sectionAt } from '../lib.js'
import { caret, flash } from '../motion.js'

const CW = 10.8, RH = 21

export default scene({
  id: 'captions',
  at: 0,
  end: DUR,
  mount(ctx) {
    const band = document.createElement('div')
    Object.assign(band.style, { position: 'absolute', left: `${8 * CW}px`, top: `${(L.caption.y + 1) * RH}px`, width: `${(L.caption.w - 12) * CW}px`, height: `${(L.caption.h - 2) * RH}px` })
    const en = document.createElement('div')
    const zh = document.createElement('div')
    Object.assign(en.style, { position: 'absolute', left: '0', top: '0px', height: `${3 * RH}px`, lineHeight: `${3 * RH}px`, whiteSpace: 'nowrap', font: '800 54px "JBM"', letterSpacing: '1px' })
    Object.assign(zh.style, { position: 'absolute', left: '0', top: `${3.05 * RH}px`, height: `${2.6 * RH}px`, lineHeight: `${2.6 * RH}px`, whiteSpace: 'nowrap', font: '700 44px "Noto"', letterSpacing: '6px' })
    const scan = document.createElement('div')
    Object.assign(scan.style, { position: 'absolute', inset: '0', background: 'repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,0.38) 2px 3px)', pointerEvents: 'none' })
    band.append(en, zh, scan)
    ctx.root.append(band)
    // one prebuilt pair of nodes per lyric; render only toggles which is visible
    const items = LINES.map((l) => {
      const accent = ANSI[sectionAt(l.t0).accent]!
      const e = document.createElement('span')
      for (const part of l.en.split(/(\b[A-Z]{2,}\b)/)) {
        if (!part) continue
        const s = document.createElement('span')
        s.textContent = part
        if (/^[A-Z]{2,}$/.test(part)) Object.assign(s.style, { color: '#05070a', background: accent, padding: '0 14px' })
        else s.style.color = ANSI[254]!
        e.append(s)
      }
      const cur = document.createElement('span')
      cur.textContent = '█'
      Object.assign(cur.style, { color: accent, marginLeft: '10px' })
      e.append(cur)
      const z = document.createElement('span')
      z.textContent = l.zh
      z.style.color = l.caps ? accent : ANSI[250]!
      en.append(e); zh.append(z)
      return { e, z, cur, l }
    })
    return { en, zh, items }
  },
  render(f, s) {
    const t = f.t
    const cur = lineAt(t)
    const G = intensity(t)
    for (const it of s.items) {
      const on = it.l === cur
      it.e.style.display = on ? 'inline' : 'none'
      it.z.style.display = on ? 'inline' : 'none'
      it.cur.style.visibility = caret(t, 2.5) ? 'visible' : 'hidden'
    }
    const r = f.rng('cap')
    const j = G > 0.45 ? r.range(-1, 1) * 14 * (G - 0.45) : 0
    const fr = (2 + 8 * G).toFixed(1)
    const pop = cur.caps ? flash(t, cur.t0, 0.15) : 0
    for (const [el, k] of [[s.en, 1], [s.zh, 0.6]] as const) {
      el.style.transform = `translateX(${(j * k).toFixed(1)}px) scale(${(1 + 0.06 * pop).toFixed(4)})`
      el.style.transformOrigin = 'left center'
      el.style.textShadow = `${fr}px 0 rgba(255,0,60,0.55), -${fr}px 0 rgba(0,240,255,0.5), 0 0 18px rgba(120,255,220,0.25)`
    }
  },
})
