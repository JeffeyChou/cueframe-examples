import { cue, scene, type WordLine } from '@cueframe/core'
import { captionSize } from '../../../recipes/karaoke.js'
import { C, FONT, el } from '../lib.js'

// Karaoke on the script's `sub` text: each on-screen character is aligned to the spoken line text
// so it lights at its word's time. Digits map to the spoken numerals; ⭐ is drawn as an SVG star.
const NUM: Record<string, string> = { '1': '一', '3': '三' }
const PUNCT = /[\s，。！？、：；,.!?]/
const STAR = `<svg viewBox="0 0 24 24" width="0.95em" height="0.95em" style="vertical-align:-0.12em"><path d="M12 1.8l3.1 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.7 9.2l7.2-.8z" fill="currentColor" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/></svg>`

interface Row { spans: HTMLElement[]; lit: number[]; start: number; size: number }

function align(line: WordLine): Row[] {
  const at: number[] = Array.from(line.text, () => NaN)
  for (const w of line.words) for (const i of w.chars ?? []) if (isNaN(at[i]!)) at[i] = w.t0
  const say = line.text.toLowerCase()
  let j = 0
  return (line.sub ?? line.text).split('\n').map((txt) => {
    const chars = Array.from(txt)
    const lit = chars.map((ch) => {
      const k = NUM[ch] ?? ch.toLowerCase()
      if (PUNCT.test(ch)) return NaN
      const hit = say.indexOf(k, j)
      if (hit < 0 || hit - j > 6) return NaN
      j = hit + 1
      return at[hit] ?? NaN
    })
    // unmatched: punctuation lights with the previous char, symbols with the next
    for (let i = 0; i < lit.length; i++) if (isNaN(lit[i]!) && !PUNCT.test(chars[i]!)) lit[i] = lit.slice(i).find((v) => !isNaN(v)) ?? NaN
    for (let i = 0; i < lit.length; i++) if (isNaN(lit[i]!)) lit[i] = i ? lit[i - 1]! : lit.find((v) => !isNaN(v)) ?? line.start
    const spans = chars.map((ch) => {
      const s = document.createElement('span')
      s.style.position = 'relative'
      if (ch === '⭐') s.innerHTML = STAR; else s.textContent = ch
      return s
    })
    return { spans, lit, start: lit[0]!, size: captionSize(txt, 860, 74, 50) }
  })
}

export default scene({
  id: 'captions',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    const band = el(ctx.root, {
      left: '50%', top: '1500px', padding: '16px 34px 20px', background: C.ink, color: '#fff', fontWeight: '900',
      borderRadius: '28px', border: '6px solid #fff', boxShadow: `0 10px 0 rgba(20,20,20,.35)`, fontFamily: FONT, lineHeight: '1.25',
    })
    const lines = ctx.data.words().words.map((w) => w.line!).filter((v, i, a) => a.indexOf(v) === i)
    const rows = new Map(lines.map((id) => [id, align(ctx.data.words(id).line!)]))
    for (const r of rows.values()) for (const row of r) band.append(...row.spans)
    return { band, rows }
  },
  render(f, s) {
    const line = f.words({ at: f.t }).line
    const rows = line ? s.rows.get(line.id)! : []
    let cur: Row | null = null
    rows.forEach((r, k) => { if (f.t >= r.start - 0.12 && f.t < (rows[k + 1]?.start ?? line!.end + 0.7) - 0.12) cur = r })
    if (f.hold === 'cover') cur = null
    for (const r of s.rows.values()) for (const row of r) {
      row.spans.forEach((sp, i) => {
        const on = row === cur
        sp.style.display = on ? 'inline' : 'none'
        if (!on) return
        const age = f.t - row.lit[i]!
        sp.style.color = age >= 0 ? C.lit : '#fff'
        const h = age >= 0 && age < 0.16 ? -12 * Math.sin((Math.PI * age) / 0.16) : 0
        sp.style.top = `${h.toFixed(2)}px`
      })
    }
    const c = cur as Row | null
    const k = c ? Math.min(1, (f.t - (c.start - 0.12)) / 0.12) : 0
    s.band.style.fontSize = `${c?.size ?? 64}px`
    s.band.style.opacity = String(k)
    s.band.style.visibility = c ? '' : 'hidden'
    s.band.style.transform = `translate(-50%, -50%) scale(${(0.9 + 0.1 * k).toFixed(3)}) rotate(-1.5deg)`
  },
})
