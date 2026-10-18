// The ten tiles fly into an exploded 3D stack (bottom layer first, a counter per layer), settle into
// alignment, get drilled through, then press into one board while the riders hop on top.
// cueframe: CSS 3D by hand. The tiles are drawn on the field scene's canvas, so the hand-off at the
// cut is matched by recomputing the same rects (no continuity key for canvas content or 3D poses),
// and every pose is a hand-composed transform string.
import { cue, scene } from '@cueframe/core'
import type { MountContext } from '@cueframe/core'
import {
  ART_H, ART_W, C, LAYERS, MONO, SANS, SPRITE_H, SPRITE_W, TILE_H, clamp01, el, inOutCubic, layerArt, lerp, outBack, outCubic,
  said, seg, sprite, start, tiles, viaPoints,
} from '../lib.js'

const SPX = 8                       // sprite canvas pixels per art pixel
const TILE_S = TILE_H / ART_W       // tile pose scale (the art is turned 90°)
const RIDER = { x: ART_W / 2 - 0.08 * ART_W, y: ART_H / 2 }   // where the field scene drew the rider

interface Pose { x: number; y: number; rx: number; rz: number; s: number; lift: number }
const tf = (p: Pose) => `translate3d(${p.x - ART_W / 2}px, ${p.y - ART_H / 2}px, 0) rotateX(${p.rx}deg) rotateZ(${p.rz}deg) translateZ(${p.lift}px) scale(${p.s})`
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rx: lerp(a.rx, b.rx, k), rz: lerp(a.rz, b.rz, k), s: lerp(a.s, b.s, k), lift: lerp(a.lift, b.lift, k),
})

export default scene({
  id: 'stack',
  at: cue('scene.k1.start'),
  end: cue('total'),
  mount(ctx: MountContext) {
    el(ctx.root, 'div', { inset: '0', background: `radial-gradient(90% 80% at 50% 45%, #141b33 0%, ${C.bg} 70%)` })
    const space = el(ctx.root, 'div', { inset: '0', perspective: '2600px', perspectiveOrigin: '960px 380px', transformStyle: 'preserve-3d' })
    const tl = tiles()
    const fly0 = said(ctx, 'k1', '十层') - 0.2
    const flyEnd = said(ctx, 'k2', '每一层', { end: true }) + 0.2
    const step = (flyEnd - fly0 - 0.8) / 9
    const layers = LAYERS.map((L, i) => {
      const d = el(space, 'div', { left: '0', top: '0', width: `${ART_W}px`, height: `${ART_H}px`, transformStyle: 'preserve-3d', transformOrigin: '50% 50%' })
      const cv = el(d, 'canvas', { left: '0', top: '0', width: `${ART_W}px`, height: `${ART_H}px`, outline: `${2 / TILE_S}px solid ${C.gold}` })
      cv.width = ART_W; cv.height = ART_H
      cv.getContext('2d')!.drawImage(layerArt(L), 0, 0)
      const sp = el(d, 'canvas', { left: '0', top: '0', width: `${SPRITE_W * SPX}px`, height: `${(SPRITE_H + 1) * SPX}px`, imageRendering: 'pixelated', transformOrigin: '50% 100%' })
      sp.width = SPRITE_W * SPX; sp.height = (SPRITE_H + 1) * SPX
      sp.dataset.cfAudit = 'allow-motion'          // the riders bob on purpose
      sprite(sp.getContext('2d')!, (SPRITE_W * SPX) / 2, (SPRITE_H * SPX) / 2, SPX, L.hat, 0)
      const r = tl[i]!
      const tile: Pose = { x: r.x + r.w / 2, y: r.y + r.h / 2, rx: 0, rz: 90, s: TILE_S, lift: 0 }
      const rnd = Math.sin(i * 12.9898 + 4.1) * 43758.5453
      const jx = ((rnd - Math.floor(rnd)) - 0.5) * 90, jy = (((rnd * 7) % 1 + 1) % 1 - 0.5) * 70
      const label = el(ctx.root, 'div', { left: `${r.x + 10}px`, top: `${r.y + r.h + 6}px`, font: `600 22px ${MONO}`, color: C.text, letterSpacing: '0.04em' }, L.name)
      label.dataset.cfAudit = 'allow-brief'        // the tile labels leave as their layer flies off
      return { d, cv, sp, tile, jx, jy, jr: (i % 2 ? 1 : -1) * (2 + (i % 3)), fly: fly0 + (9 - i) * step, label }
    })
    // Vias: thin columns drilled through the whole stack at shared positions.
    const vias = viaPoints(26).map((p) => ({ p, d: el(space, 'div', { left: '0', top: '0', width: '8px', height: '1px', background: 'linear-gradient(#fff6c8, #ffd25a)', boxShadow: '0 0 10px #ffd25a', transformOrigin: '0 0' }) }))
    const hud = el(ctx.root, 'div', { left: '72px', top: '944px', display: 'flex', alignItems: 'baseline', gap: '14px', padding: '10px 18px', background: '#0e1428cc', border: '1px solid #2b3557', borderRadius: '6px', font: `600 24px ${MONO}`, color: C.text })
    const sw = el(hud, 'span', { position: 'relative', width: '18px', height: '18px', display: 'inline-block' })
    hud.dataset.cfAudit = 'allow-brief'              // the counter ticks through the layers as they land
    const nm = el(hud, 'span', { position: 'relative' })
    const ct = el(hud, 'span', { position: 'relative', fontSize: '40px', fontWeight: '700' })
    const bubble = el(ctx.root, 'div', { left: '1180px', top: '150px', padding: '18px 28px 14px', background: '#f6f3ea', color: '#141824', borderRadius: '10px', font: `700 54px ${SANS}`, boxShadow: '0 8px 30px #0008', transformOrigin: '10% 100%' }, '十层，布完了')
    el(bubble, 'div', { position: 'relative', font: `500 22px ${SANS}`, color: '#59607a', textAlign: 'right', marginTop: '4px' }, 'F.Cu → B.Cu · 十层')
    return {
      layers, vias, hud, sw, nm, ct, bubble,
      align: said(ctx, 'k2', '对齐'),
      drill: said(ctx, 'k2', '打孔'),
      scan: said(ctx, 'k2', '互不'),
      press: said(ctx, 'k3', '十层'),
      done: said(ctx, 'k3', '布完'),
      k1: start('k1'),
    }
  },
  render(f, s) {
    const t = f.t
    const press = seg(t, s.press, s.press + 0.8, inOutCubic)
    const gap = lerp(56, 7, press)
    const turn = seg(t, s.press, s.done + 1.2, inOutCubic)
    const center = { x: 960, y: lerp(470, 500, press) }
    const rx = lerp(56, 46, turn), rz = lerp(-32, -18, turn)
    const align = seg(t, s.align, s.align + 0.6, (x) => outBack(x, 1.6))
    let landed = 0
    s.layers.forEach((L, i) => {
      const k = seg(t, L.fly, L.fly + 0.8, inOutCubic)
      if (t >= L.fly + 0.8) landed = Math.max(landed, 10 - i)
      const off = 1 - align
      const stackPose: Pose = {
        x: center.x + L.jx * off, y: center.y + L.jy * off, rx, rz: rz + L.jr * off, s: 0.92, lift: (4.5 - i) * gap,
      }
      // A little arc on the way up, so layers do not slide through each other.
      const p = mixPose(L.tile, stackPose, k)
      p.lift += Math.sin(k * Math.PI) * 220
      L.d.style.transform = tf(p)
      // The current layer flashes when the stack is scanned ("互不打架").
      const scan = clamp01(1 - Math.abs((t - s.scan) * 6 - (9 - i)) / 1.5)
      L.cv.style.filter = scan > 0 ? `brightness(${1 + scan * 0.9})` : 'none'
      // Landed layers turn to glass so riders and vias below show through; pressed, the board is solid.
      L.cv.style.opacity = String(lerp(1, 0.62, seg(t, L.fly + 0.6, L.fly + 1.0)) + 0.38 * press)
      L.cv.style.outlineColor = `rgba(201,165,74,${(1 - k).toFixed(3)})`
      L.label.style.opacity = String(1 - seg(t, L.fly - 0.1, L.fly + 0.2))
      // Riders: billboards standing on their layer; on "布完" they hop onto the top layer.
      const hop = seg(t, s.done - 0.3 + i * 0.05, s.done + 0.35 + i * 0.05, outCubic)
      const up = ((i * gap) / p.s) * hop + Math.sin(hop * Math.PI) * 60 / p.s
      const scr = lerp(5, 6, k)                           // screen px per sprite pixel
      const q = scr / (SPX * p.s)
      const bob = t < L.fly && Math.sin(t * 9) <= 0 ? 5 / p.s : 0
      const spread = (i - 4.5) * 70 * hop
      L.sp.style.transform = `translate3d(${RIDER.x - (SPRITE_W * SPX) / 2 + spread}px, ${RIDER.y - (SPRITE_H + 1) * SPX + (SPRITE_H * SPX) / 2 + bob}px, ${up}px) rotateZ(${-p.rz}deg) rotateX(${-p.rx}deg) scale(${q})`
    })
    // Vias grow down through the stack once it is aligned.
    const top = 4.5 * gap + 36, depth = 9 * gap + 72        // pins stand proud of the top and bottom
    s.vias.forEach((v, j) => {
      const k = seg(t, s.drill + j * 0.02, s.drill + 0.35 + j * 0.02, outCubic)
      v.d.style.opacity = k > 0 ? String(1 - 0.5 * press) : '0'
      v.d.style.height = `${Math.max(1, (depth * k) / 0.92)}px`
      v.d.style.transform = `translate3d(${center.x}px, ${center.y}px, 0) rotateX(${rx}deg) rotateZ(${rz}deg) translateZ(${top}px) scale(0.92) translate(${v.p.x - ART_W / 2 - 4}px, ${v.p.y - ART_H / 2}px) rotateX(-90deg)`
    })
    const n = Math.max(1, landed)
    const cur = LAYERS[10 - n]!
    s.hud.style.opacity = String(seg(t, s.layers[9]!.fly + 0.6, s.layers[9]!.fly + 0.9))
    s.sw.style.background = cur.color
    s.nm.textContent = cur.name
    s.ct.textContent = `${n}/10`
    const b = seg(t, s.done, s.done + 0.45, (x) => outBack(x, 2))
    s.bubble.style.opacity = String(clamp01(b * 3))
    s.bubble.style.transform = `scale(${0.6 + 0.4 * b})`
  },
})
