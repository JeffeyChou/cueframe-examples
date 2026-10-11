// Bilingual captions for the video: EN over ZH inside the engine's caption band, centred as one
// block, typed in fast; capitalised words are set on an accent plate. Nodes are prebuilt per line.
import { scene } from '@cueframe/core'
import { actAt, END, LINES, lineAt } from '../engine/song.ts'
import { layout } from '../engine/ui.ts'
import { strWidth } from '../engine/cells.ts'
import { CW, RH } from './screen.ts'

const EN_PX = 40, ZH_PX = 34, EN_ADV = EN_PX * 0.6, ZH_ADV = ZH_PX + 4
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`

export default scene({
  id: 'captions',
  at: 0,
  end: END,
  mount(ctx) {
    const L = layout(Math.floor(1920 / CW), Math.floor(1080 / RH))
    const C = L.cap
    const band = document.createElement('div')
    Object.assign(band.style, { position: 'absolute', left: `${(C.x + 7) * CW}px`, top: `${(C.y + 1) * RH - 6}px`, width: `${(C.w - 14) * CW}px`, height: `${(C.h - 2) * RH}px` })
    ctx.root.append(band)
    const items = LINES.map((l) => {
      const accent = css(actAt(l.t0).accent)
      const box = document.createElement('div')
      const enW = l.en.length * EN_ADV, zhW = [...l.zh].length * ZH_ADV
      const w = Math.max(enW, zhW)
      Object.assign(box.style, { position: 'absolute', left: `${Math.max(0, ((C.w - 14) * CW - w) / 2)}px`, top: '0', width: `${w + EN_ADV * 2}px`, display: 'none' })
      const en = document.createElement('div')
      Object.assign(en.style, { font: `800 ${EN_PX}px "JBM"`, lineHeight: `${EN_PX * 1.12}px`, whiteSpace: 'pre', color: '#f2f6f8' })
      for (const part of l.en.split(/(\b[A-Z][A-Z.\-']+\b)/)) {
        if (!part) continue
        const s = document.createElement('span')
        s.textContent = part
        if (/^[A-Z][A-Z.\-']+$/.test(part)) Object.assign(s.style, { color: '#05080b', background: accent, boxShadow: `0 0 18px ${accent}` })
        en.append(s)
      }
      const cur = document.createElement('span')
      cur.textContent = '█'
      Object.assign(cur.style, { color: accent, marginLeft: '8px' })
      en.append(cur)
      const zh = document.createElement('div')
      zh.textContent = l.zh
      Object.assign(zh.style, { font: `700 ${ZH_PX}px "Noto"`, letterSpacing: '4px', lineHeight: `${ZH_PX * 1.12}px`, whiteSpace: 'pre', color: l.caps ? accent : '#c8d2da', marginTop: '2px' })
      box.append(en, zh)
      band.append(box)
      return { l, box, en, zh, cur, enW: (strWidth(l.en) + 2) * EN_ADV, zhW }
    })
    return { items }
  },
  render(f, s) {
    const t = f.t
    const cur = lineAt(t)
    for (const it of s.items) {
      const on = it.l === cur
      it.box.style.display = on ? 'block' : 'none'
      if (!on) continue
      const lt = t - it.l.t0
      const ke = Math.min(1, (Math.floor(lt * 90) + 1) / Math.max(1, it.l.en.length))
      const kz = Math.min(1, (Math.floor(lt * 40) + 1) / Math.max(1, [...it.l.zh].length))
      it.en.style.clipPath = `inset(0 ${(1 - ke) * 100}% 0 0)`
      it.zh.style.clipPath = `inset(0 ${(1 - kz) * 100}% 0 0)`
      it.cur.style.visibility = ke < 1 || (t * 2.5) % 1 < 0.5 ? 'visible' : 'hidden'
      it.box.style.textShadow = '2px 0 rgba(255,0,60,0.35), -2px 0 rgba(0,240,255,0.3), 0 0 14px rgba(160,255,230,0.25)'
    }
  },
})
