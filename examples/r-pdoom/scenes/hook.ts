import { scene } from '@cueframe/core'
import { hdr, layer2d, post, type Glyphs, type TextLayout } from '@cueframe/gfx'
import {
  C, CUT, END, HOOK, bbox, clamp01, flash, lerp, loadFonts, outCubic, outExpo, progress, rgba, seg, shake, spark,
} from '../lib.js'

const M = 96
const RIGHT = 1920 - M
const HEAVY = { wght: 900, wdth: 125 }
const [W_IM, W_UP, W_MY, W_PD] = HOOK.words as [typeof HOOK.words[0], typeof HOOK.words[0], typeof HOOK.words[0], typeof HOOK.words[0]]
const [P_SYL, DOOM_SYL] = W_PD.syl as [[number, number], [number, number]]
const DOOM = { t0: DOOM_SYL[0], t1: DOOM_SYL[1] }
const FROM = '0.02', TO = '0.15'
const ROLL = { t0: DOOM.t0 + 0.02, t1: DOOM.t0 + 0.36 }

interface Fit { lay: TextLayout; size: number; cap: number }

/** Size a word so it fits `w` wide and `cap` px of cap height. */
function fitWord(gl: Glyphs, text: string, w: number, cap: number, variation: Record<string, number>, x: number, y: number, align: 'left' | 'right' = 'left'): Fit {
  const size = Math.min(gl.fit(text, w, { variation }), cap / 0.686)
  // Align the ink, not the sidebearing, to the margin.
  const probe = bbox(gl.path(gl.layout(text, { size, variation, x: 0, y })))
  const x0 = align === 'left' ? x - probe.x0 : x - probe.x1
  return { lay: gl.layout(text, { size, variation, x: x0, y }), size, cap: size * 0.686 }
}

export default scene({
  id: 'hook',
  at: CUT,
  end: END,
  async mount(ctx) {
    const fonts = await loadFonts()
    const A = fonts.archivo
    const comp = hdr(ctx, { clear: C.ink, msaa: 0 })
    const fx = post(ctx, {
      bloom: { threshold: 1.2, knee: 0.15, strength: 0.9, radius: 0.8 },
      tone: 'shoulder',
      vignette: { amount: 0.3, inner: 0.45, outer: 1.1 },
      grain: { amount: 0.034, size: 2 },
    })
    const bone = layer2d(ctx, 'bone')
    const hot = layer2d(ctx, 'hot')

    const BASE = 936
    const im = fitWord(A, 'I’M', 1728, 690, HEAVY, M, BASE)
    const up = fitWord(A, 'UPPING', 1728, 560, { wght: 900, wdth: 112 }, M, BASE - 40)
    const my = fitWord(A, 'MY', 1728, 690, { wght: 900, wdth: 62 }, RIGHT, BASE, 'right')
    // P(DOOM): the P is set as a maths italic (slanted), the bracket spaced by eye.
    const pdV = { wght: 900, wdth: 100 }
    const pdSize = Math.min(A.fit('P(DOOM)', 1690, { variation: pdV }), 380 / 0.686)
    const br = bbox(A.path(A.layout('(', { size: pdSize, variation: pdV, x: 0, y: 0 })))
    const Y1 = M + 6 - br.y0
    const p0 = bbox(A.path(A.layout('P', { size: pdSize, variation: pdV, x: 0, y: Y1 })))
    // The slant moves the P's foot left by 0.2 * descent; start the ink on the margin.
    const pLay = A.layout('P', { size: pdSize, variation: pdV, x: M - p0.x0, y: Y1 })
    const restX = M - p0.x0 + pLay.width + pdSize * 0.075
    const openLay = A.layout('(', { size: pdSize, variation: pdV, x: restX, y: Y1 })
    const doomLay = A.layout('DOOM)', { size: pdSize, variation: pdV, x: restX + openLay.width, y: Y1 })
    // The number: odometer cells, right-aligned on the bottom margin.
    const nV = { wght: 900, wdth: 100 }
    const nSize = Math.min(A.fit('= 0.15', 1728, { variation: nV }), (1080 - M - Y1 - 70) / 0.70)
    const digitW = Math.max(...'0123456789'.split('').map((d) => A.layout(d, { size: nSize, variation: nV }).width))
    const dotW = A.layout('.', { size: nSize, variation: nV }).width
    const cells = TO.split('').map((ch) => (ch === '.' ? dotW : digitW))
    const numW = cells.reduce((a, b) => a + b, 0)
    const eqLay = A.layout('=', { size: nSize, variation: { wght: 500, wdth: 100 }, x: RIGHT - numW - nSize * 0.16, y: 1080 - M, align: 'right' })
    const kick = A.layout('I’M UPPING MY P(DOOM)', { size: 30, variation: { wght: 700, wdth: 100 }, x: M, y: 150, tracking: 1.5 })
    return { fonts, comp, fx, bone, hot, im, up, my, pLay, openLay, doomLay, pdSize, Y1, nSize, digitW, dotW, cells, numW, eqLay, kick }
  },
  render(f, s) {
    const t = f.t
    const A = s.fonts.archivo, mono = s.fonts.mono
    const doomHit = shake(t, DOOM.t0, { dur: 0.32, amp: 18, freq: 28, seed: 9 })
    const myHit = shake(t, W_MY.t0, { dur: 0.18, amp: 8, freq: 30, seed: 4 })
    const sx = doomHit.x + myHit.x, sy = doomHit.y + myHit.y
    s.comp.begin(f)

    const fly = seg(t, DOOM.t0 + 0.01, DOOM.t0 + 0.26, outExpo)
    const roll = seg(t, ROLL.t0, ROLL.t1, outCubic)

    s.bone.draw(f, (g) => {
      // Swiss grid hairlines, drawn in on the cut.
      const gk = seg(t, CUT, CUT + 0.22, outExpo)
      g.fillStyle = rgba(C.bone, 0.055)
      const col = (1920 - 2 * M) / 12
      for (let i = 0; i <= 12; i++) g.fillRect(Math.round(M + i * col), 0, 1, 1080 * gk)
      g.fillRect(0, 936, 1920 * gk, 1)
      g.fillRect(1920 * (1 - gk), M, 1920 * gk, 1)

      // Kicker: the whole line, dim until sung; leaves once the line is fully on screen.
      const kv = 1 - seg(t, P_SYL[0], P_SYL[0] + 0.08)
      if (kv > 0) {
        for (const gph of s.kick.glyphs) {
          if (gph.char === ' ') continue
          const wi = wordAt(s.kick.text, gph.i)
          const sung = t >= HOOK.words[wi]!.t0
          g.fillStyle = rgba(C.bone, (sung ? 1 : 0.32) * kv)
          g.fill(A.path2d(s.kick, gph))
        }
        g.fillStyle = rgba(C.ash, 0.85 * kv)
        g.fill(mono.path2d(mono.layout('HOOK 1/4   132 BPM', { size: 16, x: RIGHT, y: 138, align: 'right', tracking: 1.5 })))
        g.fill(mono.path2d(mono.layout('DOOM lands on bar 13, beat 1', { size: 16, x: RIGHT, y: 162, align: 'right', tracking: 0.5 })))
      }

      g.save()
      g.translate(sx, sy)
      g.fillStyle = C.bone
      // I’M
      if (t >= W_IM.t0 && t < W_UP.t0) {
        const k = seg(t, W_IM.t0, W_IM.t0 + 0.12, outExpo)
        drawScaled(g, A, s.im.lay, lerp(1.16, 1, k), M, 936)
      }
      // UPPING: letters shoot up into a rising staircase.
      if (t >= W_UP.t0 && t < W_MY.t0) {
        const lay = s.up.lay
        const drift = -70 * seg(t, W_UP.t0, W_MY.t0)
        lay.glyphs.forEach((gph, i) => {
          const a = W_UP.t0 + i * 0.026
          if (t < a) return
          const k = seg(t, a, a + 0.17, outExpo)
          const step = -i * 30
          const dy = (1 - k) * 560 + step + drift
          const sy2 = 1 + 0.55 * (1 - k)
          g.save()
          g.translate(gph.x, gph.y + dy)
          g.scale(1, sy2)
          g.translate(-gph.x, -gph.y)
          g.fill(A.path2d(lay, gph))
          g.restore()
        })
      }
      // MY: condensed, heavy, right-aligned.
      if (t >= W_MY.t0 && t < W_PD.t0) {
        const k = seg(t, W_MY.t0, W_MY.t0 + 0.09, outExpo)
        drawScaled(g, A, s.my.lay, lerp(1.25, 1, k), RIGHT, 936)
      }
      // P(DOOM)
      if (t >= P_SYL[0]) {
        const k = seg(t, P_SYL[0], P_SYL[0] + 0.1, outExpo)
        g.save()
        const sc = lerp(1.14, 1, k)
        g.translate(M, s.Y1); g.scale(sc, sc); g.translate(-M, -s.Y1)
        g.save()
        g.translate(M, s.Y1); g.transform(1, 0, -0.2, 1, 0, 0); g.translate(-M, -s.Y1)
        g.fill(A.path2d(s.pLay))
        g.restore()
        g.fill(A.path2d(s.openLay))
        g.restore()
      }
      if (t >= P_SYL[0] && t < DOOM.t0) {
        // Anticipation: the rest of the expression waits, dim, for its syllable.
        g.fillStyle = rgba(C.bone, 0.13 * seg(t, P_SYL[0], P_SYL[0] + 0.1))
        g.fill(A.path2d(s.doomLay))
        g.fillStyle = C.bone
      }
      if (t >= DOOM.t0) {
        const k = seg(t, DOOM.t0, DOOM.t0 + 0.1, outExpo)
        const x0 = s.doomLay.glyphs[0]!.x
        drawScaled(g, A, s.doomLay, lerp(1.22, 1, k), x0, s.Y1)
        // The equals sign arrives with the number.
        g.globalAlpha = seg(t, DOOM.t0 + 0.12, DOOM.t0 + 0.22)
        g.fill(A.path2d(s.eqLay))
        g.globalAlpha = 1
      }
      g.restore()

      // HUD readout (bottom-right corner) until its number leaves.
      const hudA = 1 - seg(t, DOOM.t0, DOOM.t0 + 0.05)
      const hudIn = seg(t, CUT, CUT + 0.2, outExpo)
      if (hudA > 0) {
        g.fillStyle = rgba(C.ash, 0.9 * hudA * hudIn)
        g.fill(mono.path2d(mono.layout('P(doom)', { size: 16, x: RIGHT - 104, y: 1010, align: 'right', tracking: 1 })))
        g.fillStyle = rgba(C.bone, hudA * hudIn)
        g.fill(s.fonts.monoMed.path2d(s.fonts.monoMed.layout(FROM, { size: 34, x: RIGHT, y: 1012, align: 'right' })))
      }
    })

    s.hot.draw(f, (g) => {
      // Flash carried over the cut.
      const fl = flash(t, CUT, 0.035, 0.5) + flash(t, DOOM.t0, 0.03, 0.14)
      if (fl > 0.002) { g.fillStyle = rgba(C.signal, fl); g.fillRect(0, 0, 1920, 1080) }

      // UPPING: the spark draws a rising line along the staircase, at the voice's pace.
      if (t >= W_UP.t0 && t < W_MY.t0) {
        const lay = s.up.lay
        const drift = -70 * seg(t, W_UP.t0, W_MY.t0)
        const pts = lay.glyphs.map((gph, i) => [gph.x, gph.y + 34 - i * 30 + drift] as const)
        const last = lay.glyphs.at(-1)!
        pts.push([last.x + last.advance, last.y + 34 - (lay.glyphs.length - 1) * 30 + drift])
        const p = progress(W_UP, t) * (pts.length - 1)
        g.strokeStyle = C.signal
        g.lineWidth = 3
        g.beginPath()
        g.moveTo(pts[0]![0], pts[0]![1])
        let hx = pts[0]![0], hy = pts[0]![1]
        for (let i = 1; i < pts.length; i++) {
          const k = clamp01(p - (i - 1))
          if (k <= 0) break
          // a step: flat run, then a riser
          const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!
          const run = Math.min(1, k / 0.8), rise = clamp01((k - 0.8) / 0.2)
          hx = lerp(ax, bx, run); hy = ay
          g.lineTo(hx, hy)
          if (rise > 0) { hy = lerp(ay, by, rise); g.lineTo(hx, hy) }
        }
        g.stroke()
        spark(g, f, hx, hy, { r: 8, seed: 'up' })
      }

      // The number leaves the corner, blows up and rolls to the new value.
      if (t >= DOOM.t0) {
        const fromSize = 34, k = fly
        const sc = lerp(fromSize / s.nSize, 1, k)
        const ax = RIGHT, ay = lerp(1012, 1080 - M, k)
        g.save()
        g.translate(ax + sx * k, ay + sy * k)
        g.scale(sc, sc)
        // Cells, right to left.
        let x = -s.numW
        const H = s.nSize * 0.76
        TO.split('').forEach((ch, ci) => {
          const w = s.cells[ci]!
          if (ch === '.') {
            g.fillStyle = C.signal
            g.fill(A.path2d(A.layout('.', { size: s.nSize, variation: { wght: 900, wdth: 100 }, x: x + w / 2, y: 0, align: 'center' })))
          } else {
            // A true odometer on the value in hundredths: each wheel carries from the one to its right.
            const place = 10 ** (TO.length - 1 - ci - (ci < TO.indexOf('.') ? 1 : 0))
            const v = lerp(Number(FROM) * 100, Number(TO) * 100, roll)
            const below = v % place
            const pos = Math.floor(v / place) + (place > 1 ? Math.max(0, below - (place - 1)) : below - Math.floor(below))
            const d0 = Math.floor(pos), fr = pos - d0
            g.save()
            g.beginPath(); g.rect(x - 4, -H * 1.04, w + 8, H * 1.065); g.clip()
            for (const [dd, off] of [[d0, -fr], [d0 + 1, 1 - fr]] as const) {
              if (Math.abs(off) >= 1) continue
              const txt = String(((dd % 10) + 10) % 10)
              g.fillStyle = C.signal
              g.fill(A.path2d(A.layout(txt, { size: s.nSize, variation: { wght: 900, wdth: 100 }, x: x + w / 2, y: off * H * 1.15, align: 'center' })))
            }
            g.restore()
          }
          x += w
        })
        g.restore()
        // Landing tick: a hairline under the number once it has rolled.
        const land = seg(t, ROLL.t1 - 0.04, ROLL.t1 + 0.12, outExpo)
        if (land > 0) {
          g.fillStyle = C.signal
          g.fillRect(RIGHT - s.numW * land, 1080 - M + 22, s.numW * land, 3)
        }
      }
    }, { gain: 2.0 })
    s.fx.apply(f, s.comp)
  },
})

function drawScaled(g: CanvasRenderingContext2D, A: Glyphs, lay: TextLayout, sc: number, ox: number, oy: number) {
  g.save()
  g.translate(ox, oy); g.scale(sc, sc); g.translate(-ox, -oy)
  g.fill(A.path2d(lay))
  g.restore()
}

function wordAt(text: string, i: number) {
  return text.slice(0, i).split(' ').length - 1
}

