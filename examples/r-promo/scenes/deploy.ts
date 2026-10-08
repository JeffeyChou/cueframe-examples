import { cue, scene } from '@cueframe/core'
import { C, MONO, backdrop, cjk, caret, el, fly, lerp, popAt, put, seg, typed } from '../lib.js'

const TERMS = [
  { title: 'server', cmd: './deploy.sh', out: ['▸ 启动 gateway ……… ok', '✓ 部署完成  gw.example.com'] },
  { title: 'laptop', cmd: './join.sh gw.example.com', out: ['▸ 写入 Agent 配置 …… ok', '✓ 已接入'] },
]
const APPS = ['Claude Code', 'Codex', 'Pi']

function term(root: HTMLElement, title: string) {
  const w = el(root, { width: '940px', height: '330px', background: '#1d1b2c', border: `7px solid ${C.ink}`, borderRadius: '24px', boxShadow: `14px 14px 0 ${C.ink}`, overflow: 'hidden' })
  el(w, { position: 'relative', height: '58px', background: '#2f2c45', borderBottom: `5px solid ${C.ink}`, fontFamily: MONO, fontSize: '26px', fontWeight: '800',
    color: '#bdb8e6', lineHeight: '56px', paddingLeft: '120px' }, `${['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<i style="position:absolute;left:${22 + i * 30}px;top:19px;width:18px;height:18px;border-radius:50%;background:${c}"></i>`).join('')}${title}`)
  const lines = [0, 1, 2].map((i) => el(w, { left: '36px', top: `${92 + i * 72}px`, fontFamily: MONO, fontWeight: '800', fontSize: '36px', color: '#f4f1ff' }))
  return { w, lines }
}

// Two terminals: deploy on the server, join from a laptop, then the agent apps light up.
export default scene({
  id: 'deploy',
  at: cue('scene.deploy.start'),
  end: cue('scene.deploy.end'),
  mount(ctx) {
    const bg = backdrop(ctx.root, C.purple)
    const terms = TERMS.map((d) => term(ctx.root, d.title))
    const apps = APPS.map((a) => el(ctx.root, { background: '#fff', border: `6px solid ${C.ink}`, borderRadius: '999px', boxShadow: `8px 8px 0 ${C.ink}`,
      padding: '12px 30px 12px 18px', fontFamily: MONO, fontWeight: '800', fontSize: '40px', display: 'flex', alignItems: 'center', gap: '14px' },
      `<b style="width:52px;height:52px;border-radius:50%;background:${C.green};border:5px solid ${C.ink};text-align:center;line-height:44px;font-size:34px">✓</b>${a}`))
    const bits = Array.from({ length: 46 }, (_, i) => el(ctx.root, { width: `${14 + (i % 3) * 6}px`, height: `${26 - (i % 3) * 4}px`,
      background: [C.lit, C.pink, C.cyan, C.green, '#fff'][i % 5], border: `3px solid ${C.ink}` }))
    return { bg, terms, apps, bits }
  },
  render(f, s) {
    const t = f.t, c = (n: string) => f.cue(n)
    s.bg(f)
    const starts = [c('dep.server'), c('dep.join')]
    const oks = [[c('dep.cmd') - 0.1, c('dep.cmd') + 0.3], [c('dep.join') + 0.75, c('dep.join') + 1.0]]
    s.terms.forEach((o, i) => {
      const k = fly(t, starts[i]! - 0.35, 0.45)
      put(o.w, 540, lerp(i ? 1900 : -400, i ? 860 : 450, k), 1, i ? 1.5 : -1.5, k > 0 ? 1 : 0)
      const cmd = TERMS[i]!.cmd
      const n = typed(t, starts[i]! + 0.05, cmd.length, 26)
      const done = t >= oks[i]![1]!
      o.lines[0]!.innerHTML = `<span style="color:${C.green}">$</span> ${cmd.slice(0, n)}${n < cmd.length || (!done && caret(t, 3)) ? '<span style="color:#ffe14d">▌</span>' : ''}`
      TERMS[i]!.out.forEach((line, j) => {
        const e = o.lines[j + 1]!
        e.innerHTML = cjk(line)
        e.style.color = j ? C.green : '#bdb8e6'
        e.style.visibility = t >= oks[i]![j]! ? '' : 'hidden'
      })
    })
    const at = [c('dep.claude'), c('dep.codex'), c('dep.pi')]
    s.apps.forEach((e, i) => {
      const p = popAt(t, at[i]!, 0.4)
      put(e, [300, 760, 540][i]!, [1200, 1200, 1320][i]!, p.s, [-4, 3, -2][i]!, p.o)
    })
    const done = c('dep.done')
    s.bits.forEach((e, i) => {
      const h = ((i * 7919) % 97) / 97, g = ((i * 104729) % 89) / 89
      const u = t - done - h * 0.25
      const on = u > 0 && u < 1.6
      const x = 540 + (g - 0.5) * 1000 + Math.sin(u * 4 + i) * 30
      const y = 600 - 500 * h + 900 * u * u + 300 * u
      put(e, x, y, 1, u * 500 * (g - 0.5), on ? 1 : 0)
    })
  },
})
