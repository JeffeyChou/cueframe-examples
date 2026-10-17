// Shot 3: how much compute, on a log axis next to the rack.
import { scene } from '@cueframe/core'
import { logBars, lowerThird } from '@cueframe/recipes/annotate.js'
import plate from '../build/plates/scale/manifest.json'
import { fadeIn, shot, span } from '../lib.js'

export default scene({
  id: 'scale',
  dur: plate.frames / plate.fps,
  overlap: 0.5,
  async mount(ctx) {
    const s = await shot(ctx, 'scale', 2)
    const title = lowerThird(s.o, { title: '算力有多大？', body: 'FP8 稠密算力，单位：万亿次 / 秒（TFLOPS）', cite: { grade: 'H', source: 'NVIDIA 规格与白皮书 · GeForce 取 FP16 累加' }, size: 56, width: 820 })
    const bars = logBars(s.o, [
      { label: 'RTX 5060', sub: '游戏显卡', value: 153.6 },
      { label: 'RTX 5090', sub: '游戏旗舰', value: 838 },
      { label: 'H100 / H200', sub: '上一代数据中心 GPU', value: 1979 },
      { label: 'B300', sub: '本片的主角，单颗', value: 5000 },
      { label: 'GB300 NVL72', sub: '整柜 72 颗', value: 360000, highlight: true, text: '360,000' },
    ], { x: 120, y: 200, w: 880, min: 100, max: 1e6, row: 74, unit: 'TFLOPS · LOG' })
    return { ...s, title, bars }
  },
  render(f, s) {
    fadeIn(f, s.o.layer.parentElement!)
    s.bar.update(s.chapter, span(f, 0.3, 1.0))
    s.title.update(span(f, 0.5, 1.5))
    s.bars.update(span(f, 1.0, 5.0))
  },
})
