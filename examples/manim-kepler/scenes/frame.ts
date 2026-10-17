import { cue, scene } from '@cueframe/core'
import { subtitles } from '@cueframe/recipes/subtitles.js'
import { CJK, el, M } from '../lib.js'

export const bg = scene({
  id: 'bg',
  at: 0,
  end: cue('total'),
  mount(ctx) {
    el(ctx.root, 'div', { position: 'absolute', inset: '0', background: M.bg })
    return {}
  },
  render() {},
})

export const subs = scene({
  id: 'subs',
  at: 0,
  end: cue('total'),
  layer: 'overlay',
  mount: (ctx) => ({ draw: subtitles(ctx, { y: 980, font: CJK, color: M.white, shadow: '0 0 12px rgba(7,11,18,.95), 0 0 4px rgba(7,11,18,.95)' }) }),
  render: (f, s) => s.draw(f),
})
