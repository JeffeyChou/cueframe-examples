import { cue, scene } from '@cueframe/core'
import { C, MONO, el, popAt, put, seg, slamAt, sticker } from '../lib.js'

// Honest table: the engine is the same in both; everything else is what Gateway adds.
const ROWS: [string, boolean][] = [
  ['浏览器内核', true],
  ['每个 Agent 独立浏览器', false],
  ['Token 随时吊销', false],
  ['一条命令部署 / 接入', false],
  ['崩溃自动复活', false],
  ['PDF 直接出文字', false],
  ['内网访问拦截', false],
]
const W = [520, 200, 240]

export default scene({
  id: 'compare',
  at: cue('scene.compare.start'),
  end: cue('scene.compare.end'),
  mount(ctx) {
    ctx.root.style.background = `linear-gradient(#d7e6ff 2px, transparent 2px) 0 0 / 60px 60px, linear-gradient(90deg, #d7e6ff 2px, transparent 2px) 0 0 / 60px 60px, ${C.paper}`
    const title = sticker(ctx.root, '老实对比', { size: 80, bg: C.lit })
    const table = el(ctx.root, { width: `${W[0]! + W[1]! + W[2]!}px`, background: '#fff', border: `7px solid ${C.ink}`, borderRadius: '24px', boxShadow: `14px 14px 0 ${C.ink}`, overflow: 'hidden' })
    const hl = el(table, { left: `${W[0]! + W[1]!}px`, width: `${W[2]}px`, height: '100%', background: '#fff3a8' })
    const cell = (row: HTMLElement, i: number, html: string, css: Record<string, string> = {}) =>
      el(row, { position: 'relative', display: 'inline-block', width: `${W[i]}px`, textAlign: i ? 'center' : 'left', padding: i ? '0' : '0 0 0 34px', boxSizing: 'border-box', ...css }, html)
    const head = el(table, { position: 'relative', height: '104px', lineHeight: '104px', background: C.ink, color: '#fff', fontSize: '44px', fontWeight: '900' })
    cell(head, 0, '功能'); cell(head, 1, '原版', { color: '#bbb' }); cell(head, 2, 'Gateway', { color: C.lit, fontFamily: '"JBM"' })
    const marks: HTMLElement[][] = ROWS.map(([name, both], r) => {
      const row = el(table, { position: 'relative', height: '96px', lineHeight: '96px', fontSize: '40px', fontWeight: '700', borderTop: r ? `4px solid ${C.ink}` : 'none' })
      cell(row, 0, name)
      const mk = (i: number, ok: boolean) => el(cell(row, i, ''), { position: 'relative', display: 'inline-block', width: '64px', height: '64px', lineHeight: '58px',
        borderRadius: '50%', border: `5px solid ${C.ink}`, verticalAlign: 'middle', fontFamily: MONO, fontSize: '40px', color: '#fff', background: ok ? C.green : C.red }, ok ? '✓' : '✗')
      return [mk(1, both), mk(2, true)]
    })
    return { title, table, hl, marks }
  },
  render(f, s) {
    const t = f.t, t0 = f.cue('scene.compare.start'), orig = f.cue('cmp.orig'), fill = f.cue('cmp.fill')
    const tp = slamAt(t, t0 + 0.05, 0.25, 1.8)
    put(s.title, 540, 250, tp.s, -3, tp.o)
    const k = popAt(t, t0, 0.35)
    put(s.table, 540, 860, k.s, 0, k.o)
    s.hl.style.opacity = String(seg(t, fill - 0.1, fill + 0.2))
    s.marks.forEach(([a, b], r) => {
      const ta = r === 0 ? t0 + 0.2 : orig + 0.15 + 0.13 * (r - 1)
      const tb = r === 0 ? t0 + 0.2 : fill + 0.1 + 0.12 * (r - 1)
      for (const [e, at] of [[a!, ta], [b!, tb]] as const) {
        const p = slamAt(t, at, 0.16, 2.2)
        e.style.transform = `scale(${p.s.toFixed(3)})`
        e.style.opacity = String(p.o)
      }
    })
  },
})
