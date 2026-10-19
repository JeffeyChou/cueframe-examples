// Over every shot: the printed page (recipes/paper.ts `sheet`, multiplied) and the subtitles in a
// dark box. Until the narration is recorded the subtitles are the storyboard's lines, one per shot.
import { cue, scene } from '@cueframe/core'
import { sheet } from '@cueframe/recipes/paper.js'
import storyboard from '../storyboard.json'
import { C, H, SANS, end, start } from '../lib.js'

export const paper = scene({
  id: 'paper',
  layer: 'overlay',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    sheet(ctx, { seed: 19, grain: 0.3, mottle: 0.45 })
    return {}
  },
  render() {},
})

export const subs = scene({
  id: 'subs',
  layer: 'overlay',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    const band = document.createElement('div')
    Object.assign(band.style, {
      position: 'absolute', left: '50%', top: `${H - 120}px`, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
      background: 'rgba(30,30,30,0.66)', color: C.cream, font: `700 40px ${SANS}`, padding: '4px 16px 7px', letterSpacing: '1px',
    })
    ctx.root.append(band)
    const lines = storyboard.shots.flatMap((s) => 'narration' in s && s.narration ? [{ a: start(s.id) + 0.3, b: end(s.id) - 0.2, text: s.narration }] : [])
    return { band, lines }
  },
  render(f, st) {
    const l = st.lines.find((x) => f.t >= x.a && f.t < x.b)
    st.band.textContent = l?.text ?? ''
    st.band.style.display = l ? '' : 'none'
  },
})
