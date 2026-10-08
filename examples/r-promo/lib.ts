import type { Frame } from '@cueframe/core'
import { clamp01, outBack, slam, pop, shake, xf } from '../../recipes/motion.js'

export * from '../../recipes/motion.js'

export const C = {
  ink: '#141414', paper: '#fffaf0', yellow: '#ffd23f', pink: '#ff4f8b', cyan: '#3ec6ff', green: '#4fdc7b',
  purple: '#7c5cff', red: '#ff3b30', orange: '#ff8a3d', mint: '#9ff0d0', lit: '#ffe14d',
}
export const AGENTS = [
  { id: 'A', color: C.pink },
  { id: 'B', color: C.cyan },
  { id: 'C', color: C.green },
] as const
export const FONT = '"Noto", sans-serif'
export const MONO = '"JBM", "Noto", monospace'

type Css = Partial<CSSStyleDeclaration> & Record<string, string>

export function el(parent: HTMLElement, css: Css = {}, html = '', tag = 'div'): HTMLElement {
  const e = document.createElement(tag)
  Object.assign(e.style, { position: 'absolute', left: '0', top: '0', fontFamily: FONT, whiteSpace: 'nowrap' }, css)
  e.innerHTML = html
  parent.append(e)
  return e
}

/** Centre `e` at (x, y) with scale, rotation and opacity. */
export function put(e: HTMLElement | SVGElement, x: number, y: number, s = 1, r = 0, o = 1) {
  e.style.transform = xf({ x, y, scale: s, rot: r })
  e.style.opacity = String(clamp01(o))
  e.style.visibility = o <= 0.001 ? 'hidden' : ''
}

/** Comic background: flat colour, halftone dots and optional sunburst. */
export function backdrop(root: HTMLElement, color: string, rays = true) {
  root.style.background = color
  root.style.overflow = 'hidden'
  const burst = el(root, {
    left: '50%', top: '42%', width: '3200px', height: '3200px',
    background: rays ? 'repeating-conic-gradient(rgba(255,255,255,.22) 0 9deg, transparent 9deg 18deg)' : 'none',
  })
  el(root, {
    width: '100%', height: '100%',
    background: 'radial-gradient(circle, rgba(20,20,20,.13) 3.2px, transparent 3.8px) 0 0 / 30px 30px',
  })
  return (f: Frame) => put(burst, 0, 0, 1, f.t * 6)
}

const MOODS = {
  happy: '<path d="M64 104q14-18 28 0M108 104q14-18 28 0" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M80 120q20 16 40 0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>',
  angry: '<path d="M62 84l30 10M138 84l-30 10" stroke="#ff5d5d" stroke-width="8" stroke-linecap="round"/><circle cx="78" cy="104" r="10" fill="#fff"/><circle cx="122" cy="104" r="10" fill="#fff"/><path d="M82 128h36" stroke="#fff" stroke-width="7" stroke-linecap="round"/>',
  shock: '<circle cx="76" cy="98" r="15" fill="#fff"/><circle cx="124" cy="98" r="15" fill="#fff"/><circle cx="76" cy="98" r="5" fill="#141414"/><circle cx="124" cy="98" r="5" fill="#141414"/><ellipse cx="100" cy="126" rx="9" ry="10" fill="#fff"/>',
  smug: '<path d="M64 98h26M110 98h26" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="82" cy="104" r="5" fill="#fff"/><circle cx="128" cy="104" r="5" fill="#fff"/><path d="M80 122q24 10 42-6" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>',
  dizzy: '<path d="M78 98m-12 0a12 12 0 1 1 12 12a7 7 0 1 1-6-7M122 98m-12 0a12 12 0 1 1 12 12a7 7 0 1 1-6-7" stroke="#fff" stroke-width="5" fill="none"/><path d="M80 126q10-8 20 0t20 0" stroke="#fff" stroke-width="6" fill="none"/>',
  dead: '<path d="M66 88l22 22M88 88l-22 22M112 88l22 22M134 88l-22 22" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M84 128h32" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
}
export type Mood = keyof typeof MOODS

export interface Pose { x: number; y: number; s?: number; r?: number; o?: number; mood?: Mood; arms?: number }

/** A cartoon robot agent. `arms` 0 = down, 1 = raised. */
export function agent(parent: HTMLElement, a: { id: string; color: string }, size = 220) {
  const box = el(parent, { width: `${size}px`, height: `${size * 1.2}px` })
  const face = Object.entries(MOODS).map(([k, v]) => `<g data-m="${k}">${v}</g>`).join('')
  box.innerHTML = `<svg viewBox="-20 0 240 240" width="100%" height="100%" style="overflow:visible">
    <g data-arm="l"><path d="M54 186L14 214" stroke="${C.ink}" stroke-width="14" stroke-linecap="round"/><circle cx="12" cy="216" r="13" fill="${a.color}" stroke="${C.ink}" stroke-width="6"/></g>
    <g data-arm="r"><path d="M146 186L186 214" stroke="${C.ink}" stroke-width="14" stroke-linecap="round"/><circle cx="188" cy="216" r="13" fill="${a.color}" stroke="${C.ink}" stroke-width="6"/></g>
    <g data-body>
    <path d="M100 42V14" stroke="${C.ink}" stroke-width="8"/><circle cx="100" cy="12" r="11" fill="${a.color}" stroke="${C.ink}" stroke-width="6"/>
    <rect x="52" y="166" width="96" height="62" rx="20" fill="${a.color}" stroke="${C.ink}" stroke-width="8"/>
    <text x="100" y="212" text-anchor="middle" font-family="JBM" font-weight="800" font-size="40" fill="${C.ink}">${a.id}</text>
    <rect x="18" y="40" width="164" height="124" rx="38" fill="${a.color}" stroke="${C.ink}" stroke-width="8"/>
    <rect x="40" y="62" width="120" height="80" rx="24" fill="${C.ink}"/>
    <circle cx="160" cy="58" r="6" fill="#fff" opacity=".7"/>
    ${face}</g></svg>`
  const moods = [...box.querySelectorAll<SVGGElement>('[data-m]')]
  const [armL, armR] = [...box.querySelectorAll<SVGGElement>('[data-arm]')]
  return (p: Pose) => {
    put(box, p.x, p.y, p.s ?? 1, p.r ?? 0, p.o ?? 1)
    const m = p.mood ?? 'happy'
    for (const g of moods) g.style.display = g.dataset.m === m ? 'inline' : 'none'
    const k = p.arms ?? 0
    armL!.setAttribute('transform', `rotate(${(k * 120).toFixed(1)} 54 186)`)
    armR!.setAttribute('transform', `rotate(${(-k * 120).toFixed(1)} 146 186)`)
  }
}

/** Comic browser window: returns the frame and its content area. */
export function browser(parent: HTMLElement, w: number, h: number, url = 'about:blank', tint = C.paper) {
  const win = el(parent, {
    width: `${w}px`, height: `${h}px`, background: '#fff', border: `7px solid ${C.ink}`, borderRadius: '26px',
    boxShadow: `14px 14px 0 ${C.ink}`, overflow: 'hidden',
  })
  const bar = el(win, {
    position: 'relative', height: '64px', background: tint, borderBottom: `6px solid ${C.ink}`, display: 'flex',
    alignItems: 'center', gap: '12px', padding: '0 20px',
  }, ['#ff5f57', '#febc2e', '#28c840'].map((c) => `<i style="width:20px;height:20px;border-radius:50%;background:${c};border:3px solid ${C.ink}"></i>`).join(''))
  const addr = el(bar, {
    position: 'relative', flex: '1', marginLeft: '10px', height: '38px', lineHeight: '36px', borderRadius: '19px',
    background: '#fff', border: `4px solid ${C.ink}`, padding: '0 18px', fontFamily: MONO, fontSize: '22px', fontWeight: '800',
    color: C.ink, overflow: 'hidden',
  }, url)
  const body = el(win, { position: 'relative', width: '100%', height: `${h - 70}px`, overflow: 'hidden' })
  return { win, bar, addr, body }
}

/** Sticker label: thick outline, hard shadow, tilt. */
export function sticker(parent: HTMLElement, html: string, o: { bg?: string; fg?: string; size?: number; pad?: string } = {}) {
  return el(parent, {
    background: o.bg ?? '#fff', color: o.fg ?? C.ink, fontSize: `${o.size ?? 64}px`, fontWeight: '900', padding: o.pad ?? '14px 34px',
    border: `7px solid ${C.ink}`, borderRadius: '22px', boxShadow: `10px 10px 0 ${C.ink}`, lineHeight: '1.2',
  }, html)
}

/** Red rubber stamp. */
export function stamp(parent: HTMLElement, text: string, color = C.red, size = 96) {
  return el(parent, {
    color, fontSize: `${size}px`, fontWeight: '900', padding: '6px 30px', border: `10px solid ${color}`, borderRadius: '18px',
    letterSpacing: '4px', background: 'rgba(255,255,255,.82)',
  }, text)
}

/** Pose helpers on cue times. */
export const popAt = (t: number, at: number, d = 0.4) => { const p = pop(t, at, d); return { s: p.scale, o: p.opacity } }
export const slamAt = (t: number, at: number, d = 0.28, from = 2.2) => { const p = slam(t, at, d, from); return { s: p.scale, o: p.opacity } }
export const jolt = (t: number, at: number, amp = 18, dur = 0.45, seed = 3) => shake(t, at, { amp, dur, seed })
/** Idle bob for characters. */
export const bob = (t: number, phase = 0, amp = 10) => Math.sin((t * 2.4 + phase) * Math.PI) * amp
/** Fly-in from an offset, with overshoot. */
export const fly = (t: number, at: number, d = 0.5) => outBack(clamp01((t - at) / d), 1.4)

/** Comic impact burst (spiky star) with a word in it. */
export function burst(parent: HTMLElement, text: string, fill = C.yellow, size = 260) {
  const pts = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2, r = i % 2 ? 0.62 : 0.98 - (i % 4) * 0.04
    return `${(50 + 50 * r * Math.cos(a)).toFixed(1)},${(50 + 50 * r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return el(parent, { width: `${size}px`, height: `${size}px` },
    `<svg viewBox="-4 -4 108 108" width="100%" height="100%"><polygon points="${pts}" fill="${fill}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>
    <text x="50" y="58" text-anchor="middle" font-family="Noto" font-weight="900" font-size="${text.length > 3 ? 19 : 26}" fill="${C.ink}" transform="rotate(-8 50 50)">${text}</text></svg>`)
}

/** Grey placeholder lines that read as "a web page". */
export function skeleton(parent: HTMLElement, w: number, rows = 4, top = 30) {
  for (let i = 0; i < rows; i++) {
    el(parent, { left: '40px', top: `${top + i * 52}px`, width: `${(w - 80) * [0.9, 0.7, 0.82, 0.55, 0.75][i % 5]!}px`, height: '26px', borderRadius: '13px', background: '#e4e0d6' })
  }
}

/** Wrap CJK runs in Noto so monospace text never falls back. */
export const cjk = (s: string) => s.replace(/[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f…]+/g, (m) => `<span style="font-family:Noto">${m}</span>`)

export const ARROW = `<svg viewBox="0 0 40 52" width="54" height="70"><path d="M4 3l32 30-14 1 8 15-7 3-8-15-11 10z" fill="currentColor" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/></svg>`
