// Shot 2: a compute tray slides out; what is inside, then how it is cooled.
import { scene } from '@cueframe/core'
import { callout, lowerThird } from '@cueframe/recipes/annotate.js'
import tray from '../build/plates/tray/manifest.json'
import { fadeIn, shot, span } from '../lib.js'

export default scene({
  id: 'tray',
  // The plate's last frame holds for 3.5 s more (plates clamp), time to read the cooling card.
  dur: tray.frames / tray.fps + 3.5,
  overlap: 0.5,
  async mount(ctx) {
    const s = await shot(ctx, 'tray', 1)
    const intro = lowerThird(s.o, { title: '计算托盘 · 1U 高', body: '每个装 2 颗 GB300 超级芯片：4 颗 GPU + 2 颗 Grace CPU', cite: { grade: 'H', source: 'NVIDIA' }, size: 56, width: 760 })
    const cooling = lowerThird(s.o, {
      title: '液冷', body: '冷却液经快接头进出，流过每颗芯片上的铜冷板，约 90% 的热量由液体带走',
      cite: { grade: 'H', source: 'Lenovo GB300 手册' }, size: 56, width: 560, x: 1270,
    })
    const parts = [
      { id: 'gpu', title: 'B300 GPU × 4', sub: '在铜冷板下面', cite: { grade: 'H', source: 'NVIDIA DGX 手册' }, x: 560, y: 250 },
      { id: 'cpu', title: 'Grace CPU × 2', sub: '各配 480 GB LPDDR5X 内存', cite: { grade: 'H', source: 'NVIDIA' }, x: 560, y: 430 },
      { id: 'front', title: '前面板', sub: '网卡 · 8 个 E1.S 固态盘位', cite: { grade: 'H', source: 'NVIDIA DGX 手册' }, x: 560, y: 640 },
    ].map((p) => ({ ...p, c: callout(s.o, { title: p.title, sub: p.sub, cite: p.cite, at: { x: p.x, y: p.y }, side: 'left', size: 28 }) }))
    return { ...s, intro, cooling, parts }
  },
  render(f, s) {
    fadeIn(f, s.o.layer.parentElement!)
    s.bar.update(s.chapter, span(f, 0.3, 1.0))
    s.intro.update(span(f, 0.6, 1.4), span(f, 4.3, 4.8))
    s.parts.forEach((p, i) => {
      const t = s.plate.track(p.id, f)
      // A column of labels on the dark left, lines into the tray.
      p.c.update(t, span(f, 4.8 + i * 0.4, 5.8 + i * 0.4), span(f, 7.8, 8.2), { x: p.x, y: p.y })
    })
    s.cooling.update(span(f, 8.0, 8.8))
  },
})
