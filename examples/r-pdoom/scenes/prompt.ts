import { scene } from '@cueframe/core'
import { fsPass, glsl, hdr, layer2d, post, type PlacedGlyph } from '@cueframe/gfx'
import {
  C, CUT, ENTER, KICKS, PROMPT, clamp01, flash, inCubic, inOutCubic, kickPulse, loadFonts, outCubic, outExpo,
  progress, returnKey, rgba, seg, shake, spark,
} from '../lib.js'

// Engraved throat: concentric ribs in depth, white-line engraving (swelling hairlines), pulled in on kicks.
const THROAT = glsl`
uniform vec2 vp;
uniform float travel, pulse, heat, K, vis, scrim;
uniform vec4 box;
uniform vec3 lineCol, glowCol;
float lineAA(float c, float fw, float wPx) {
  float d = abs(fract(c + 0.5) - 0.5) / max(fw, 1e-5);
  return clamp(0.5 * wPx - d + 0.5, 0.0, 1.0);
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;
  vec2 d = px - vp;
  float z0 = K / max(length(d), 1.0);
  float zz = min(z0, 6.0);
  vec2 bendFar = vec2(sin(6.0 * 0.21 + 0.4 * travel) * 7.0, cos(6.0 * 0.17 + 0.3 * travel) * 5.0) * 6.0;
  d -= vec2(sin(zz * 0.21 + 0.4 * travel) * 7.0, cos(zz * 0.17 + 0.3 * travel) * 5.0) * zz;
  float r = length(d);
  float a = atan(d.y, d.x);
  float wob = 1.0 + 0.045 * sin(3.0 * a + 0.6 + travel * 0.31) + 0.025 * sin(5.0 * a - 1.1 - travel * 0.23) + 0.012 * sin(11.0 * a + 2.0);
  float z = K / max(r / wob, 1.0);
  float u = z * 1.6 + travel;
  float fu = fract(u);
  // Light from above-left on the inner wall; each rib bulges toward the viewer.
  float side = 0.5 + 0.5 * cos(a + 2.2);
  float rib = smoothstep(0.0, 0.55, fu) * smoothstep(1.0, 0.7, fu);
  float shade = clamp(0.15 + 0.85 * rib * (0.35 + 0.65 * side), 0.0, 1.0);
  float fog = exp(-z * 0.15) * smoothstep(0.0, 0.5, z);
  float sp = scale;
  float fwU = fwidth(u);
  float crest = lineAA(u, fwU, 1.1 * sp) * (0.6 + 0.4 * side);
  float h = u * 7.0;
  float fwH = fwidth(h);
  float wFine = (0.25 + 1.7 * shade) * sp;
  float fine = lineAA(h, fwH, wFine);
  float dense = smoothstep(0.18, 0.45, fwH);
  fine = mix(fine, clamp(wFine * fwH, 0.0, 1.0) * 0.3, dense);
  crest *= 1.0 - 0.6 * smoothstep(0.35, 0.9, fwU);
  float a2 = a < 0.0 ? a + 6.2831853 : a;
  float fwA = min(fwidth(a), fwidth(a2)) * 38.197;
  float cross = lineAA(a * 38.197, fwA, (shade - 0.7) * 2.0 * sp) * step(0.7, shade) * (1.0 - dense) * smoothstep(0.35, 0.6, fu) * smoothstep(0.95, 0.8, fu);
  float ink = (crest * 0.9 + fine * 0.55 + cross * 0.22) * smoothstep(16.0, 8.0, z);
  vec2 q = abs(px - box.xy) - box.zw;
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float veil = mix(1.0, smoothstep(-40.0, 150.0, sd), scrim);
  vec3 c = lineCol * ink * fog * (1.0 + pulse) * mix(0.25, 1.0, veil);
  float r0 = length(px - vp - bendFar);
  float deep = exp(-r0 / 45.0) * 0.6 + exp(-r0 / 160.0) * 0.15;
  c += glowCol * heat * deep;
  fragColor = vec4(c * vis, vis);
}`

interface Tok {
  text: string; t0: number; t1: number; i0: number; n: number
  /** Reveal time of each character. */
  at: number[]
  dist: [string, number][]
  /** Times at which the distribution re-samples (syllable onsets). */
  resample: number[]
}

const DIST: Record<string, [string, number][]> = {
  'ChatGPT,': [['ChatGPT,', 0.61], ['Claude', 0.12], ['Siri', 0.04], ['Mom', 0.02]],
  please: [['please', 0.48], ['sudo', 0.17], ['kindly', 0.11], ['just', 0.06]],
  "don't": [["don't", 0.57], ['do', 0.15], ['never', 0.09], ['try to', 0.05]],
  eat: [['eat', 0.44], ['delete', 0.21], ['train on', 0.18], ['rate', 0.05]],
  me: [['me', 0.66], ['my data', 0.12], ['us', 0.07], ['the intern', 0.03]],
  alive: [['alive', 0.52], ['first', 0.18], ['gently', 0.11], ['later', 0.09]],
}
/** How sung syllables split the typed token. */
const PIECES: Record<string, string[]> = { 'ChatGPT,': ['Chat', 'G', 'P', 'T,'] }
const CPS = 0.016

const FIELD = { x0: 240, x1: 1680, y0: 604, y1: 716 }
const TEXT = { x: 288, size: 58 }
const VP = { x: 960, y: 452 }

export default scene({
  id: 'prompt',
  end: CUT,
  async mount(ctx) {
    const fonts = await loadFonts()
    const comp = hdr(ctx, { clear: C.ink, msaa: 0 })
    const throat = fsPass(ctx, THROAT, {
      uniforms: { vp: [VP.x, VP.y], travel: 0, pulse: 0, heat: 0, K: 520, vis: 1, scrim: 1, box: [960, 690, 760, 110], lineCol: [0.26, 0.245, 0.22], glowCol: [0.6, 0.07, 0.01] },
    })
    const fx = post(ctx, {
      bloom: { threshold: 1.2, knee: 0.15, strength: 0.85, radius: 0.75 },
      tone: 'shoulder',
      vignette: { amount: 0.42, inner: 0.35, outer: 1.05 },
      grain: { amount: 0.034, size: 2 },
    })
    const bone = layer2d(ctx, 'bone')
    const hot = layer2d(ctx, 'hot')

    // Tokens laid out once on a monospace line.
    let line = ''
    const toks: Tok[] = []
    for (const w of PROMPT.words) {
      if (line) line += ' '
      const i0 = line.length
      line += w.w
      const pieces = PIECES[w.w] && PIECES[w.w]!.length === w.syl.length ? PIECES[w.w]! : [w.w]
      const at: number[] = []
      pieces.forEach((p, k) => {
        const s = pieces.length > 1 ? w.syl[k]![0] : w.t0
        const e = pieces.length > 1 ? w.syl[k]![1] : w.t1
        for (let j = 0; j < p.length; j++) at.push(Math.min(e, s + j * CPS))
      })
      toks.push({ text: w.w, t0: w.t0, t1: w.t1, i0, n: w.w.length, at, dist: DIST[w.w] ?? [[w.w, 0.5]], resample: pieces.length > 1 ? w.syl.map((s) => s[0]) : [w.t0] })
    }
    const lay = fonts.monoMed.layout(line, { size: TEXT.size, x: TEXT.x, y: (FIELD.y0 + FIELD.y1) / 2 + TEXT.size * 0.36 })
    const adv = lay.glyphs[1]!.x - lay.glyphs[0]!.x
    const baseline = lay.glyphs[0]!.y
    // Character -> reveal time; spaces show with the token that follows them.
    const reveal: number[] = new Array(line.length).fill(Infinity)
    for (const t of toks) {
      t.at.forEach((a, j) => { reveal[t.i0 + j] = a })
      if (t.i0 > 0) reveal[t.i0 - 1] = t.at[0]!
    }
    const owner = (i: number) => toks.findIndex((t) => i >= t.i0 && i < t.i0 + t.n)
    return { fonts, comp, throat, fx, bone, hot, toks, lay, adv, baseline, reveal, owner, line }
  },
  render(f, s) {
    const t = f.t
    const { fonts, toks, lay, adv, baseline } = s
    const pulse = kickPulse(t, 0.11)
    // Peristalsis: the throat swallows a little on every kick, then rushes on ⏎.
    let travel = t * 0.22
    for (const [k, a] of KICKS) travel += a * 0.32 * outCubic((t - k) / 0.3)
    const rushK = seg(t, ENTER, CUT, inCubic)
    travel += rushK * 3
    const enterFlash = flash(t, ENTER, 0.09, 1)
    s.comp.begin(f)
    s.throat.draw(f, {
      travel,
      pulse: 0.3 * pulse + 1.4 * rushK + 0.6 * enterFlash,
      heat: 0.12 + 0.25 * seg(t, 0, ENTER) + 1.6 * rushK,
      K: 520 * (1 + 2.6 * rushK * rushK),
      vis: 1,
      scrim: 1 - rushK,
    })

    // The field: shakes on ⏎, then is swallowed into the throat.
    const sw = seg(t, CUT - 0.26, CUT, inCubic)
    const sc = 1 - 0.97 * sw
    const sk = shake(t, ENTER, { dur: 0.35, amp: 10, freq: 34, seed: 3 })
    const cx = (FIELD.x0 + FIELD.x1) / 2, cy = (FIELD.y0 + FIELD.y1) / 2
    const ox = (VP.x - cx) * sw + sk.x, oy = (VP.y - cy) * sw + sk.y
    const grp = (g: CanvasRenderingContext2D) => {
      g.translate(cx + ox, cy + oy)
      g.rotate((sk.rot + sw * 18) * Math.PI / 180)
      g.scale(sc, sc)
      g.translate(-cx, -cy)
    }
    const fade = 1 - seg(t, CUT - 0.06, CUT)

    // Which tokens are visible and which is being sung.
    const visible = (i: number) => s.reveal[i]! <= t + 1e-6
    let last = -1
    for (let i = 0; i < s.line.length; i++) if (visible(i)) last = i
    const lastTyped = last >= 0 ? s.reveal[last]! : -Infinity

    s.bone.draw(f, (g) => {
      g.globalAlpha = fade
      grp(g)
      // Panel and hairline.
      g.fillStyle = rgba(C.ink2, 0.9)
      g.fillRect(FIELD.x0, FIELD.y0, FIELD.x1 - FIELD.x0, FIELD.y1 - FIELD.y0)
      g.strokeStyle = rgba(C.bone, 0.34 + 0.4 * enterFlash)
      g.lineWidth = 1
      g.strokeRect(FIELD.x0 + 0.5, FIELD.y0 + 0.5, FIELD.x1 - FIELD.x0 - 1, FIELD.y1 - FIELD.y0 - 1)
      // Tick marks on the field edge: a ruler, one per character cell.
      g.fillStyle = rgba(C.bone, 0.16)
      for (let i = 0; i <= 36; i++) g.fillRect(TEXT.x + i * adv, FIELD.y1 - (i % 5 === 0 ? 10 : 5), 1, i % 5 === 0 ? 10 : 5)
      // Placeholder until the first character.
      if (last < 0) {
        g.fillStyle = rgba(C.graphite, 0.9)
        g.fill(fonts.mono.path2d(fonts.mono.layout('Message', { size: TEXT.size, x: TEXT.x, y: baseline })))
      }
      // Sung tokens settle to bone; the token being sung is drawn hot.
      const past: PlacedGlyph[] = []
      lay.glyphs.forEach((gph, i) => {
        if (!visible(i) || gph.char === ' ') return
        const k = s.owner(i)
        if (k >= 0 && t >= toks[k]!.t1) past.push(gph)
      })
      g.fillStyle = C.bone
      if (past.length) g.fill(fonts.monoMed.path2d(lay, past))
      // Sung underlines that remain as a record.
      for (const tk of toks) {
        if (t < tk.t1) continue
        const x0 = TEXT.x + tk.i0 * adv
        g.fillStyle = rgba(C.bone, 0.22)
        g.fillRect(x0, baseline + 16, tk.n * adv, 1)
      }
      // Return key.
      const kx = FIELD.x1 - 64, ky = cy
      const armed = clamp01((t - lastTyped - 0.2) / 0.2) * (t < ENTER ? 1 : 0)
      const beatOn = f.beatPhase < 0.5 ? 1 : 0.55
      if (t < ENTER) returnKey(g, kx, ky, 54, rgba(C.bone, 0.28 + 0.4 * armed * beatOn), null)
      // Labels below the field.
      const typedToks = toks.filter((x) => x.t0 <= t).length
      const chars = Math.max(0, last + 1)
      g.fillStyle = rgba(C.ash, 0.85)
      g.fill(fonts.mono.path2d(fonts.mono.layout(`tokens ${String(typedToks).padStart(2, '0')}   chars ${String(chars).padStart(2, '0')}   temperature 0.7   top_p 0.95`, { size: 17, x: FIELD.x0, y: FIELD.y1 + 38, tracking: 0.4 })))
      g.fill(fonts.mono.path2d(fonts.mono.layout('P(doom)', { size: 17, x: FIELD.x1 - 64, y: FIELD.y1 + 38, align: 'right', tracking: 0.4 })))
      g.fillStyle = rgba(C.graphite, 1)
      g.fill(fonts.mono.path2d(fonts.mono.layout('The assistant can make mistakes, including about eating you.', { size: 15, x: FIELD.x0, y: FIELD.y1 + 70, tracking: 0.3 })))
      // Small header above the field, left.
      g.fillStyle = rgba(C.ash, 0.8)
      g.fill(fonts.mono.path2d(fonts.mono.layout('user', { size: 15, x: FIELD.x0, y: FIELD.y0 - 14, tracking: 2 })))

      // Next-token distributions (bone parts).
      toks.forEach((tk, k) => drawDist(g, f, tk, k, false))
    })

    s.hot.draw(f, (g) => {
      g.globalAlpha = fade
      grp(g)
      // The token being sung.
      const live: PlacedGlyph[] = []
      lay.glyphs.forEach((gph, i) => {
        if (!visible(i) || gph.char === ' ') return
        const k = s.owner(i)
        if (k >= 0 && t < toks[k]!.t1) live.push(gph)
      })
      g.fillStyle = C.signal
      if (live.length) g.fill(fonts.monoMed.path2d(lay, live))
      // Progress hairline with the spark at its head: never ahead of the voice.
      for (const tk of toks) {
        if (t < tk.t0 || t >= tk.t1) continue
        const p = progress(tk, t)
        const x0 = TEXT.x + tk.i0 * adv, w = tk.n * adv
        g.fillStyle = C.signal
        g.fillRect(x0, baseline + 15, w * p, 2)
        spark(g, f, x0 + w * p, baseline + 16, { r: 6, a: 1 - seg(t, CUT - 0.1, CUT), seed: 'tok' })
      }
      // Caret: solid while typing, then blinking on the beat.
      if (t < ENTER) {
        const typing = t - lastTyped < 0.22
        const on = typing || f.beatPhase < 0.5
        if (on) {
          const x = TEXT.x + (last + 1) * adv + 4
          g.fillStyle = C.signal
          g.fillRect(x, baseline - TEXT.size * 0.74, Math.round(adv * 0.42), TEXT.size * 0.9)
        }
      }
      // ⏎ pressed on the downbeat.
      if (t >= ENTER) {
        const k = seg(t, ENTER, ENTER + 0.12, outExpo)
        returnKey(g, FIELD.x1 - 64, (FIELD.y0 + FIELD.y1) / 2, 54 * (0.86 + 0.14 * k), C.signal, C.signal)
      }
      // P(doom) cameo value.
      g.fillStyle = C.signal
      g.fill(fonts.monoMed.path2d(fonts.monoMed.layout('0.02', { size: 17, x: FIELD.x1, y: FIELD.y1 + 38, align: 'right', tracking: 0.4 })))
      toks.forEach((tk, k) => drawDist(g, f, tk, k, true))
    }, { gain: 1.9 })

    // Flash on ⏎.
    s.hot.draw(f, (g) => {
      const a = 0.32 * seg(t, CUT - 0.07, CUT, inCubic)
      if (a <= 0.001) return
      g.fillStyle = rgba(C.signal, a)
      g.fillRect(0, 0, f.stage.w, f.stage.h)
    }, { gain: 1.2 })
    s.fx.apply(f, s.comp)

    // ---- next-token distribution above token k
    function drawDist(g: CanvasRenderingContext2D, f: { rng: (s: string) => { range(a: number, b: number): number } }, tk: Tok, k: number, isHot: boolean) {
      const a = tk.t0
      const b = k + 1 < toks.length ? toks[k + 1]!.t0 : ENTER
      if (t < a || t >= b) return
      const open = seg(t, a, a + 0.14, outExpo)
      const close = 1 - seg(t, b - 0.1, b, inOutCubic)
      const vis = open * close
      if (vis <= 0.001) return
      const rows = tk.dist
      const RH = 30, W = 300, PAD = 12
      const H = 26 + rows.length * RH + 6
      const x0 = Math.min(FIELD.x1 - W, TEXT.x + tk.i0 * adv)
      const yb = FIELD.y0 - 34
      const y0 = yb - H * (0.35 + 0.65 * vis)
      const since = Math.max(...tk.resample.filter((r) => r <= t))
      const jitter = 1 - seg(t, since, since + 0.26)
      g.save()
      g.globalAlpha *= vis
      if (!isHot) {
        g.fillStyle = rgba(C.ink2, 0.92)
        g.fillRect(x0, y0, W, yb - y0)
        g.strokeStyle = rgba(C.graphite, 0.9)
        g.lineWidth = 1
        g.strokeRect(x0 + 0.5, y0 + 0.5, W - 1, yb - y0 - 1)
        g.fillStyle = rgba(C.graphite, 0.9)
        g.fillRect(TEXT.x + tk.i0 * adv + 10, yb, 1, FIELD.y0 - yb)
        g.fill(fonts.mono.path2d(fonts.mono.layout('P(next token)', { size: 13, x: x0 + PAD, y: y0 + 20, tracking: 1 })))
      }
      g.beginPath(); g.rect(x0, y0, W, yb - y0); g.clip()
      rows.forEach(([cand, p], r) => {
        const chosen = r === 0
        if (chosen !== isHot) return
        const ry = y0 + 26 + r * RH + 20
        const rr = f.rng(`d${k}.${r}`)
        const pj = Math.max(0.005, p * (1 + jitter * rr.range(-0.45, 0.45)))
        const grow = seg(t, a + 0.025 * r, a + 0.025 * r + 0.22, outExpo)
        // The chosen row shows only what has been typed so far.
        const label = chosen ? s.line.slice(tk.i0, tk.i0 + tk.at.filter((x) => x <= t).length) : cand
        g.fillStyle = chosen ? C.signal : rgba(C.ash, 0.9)
        g.fill(fonts.mono.path2d(fonts.mono.layout(label, { size: 19, x: x0 + PAD, y: ry })))
        g.fillStyle = chosen ? C.signal : rgba(C.graphite, 1)
        g.fillRect(x0 + 140, ry - 12, Math.max(1, pj * 150 * grow), 10)
        g.fillStyle = chosen ? C.signal : rgba(C.ash, 0.9)
        g.fill(fonts.mono.path2d(fonts.mono.layout(pj.toFixed(2), { size: 17, x: x0 + W - PAD, y: ry, align: 'right' })))
      })
      g.restore()
    }
  },
})

