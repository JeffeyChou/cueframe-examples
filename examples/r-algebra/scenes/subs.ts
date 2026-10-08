import { scene } from '@cueframe/core'
import { DUR, film, win } from '../lib.js'

// Bilingual subtitles at their film times (from/to in data/film.json), as DOM text above the film layer.
export default scene({
  id: 'subs',
  at: 0,
  dur: DUR,
  mount(ctx) {
    const rows = film.subs.map((s) => {
      const box = document.createElement('div')
      Object.assign(box.style, {
        position: 'absolute', left: '0', right: '0', bottom: '92px', textAlign: 'center', color: '#f1ebe0',
        textShadow: '0 0 18px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.9)', opacity: '0',
      })
      const cn = document.createElement('div')
      Object.assign(cn.style, { fontFamily: 'SubCJK', fontWeight: '500', fontSize: '40px', letterSpacing: '0.12em', lineHeight: '1.3' })
      cn.textContent = s.cn
      const en = document.createElement('div')
      Object.assign(en.style, { fontFamily: 'SubEN', fontStyle: 'italic', fontWeight: '500', fontSize: '31px', letterSpacing: '0.02em', color: '#d9cfbf', marginTop: '6px' })
      en.textContent = s.en
      box.append(cn, en)
      ctx.root.append(box)
      return { box, from: s.from, to: s.to }
    })
    return { rows }
  },
  render(f, s) {
    for (const r of s.rows) {
      const a = win(f.t, r.from, r.to, 0.35, 0.35)
      r.box.style.opacity = String(a)
      r.box.style.transform = `translateY(${(6 * (1 - a)).toFixed(2)}px)`
    }
  },
})
