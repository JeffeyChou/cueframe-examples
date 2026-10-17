// Shot 1: the rack, the stack named group by group.
import { scene } from '@cueframe/core'
import { callout, lowerThird } from '@cueframe/recipes/annotate.js'
import rack from '../build/plates/rack/manifest.json'
import { fadeIn, shot, span } from '../lib.js'

const NVIDIA = { grade: 'H', source: 'NVIDIA DGX GB300 用户手册' }

export default scene({
  id: 'rack',
  dur: rack.frames / rack.fps,
  async mount(ctx) {
    const s = await shot(ctx, 'rack', 0)
    const title = lowerThird(s.o, { title: '拆一台 GB300 NVL72', body: '72 颗 GPU · 一个机柜', size: 64 })
    const groups = [
      { id: 'power_top', title: '电源架 × 8', sub: '上 4 · 下 4 · 每个 33 kW' },
      { id: 'compute_top', title: '计算托盘 × 10', sub: 'COMPUTE TRAY' },
      { id: 'switch', title: 'NVLink 交换托盘 × 9', sub: 'NVLINK SWITCH TRAY' },
      { id: 'compute_bottom', title: '计算托盘 × 8', sub: 'COMPUTE TRAY' },
    ].map((g) => ({ ...g, c: callout(s.o, { title: g.title, sub: g.sub, cite: NVIDIA, at: { x: 0, y: 0 }, side: 'left', size: 28 }) }))
    return { ...s, title, groups }
  },
  render(f, s) {
    fadeIn(f, s.o.layer.parentElement!)
    s.bar.update(s.chapter, span(f, 0.3, 1.2))
    s.title.update(span(f, 0.5, 1.6), span(f, 3.6, 4.2))
    s.groups.forEach((g, i) => {
      const p = s.plate.track(g.id, f)
      // Labels in a column left of the rack, level with their group.
      g.c.update(p, span(f, 4.0 + i * 0.45, 5.0 + i * 0.45), 0, { x: p.x - 330, y: p.y })
    })
  },
})
