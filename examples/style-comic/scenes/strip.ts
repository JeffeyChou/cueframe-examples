// The whole film is one newspaper page: it slides onto the desk, the masthead is lettered, the four
// panels ink on; the camera reads them in order (起 the clock wakes at seven, 承 it rings, 转 the
// pillow strikes, 合 it lies down on the pillow: "再睡五分钟"), pulls back to the page, ink black.
import { scene } from '@cueframe/core'
import { camPath, camSvg, frameRect, type Cam } from '@cueframe/recipes/camera.js'
import { clamp01, inCubic, inOutCubic, linear, outBack, outCubic, seg } from '@cueframe/recipes/motion.js'
import {
  COMIC, FONTS, balloon, burst, caption, inkAttrs, motionLines, newsprint, panel, plates, printed, radial, shade, shakeMarks, sfx, speedLines,
} from '../../../kits/comic.js'
import { clipUrl, el, ellipseD, rectD, stageSvg, text, type Box } from '../../../kits/svg.js'
import { alarmClock, bed, nightstand, pillow, star, tuft, window_, zed } from '../lib/props.js'
import { K, MOVES, TOTAL, WIN } from '../timing.js'

const { ink, cyan, magenta, yellow, white } = COMIC
const PAGE: Box = { x: 0, y: 0, w: 3200, h: 2200 }
const PW = 1440, PH = 810
const BOX = {
  p1: { x: 110, y: 340, w: PW, h: PH }, p2: { x: 1650, y: 340, w: PW, h: PH },
  p3: { x: 110, y: 1250, w: PW, h: PH }, p4: { x: 1650, y: 1250, w: PW, h: PH },
}
const FLOOR = 700
const lt = (t: number, w: readonly [number, number]) => Math.min(w[1], Math.max(w[0], t))
// Ringing without strobing: the body rocks once per two hops (1 Hz), the hammer swings at 2 Hz.
const rock = (s: number, deg: number) => Math.sin(Math.PI * s / 0.5) * deg
const hammer = (s: number) => Math.sin(Math.PI * s / 0.25) * 18

export const strip = scene({
  id: 'strip',
  at: 0,
  dur: TOTAL,
  blur: { samples: 8, shutter: 0.8, when: MOVES },
  mount(ctx) {
    const stage = { w: ctx.stage.w, h: ctx.stage.h }
    const svg = stageSvg(ctx, COMIC.desk)
    const world = el(svg, 'g')
    world.dataset.cfAudit = 'world'
    const page = el(world, 'g')
    newsprint(ctx, page, PAGE)

    // Masthead and footer.
    const mast = sfx(page, '周一漫报', { size: 176, fill: magenta })
    text(page, 1000, 214, '每日四格 · 第 1 期', { size: 56, font: FONTS.letter, fill: ink })
    text(page, 3090, 214, '10月27日 星期一', { size: 48, font: FONTS.letter, fill: ink, anchor: 'end' })
    el(page, 'path', { d: 'M110 292H3090', ...inkAttrs(7) })
    el(page, 'path', { d: 'M110 306H3090', ...inkAttrs(2.5) })
    text(page, 110, 2146, '第 12 版 · 漫画副刊', { size: 46, font: FONTS.letter, fill: ink })
    text(page, 3090, 2146, '定价 1 元', { size: 46, font: FONTS.letter, fill: ink, anchor: 'end' })

    const panels = { p1: panel(ctx, page, BOX.p1), p2: panel(ctx, page, BOX.p2), p3: panel(ctx, page, BOX.p3), p4: panel(ctx, page, BOX.p4) }
    const local = (k: keyof typeof BOX) => el(panels[k].g, 'g', { transform: `translate(${BOX[k].x} ${BOX[k].y})` })
    const full: Box = { x: -20, y: -20, w: PW + 40, h: PH + 40 }
    const floor = (g: Element, dots: number) => printed(ctx, g, rectD({ x: -20, y: FLOOR, w: PW + 40, h: 160 }), { fill: [{ dots: yellow, r: 7, cell: 16 }, { dots: magenta, r: dots, cell: 16 }], line: 8 })

    // 起: the bedroom at seven.
    const c1 = local('p1')
    plates(ctx, c1, rectD(full), [{ dots: cyan, r: 6, cell: 18 }], full)
    window_(ctx, c1, 190, 150, 330, 290)
    floor(c1, 3.4)
    shade(ctx, c1, rectD(full), radial(720, 380, 520, 1100, 6.5, 1.5), { box: full })
    const bed1 = bed(ctx, c1, 960, 520, FLOOR, PW + 40)
    pillow(ctx, c1).set({ x: 1100, y: 478, rot: -4 })
    tuft(c1, 1185, 452)
    c1.append(bed1.blanket)
    nightstand(ctx, c1, 600, 470, FLOOR, 290)
    const marks1 = el(c1, 'path', { d: shakeMarks(110, 120), ...inkAttrs(6) })
    const clock1 = alarmClock(ctx, c1)
    const zzz = [0, 1, 2].map(() => zed(c1, 74))
    const cap1 = caption(ctx, c1, '周一，早上 7:00', { size: 50 })

    // 承: the ring.
    const c2 = local('p2')
    const ring = { x: 760, y: 470 }
    plates(ctx, c2, rectD(full), [{ dots: yellow, r: 7.5, cell: 18 }, { dots: magenta, r: radial(ring.x, ring.y, 240, 900, 9), cell: 18 }], full)
    el(c2, 'path', { d: speedLines(full, ring.x, ring.y, 330, 64, 11), fill: ink })
    const marks2 = el(c2, 'path', { d: shakeMarks(230, 220, 4), ...inkAttrs(9), transform: `translate(${ring.x} ${ring.y})` })
    const clock2 = alarmClock(ctx, c2)
    const ding = sfx(c2, '叮铃铃铃！', { size: 156, fill: cyan })
    const ding2 = sfx(c2, '铃！', { size: 128, fill: white })

    // 转: the pillow strikes.
    const c3 = local('p3')
    const hit = { x: 840, y: 330 }
    plates(ctx, c3, rectD(full), [{ dots: cyan, r: 6, cell: 18 }], full)
    shade(ctx, c3, rectD(full), radial(900, 420, 420, 1000, 6, 1.5), { box: full })
    const flash = el(c3, 'g')
    const flashClip = clipUrl(ctx, c3, '')
    flash.setAttribute('clip-path', flashClip.url)
    el(flash, 'rect', { x: -20, y: -20, width: PW + 40, height: PH + 40, fill: white })
    plates(ctx, flash, rectD(full), [{ dots: yellow, r: 8, cell: 18 }, { dots: magenta, r: radial(hit.x, hit.y, 200, 1000, 9.5), cell: 18 }], full)
    el(flash, 'path', { d: speedLines(full, hit.x, hit.y, 360, 72, 23), fill: ink })
    floor(c3, 5)
    nightstand(ctx, c3, 820, 520, FLOOR + 40, 330)
    const clock3 = alarmClock(ctx, c3)
    const ring3 = sfx(c3, '铃铃铃…', { size: 84, fill: yellow })
    const trail = el(c3, 'path', { d: motionLines(-12, 7, 360, 150, 4), ...inkAttrs(6) })
    const pillow3 = pillow(ctx, c3)
    const boom = burst(ctx, c3, 175, { seed: 9 })
    const pa = sfx(c3, '啪！', { size: 210, fill: yellow })
    const stars3 = [0, 1, 2].map(() => star(ctx, c3, 30))

    // 合: on the pillow.
    const c4 = local('p4')
    plates(ctx, c4, rectD(full), [{ dots: cyan, r: 4.4, cell: 18 }], full)
    floor(c4, 3.4)
    shade(ctx, c4, rectD(full), radial(640, 520, 520, 1150, 4.6, 1.4), { box: full })
    nightstand(ctx, c4, 1050, 470, FLOOR, 290)
    const pillow4 = pillow(ctx, c4, 330, 120)
    const clock4 = alarmClock(ctx, c4)
    const orbit = [0, 1, 2].map(() => star(ctx, c4, 26))
    const say = balloon(c4, ['……再睡', '五分钟。'], { size: 70, tail: [-250, 150] })
    const zzz4 = [0, 1, 2].map(() => zed(c4, 62))
    const tbc = caption(ctx, c4, '—— 未完待续 ——', { size: 46 })

    const ink_ = el(svg, 'rect', { width: stage.w, height: stage.h, fill: ink })

    const fullCam = frameRect(stage, PAGE, { pad: 44 })
    const at = (b: Box, k = 1): Cam => { const c = frameRect(stage, b, { pad: 28 }); return { ...c, zoom: c.zoom * k } }
    const [m1, m2, m3, m4, m5] = MOVES as [[number, number], [number, number], [number, number], [number, number], [number, number]]
    const cam = camPath([
      { t: 0, ...fullCam },
      { t: m1[0], ...fullCam, zoom: fullCam.zoom * 1.015, ease: linear },
      { t: m1[1], ...at(BOX.p1) }, { t: m2[0], ...at(BOX.p1, 1.035), ease: linear },
      { t: m2[1], ...at(BOX.p2) }, { t: m3[0], ...at(BOX.p2, 1.035), ease: linear },
      { t: m3[1], ...at(BOX.p3) }, { t: m4[0], ...at(BOX.p3, 1.035), ease: linear },
      { t: m4[1], ...at(BOX.p4) }, { t: m5[0], ...at(BOX.p4, 1.035), ease: linear },
      { t: m5[1], ...fullCam }, { t: TOTAL, ...fullCam, zoom: fullCam.zoom * 1.02, ease: linear },
    ])
    return {
      stage, world, page, mast, panels, cam, ink: ink_,
      p1: { clock1, marks1, zzz, cap1 }, p2: { clock2, marks2, ding, ding2, ring },
      p3: { clock3, ring3, trail, pillow3, boom, pa, stars3, flashClip, hit }, p4: { clock4, pillow4, orbit, say, zzz4, tbc },
    }
  },
  render(f, st) {
    const t = f.t
    // The hit punches in once and settles (no oscillating shake: it would flash).
    const kick = t >= K.hit ? Math.exp(-(t - K.hit) * 9) : 0
    const c = st.cam(t)
    st.world.setAttribute('transform', camSvg({ ...c, zoom: c.zoom * (1 + 0.05 * kick), y: c.y - 14 * kick }, st.stage))
    // The page slides up onto the desk and settles.
    const inK = seg(t, 0, 0.7, (x) => outBack(x, 1.1))
    st.page.setAttribute('transform', `translate(0 ${((1 - inK) * 2400).toFixed(1)}) rotate(${((1 - inK) * -3).toFixed(3)} 1600 1100)`)
    st.mast.set({ x: 560, y: 186, k: seg(t, K.mast, K.mast + 0.55), rot: -2 })
    ;(['p1', 'p2', 'p3', 'p4'] as const).forEach((k, i) => st.panels[k].set(seg(t, K.inks[i]!, K.inks[i]! + 0.5)))

    // 起
    {
      const u = lt(t, WIN.p1), { clock1, marks1, zzz, cap1 } = st.p1
      const awake = u >= K.wake
      const jolt = seg(u, K.wake, K.wake + 0.25)
      const tremble = awake ? Math.sin((u - K.wake) * Math.PI * 5) * 3 : 0
      const minute = 59 + outBack(seg(u, K.seven, K.seven + 0.22), 3)
      clock1.set({ x: 745, y: 353 - 26 * Math.sin(Math.PI * jolt), sy: 1 - 0.1 * Math.sin(Math.PI * jolt), rot: tremble, eyes: awake ? 'wide' : 'asleep', minute })
      marks1.style.display = awake ? '' : 'none'
      marks1.setAttribute('transform', `translate(745 353)`)
      zzz.forEach((z, i) => {
        const p = ((u - WIN.p1[0]) / 1.8 + i / 3) % 1
        z.set({ x: 1250 + 110 * p, y: 330 - 230 * p, s: Math.max(0.001, Math.sin(Math.PI * p)) * (0.6 + 0.6 * p), rot: -10 + 20 * p })
      })
      cap1.set({ x: 28, y: 26, k: seg(u, K.caption1, K.caption1 + 0.3) })
    }
    // 承
    {
      const u = lt(t, WIN.p2), { clock2, marks2, ding, ding2, ring } = st.p2
      const on = u >= K.ring
      const ph = on ? ((u - K.ring) / 0.5) % 1 : 0
      const hop = on ? Math.sin(Math.PI * ph) : 0
      clock2.set({
        // A dotted body moving more than a dot period per half-hop flickers: small hops, small rocks.
        x: ring.x, y: ring.y - 18 * hop, s: 2.2, sy: 1 - (on ? 0.05 * (1 - hop) ** 4 : 0), sx: 1 + (on ? 0.035 * (1 - hop) ** 4 : 0),
        rot: on ? rock(u - K.ring, 3) : 0, eyes: on ? 'wide' : 'open', minute: 60, hammer: on ? hammer(u - K.ring) : 0,
      })
      marks2.style.display = on ? '' : 'none'
      ding.set({ x: 560, y: 150, rot: -6, k: seg(u, K.ring, K.ring + 0.55) })
      ding2.set({ x: 1210, y: 640, rot: 8, k: seg(u, K.ring2, K.ring2 + 0.3) })
    }
    // 转
    {
      const u = lt(t, WIN.p3), { clock3, ring3, trail, pillow3, boom, pa, stars3, flashClip, hit } = st.p3
      const struck = u >= K.hit, since = u - K.hit
      const fly = seg(u, K.throw, K.hit, inCubic)
      const rest = { x: 965, y: 403 }
      const sq = struck ? Math.exp(-since * 7) * Math.cos(since * 14) : 0
      clock3.set({
        x: rest.x + (struck ? 30 : 0), y: rest.y + (struck ? 20 : 0), s: 1.25, rot: struck ? 14 : rock(u - K.ring, 3),
        sx: 1 + 0.22 * sq, sy: 1 - 0.28 * sq, eyes: struck ? 'dizzy' : 'wide', minute: 60, hammer: struck ? 0 : hammer(u - K.ring),
      })
      ring3.set({ x: 1210, y: 140, rot: 6, k: 1, o: struck ? 0 : 1 })
      const px = -260 + (hit.x - 60 + 260) * fly - (struck ? 26 * Math.exp(-since * 9) : 0), py = 250 + (hit.y + 40 - 250) * fly - Math.sin(Math.PI * fly) * 150
      pillow3.set({ x: px, y: py, rot: -40 + 50 * fly, s: 1.05, o: u >= K.throw ? 1 : 0 })
      trail.setAttribute('transform', `translate(${(px - 40).toFixed(1)} ${py.toFixed(1)})`)
      trail.style.display = u >= K.throw && !struck ? '' : 'none'
      flashClip.path.setAttribute('d', struck ? ellipseD(hit.x, hit.y, 30 + 1900 * outCubic(clamp01(since / 0.35)), 30 + 1900 * outCubic(clamp01(since / 0.35))) : 'M0 0Z')
      boom.set({ x: hit.x - 330, y: hit.y - 120, rot: -6, k: seg(u, K.hit, K.hit + 0.3) })
      pa.set({ x: hit.x - 330, y: hit.y - 110, rot: -8, k: seg(u, K.hit + 0.03, K.hit + 0.4) })
      ;[[-300, 260, 0.2], [380, -120, 0.3], [330, 320, 0.42]].forEach(([dx, dy, d], i) => {
        const k = seg(u, K.hit + d!, K.hit + d! + 0.3)
        stars3[i]!.set({ x: hit.x + dx!, y: hit.y + dy!, rot: u * 90 + i * 40, s: Math.max(0.001, outBack(k, 2.4)), o: k > 0 ? 1 : 0 })
      })
    }
    // 合
    {
      const u = lt(t, WIN.p4), { clock4, pillow4, orbit, say, zzz4, tbc } = st.p4
      const drop = seg(u, K.drop - 0.25, K.drop, inCubic), since = u - K.drop
      const land = since > 0 ? Math.exp(-since * 8) * Math.cos(since * 14) : 0
      pillow4.set({ x: 600, y: FLOOR - 52 + (since > 0 ? 10 * Math.exp(-since * 10) : 0), sy: 1 - (since > 0 ? 0.18 * Math.exp(-since * 10) : 0) })
      const asleep = u >= K.balloon
      clock4.set({ x: 610 + 30 * (1 - drop), y: -260 + (FLOOR - 160 + 260) * drop, rot: -100 + 20 * (1 - drop), sx: 1 + 0.12 * land, sy: 1 - 0.15 * land, eyes: asleep ? 'asleep' : 'dizzy', minute: 60, o: u >= K.drop - 0.25 ? 1 : 0 })
      orbit.forEach((s, i) => {
        const a = u * 4.2 + (i * Math.PI * 2) / 3, k = since > 0 ? Math.min(seg(u, K.drop, K.drop + 0.25), 1 - seg(u, K.balloon - 0.2, K.balloon + 0.1)) : 0
        s.set({ x: 560 + Math.cos(a) * 150, y: FLOOR - 330 + Math.sin(a) * 40, rot: a * 40, s: Math.max(0.001, k), o: k > 0 ? 1 : 0 })
      })
      say.set({ x: 1010, y: 210, k: seg(u, K.balloon, K.balloon + 0.4) })
      zzz4.forEach((z, i) => {
        const t0 = K.snore + i * 0.53, p = (((u - t0) / 1.6) % 1 + 1) % 1, on = u >= t0
        z.set({ x: 420 - 90 * p, y: FLOOR - 300 - 200 * p, s: on ? Math.max(0.001, Math.sin(Math.PI * p)) * (0.6 + 0.6 * p) : 0.001, rot: 10 - 20 * p, o: on ? 1 : 0 })
      })
      tbc.set({ x: PW - tbc.w - 28, y: PH - tbc.h - 26, k: seg(u, K.tbc, K.tbc + 0.3) })
    }
    st.ink.setAttribute('opacity', seg(t, K.black, K.black + 0.6, inOutCubic).toFixed(3))
  },
})
