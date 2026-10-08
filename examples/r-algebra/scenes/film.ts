import * as THREE from 'three'
import { scene, seeded } from '@cueframe/core'
import { fsPass, glyphs, hdr, layer2d, post, type Glyphs } from '@cueframe/gfx'
import black from '../build/fonts/NotoSerifSC-Black.subset.ttf?url'
import bold from '../build/fonts/NotoSerifSC-Bold.subset.ttf?url'
import medium from '../build/fonts/NotoSerifSC-Medium.subset.ttf?url'
import cormorant from '../build/fonts/Cormorant-Italic.subset.ttf?url'
import cinzel from '../build/fonts/Cinzel-SemiBold.subset.ttf?url'
import stix from '../build/fonts/STIXTwoMath.subset.ttf?url'
import { C, DUR, FLAKE_R, T, TITLE_Y, film, flake2Rot, flakeRot, outCubic, seg, smooth, snowflake, zoom } from '../lib.js'
import { FLARE, NEBULA, PARTICLE_FS, PARTICLE_VS } from './shaders.js'

const N = 7000

interface Line { path: Path2D; y: number; w: number }
interface Sym { path: Path2D; w: number }

function line(gl: Glyphs, text: string, size: number, y: number, tracking = 0): Line {
  const lay = gl.layout(text, { size, align: 'center', x: C.x, y, tracking })
  return { path: gl.path2d(lay), y, w: lay.width }
}

/** A ring symbol at size 1em = 48px, centred on its own origin; `_x` is a subscript. */
function symbol(math: Glyphs, s: string): Sym {
  const [main, sub] = s.split('_') as [string, string | undefined]
  const m = math.layout(main, { size: 48, x: 0, y: 0 })
  const sb = sub ? math.layout(sub, { size: 30, x: m.width + 2, y: 12 }) : null
  const w = m.width + (sb ? sb.width + 2 : 0)
  const p = new Path2D()
  const shift = new DOMMatrix().translate(-w / 2, 16)
  p.addPath(math.path2d(m), shift)
  if (sb) p.addPath(math.path2d(sb), shift)
  return { path: p, w }
}

export default scene({
  id: 'film',
  dur: DUR,
  blur: { samples: 4, shutter: 0.5 },
  async mount(ctx) {
    const { w: W, h: H } = ctx.stage
    const [gBlack, gBold, gMed, gEn, gCin, gMath] = (await Promise.all([black, bold, medium, cormorant, cinzel, stix].map(glyphs))) as [Glyphs, Glyphs, Glyphs, Glyphs, Glyphs, Glyphs]
    const comp = hdr(ctx, { clear: [0, 0, 0] })
    const neb = fsPass(ctx, NEBULA)
    const flare = fsPass(ctx, FLARE, { blend: 'add' })
    const text = layer2d(ctx, 'text')
    const hot = layer2d(ctx, 'hot')
    // Build the additive composite quad now: gfx creates it lazily, and three draws uuids from Math.random.
    comp.begin(undefined as never)
    hot.draw(undefined as never, () => {}, { blend: 'add' })
    comp.end()
    const fx = post(ctx, {
      bloom: { threshold: 1.15, knee: 0.3, strength: 0.8, radius: 0.85 },
      tone: 'shoulder',
      ca: 1.4,
      vignette: { amount: 0.42, inner: 0.22, outer: 1.0 },
      grade: { contrast: 1.06, saturation: 1.04, shadows: [0.94, 0.98, 1.08], highlights: [1.06, 1.0, 0.92] },
      grain: { amount: 0.042, size: 2 },
    })

    const q = film.question
    const lines = {
      cn1: line(gBold, q.cn1, 54, 432, 3),
      en1: line(gEn, q.en1, 38, 492, 0.5),
      cn2: line(gBold, q.cn2, 92, 640, 8),
      en2: line(gEn, q.en2, 50, 712, 1),
    }
    const titleLay = gBlack.layout(film.title.cn, { size: 210, align: 'center', x: C.x, y: TITLE_Y, tracking: 64 })
    const title = gBlack.path2d(titleLay)
    const en = line(gCin, film.title.en, 40, 690, 18)
    const tag = line(gMed, film.title.tag, 32, 756, 8)
    const syms = film.symbols.map((s) => symbol(gMath, s))

    // Particle targets: snowflake (local), title (fill + edge points), scattered starts.
    const flake = snowflake(N, FLAKE_R, 'flake')
    const tOpts = { size: 210, align: 'center' as const, x: C.x, y: TITLE_Y, tracking: 64 }
    const tp = [...gBlack.points(film.title.cn, 4.2, { ...tOpts, mode: 'fill', seed: 3 }), ...gBlack.points(film.title.cn, 2.2, { ...tOpts, mode: 'edge', seed: 5 })]
    const rnd = seeded('algebra')
    for (let i = tp.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tp[i], tp[j]] = [tp[j]!, tp[i]!] }
    const start = new Float32Array(N * 2), tgt = new Float32Array(N * 2), seed = new Float32Array(N * 4)
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2, r = 620 + rnd() * 700
      start.set([C.x + Math.cos(a) * r * 1.3, C.y + Math.sin(a) * r * 0.8], i * 2)
      const p = tp[i % tp.length]!
      tgt.set([p.x + (rnd() - 0.5) * 1.5, p.y + (rnd() - 0.5) * 1.5], i * 2)
      // aSeed.x orders the fly-in from the centre out, so arms grow from the hub
      const fr = Math.hypot(flake[i * 2]!, flake[i * 2 + 1]!) / FLAKE_R
      seed.set([Math.min(1, 0.65 * fr + 0.35 * rnd()), rnd(), rnd(), rnd()], i * 4)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 2))
    geo.setAttribute('aFlake', new THREE.Float32BufferAttribute(flake, 2))
    geo.setAttribute('aTitle', new THREE.Float32BufferAttribute(tgt, 2))
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4))
    const u = {
      uT: { value: 0 }, uScale: { value: ctx.stage.scale }, uZoom: { value: 1 }, uRot: { value: 0 }, uRotB: { value: flakeRot(T.burst) },
      uRot2: { value: 0 }, uIn0: { value: T.flyIn }, uBurst: { value: T.burst }, uOut0: { value: T.reform }, uDim: { value: 0.22 },
      uHeat: { value: 1 }, uLogical: { value: new THREE.Vector2(W, H) }, uC: { value: new THREE.Vector2(C.x, C.y) },
    }
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: u, vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      depthTest: false, depthWrite: false, transparent: true,
    })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    const s3 = new THREE.Scene()
    s3.add(pts)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Gold gradient for the title, fixed in title space.
    const gold = text.g.createLinearGradient(0, TITLE_Y - 190, 0, TITLE_Y + 20)
    for (const [o, c] of [[0, '#fff3d0'], [0.3, '#f4cd78'], [0.55, '#b9832c'], [0.72, '#f0cf86'], [1, '#7a4c16']] as const) gold.addColorStop(o, c)
    return { comp, neb, flare, text, hot, fx, lines, title, en, tag, syms, mat, u, s3, cam, gold }
  },
  render(f, s) {
    const t = f.t
    const z = zoom(t)
    const warm = seg(t, T.burst, T.burst + 1.4)
    s.comp.layer.canvas.style.opacity = '1'
    s.comp.begin(f)

    // nebula
    const nebAmt = seg(t, T.neb, T.flyIn + 1.6) * (1 + 0.25 * seg(t, T.swell, T.burst)) * (1 + 0.6 * Math.exp(-Math.max(0, t - T.burst) * 2.5) * (t >= T.burst ? 1 : 0))
    const glow = 1.6 * seg(t, T.swell, T.burst, (x) => x * x) * (t < T.burst ? 1 : 0) + 2.2 * (t >= T.burst ? Math.exp(-(t - T.burst) * 3) : 0) + 0.35 * seg(t, T.reform + 0.6, DUR)
    s.neb.draw(f, { amt: nebAmt, warm, zoom: 1 + 0.6 * (z - 1), glow })

    // particles
    s.u.uT.value = t
    s.u.uZoom.value = z
    s.u.uRot.value = flakeRot(t)
    s.u.uRot2.value = flake2Rot(t)
    s.u.uHeat.value = 1.05 * (1 + 1.8 * seg(t, T.swell, T.burst, (x) => x * x))
    s.comp.three(s.s3, s.cam)

    const cam = (g: CanvasRenderingContext2D) => { g.translate(960, 540); g.scale(z, z); g.translate(-960, -540) }
    const L = s.lines
    // question block
    const qa = 1 - seg(t, T.qOut, T.qOut + 0.8)
    const rise = (a: number) => 14 * (1 - outCubic((t - a) / 1.2))
    const titleA = seg(t, T.titleOn, T.titleOn + 1.0) * (1 - seg(t, T.reform + 0.1, T.reform + 1.3))
    const ringA = seg(t, T.ring, T.ring + 1.2) * (1 - seg(t, T.reform + 0.4, T.reform + 1.4))
    const enA = seg(t, T.en, T.en + 1.0) * (1 - seg(t, T.reform + 0.3, T.reform + 1.2))
    const tagA = seg(t, T.tag, T.tag + 1.0) * (1 - seg(t, T.reform + 0.3, T.reform + 1.2))
    const sheenX = -300 + ((t - T.titleOn - 0.6) / 2.6) * 2600
    const ringPos = s.syms.map((sym, i) => {
      const th = (i / s.syms.length) * Math.PI * 2 + 0.2 * (t - T.ring) + 0.4
      const zz = Math.sin(th)
      const k = (zz + 1) / 2
      return { sym, x: C.x + Math.cos(th) * 800, y: 545 + zz * 270 - Math.cos(th) * 60, k }
    })
    const drawRing = (g: CanvasRenderingContext2D, front: boolean) => {
      for (const r of ringPos) {
        if (r.k >= 0.5 !== front) continue
        g.save()
        g.translate(r.x, r.y)
        const sc = 0.55 + 0.55 * r.k
        g.scale(sc, sc)
        g.globalAlpha = ringA * (0.18 + 0.82 * r.k ** 1.5)
        g.fillStyle = front ? '#f3e2bd' : '#c8b088'
        g.fill(r.sym.path)
        g.restore()
      }
    }

    s.text.draw(f, (g) => {
      cam(g)
      if (qa > 0) {
        g.fillStyle = '#efe9de'
        g.globalAlpha = qa * seg(t, T.q1, T.q1 + 1.1)
        g.save(); g.translate(0, rise(T.q1)); g.fill(L.cn1.path); g.restore()
        g.fillStyle = '#c9c2b6'
        g.globalAlpha = qa * seg(t, T.e1, T.e1 + 1.1)
        g.save(); g.translate(0, rise(T.e1)); g.fill(L.en1.path); g.restore()
        g.fillStyle = '#ffe7bf'
        g.globalAlpha = qa * seg(t, T.q2, T.q2 + 1.2)
        g.save(); g.translate(0, rise(T.q2)); g.fill(L.cn2.path); g.restore()
        g.fillStyle = '#e9d3ad'
        g.globalAlpha = qa * seg(t, T.e2, T.e2 + 1.2)
        g.save(); g.translate(0, rise(T.e2)); g.fill(L.en2.path); g.restore()
      }
      if (ringA > 0) drawRing(g, false)
      if (titleA > 0) {
        g.globalAlpha = titleA
        g.fillStyle = s.gold
        g.fill(s.title)
        g.save()
        g.clip(s.title)
        const sh = g.createLinearGradient(sheenX - 160, 0, sheenX + 160, 0)
        sh.addColorStop(0, 'rgba(255,248,225,0)')
        sh.addColorStop(0.5, 'rgba(255,248,225,0.85)')
        sh.addColorStop(1, 'rgba(255,248,225,0)')
        g.globalCompositeOperation = 'lighter'
        g.setTransform(g.getTransform().multiply(new DOMMatrix([1, 0, -0.45, 1, 0, 0])))
        g.fillStyle = sh
        g.fillRect(sheenX - 600, TITLE_Y - 400, 1200, 600)
        g.restore()
      }
      if (enA > 0) { g.globalAlpha = enA; g.fillStyle = '#e6d3a6'; g.save(); g.translate(0, 10 * (1 - enA)); g.fill(s.en.path); g.restore() }
      if (tagA > 0) { g.globalAlpha = tagA; g.fillStyle = '#d8c194'; g.save(); g.translate(0, 10 * (1 - tagA)); g.fill(s.tag.path); g.restore() }
      if (ringA > 0) drawRing(g, true)
    }, { gain: 1.0 })

    // hot pass: warm glow on the question, glints on the title
    s.hot.draw(f, (g) => {
      cam(g)
      const a2 = qa * seg(t, T.q2 + 0.3, T.q2 + 1.8)
      if (a2 > 0) {
        g.globalAlpha = a2 * (0.12 + 0.02 * Math.sin(t * 2.2))
        g.fillStyle = '#ffb35c'
        g.save(); g.translate(0, rise(T.q2)); g.fill(L.cn2.path); g.restore()
      }
      if (titleA > 0) {
        g.globalAlpha = titleA * 0.12
        g.fillStyle = '#ffc060'
        g.fill(s.title)
        g.save()
        g.clip(s.title)
        g.globalAlpha = titleA
        const sh = g.createLinearGradient(sheenX - 90, 0, sheenX + 90, 0)
        sh.addColorStop(0, 'rgba(255,230,180,0)')
        sh.addColorStop(0.5, 'rgba(255,230,180,1)')
        sh.addColorStop(1, 'rgba(255,230,180,0)')
        g.setTransform(g.getTransform().multiply(new DOMMatrix([1, 0, -0.45, 1, 0, 0])))
        g.fillStyle = sh
        g.fillRect(sheenX - 600, TITLE_Y - 400, 1200, 600)
        g.restore()
      }
    }, { gain: 1.6, blend: 'add' })

    // anamorphic flare sweeping across the title at the burst
    const fk = (t - T.burst + 0.15) / 1.5
    if (fk > 0 && fk < 1) {
      const x = -400 + outCubic(fk) * 2700
      const inten = Math.sin(Math.PI * fk) ** 1.5 * 1.6
      s.flare.draw(f, { pos: [((x - 960) * z + 960), (500 - 540) * z + 540], inten, warm })
    }

    const qaB = 1 - seg(t, T.qOut, T.neb)
    const swell = seg(t, T.swell, T.burst, (x) => x * x)
    const after = t >= T.burst ? Math.exp(-(t - T.burst) * 1.8) : 0
    s.fx.apply(f, s.comp, {
      exposure: 1 + 0.35 * swell * (t < T.burst ? 1 : 0) + 0.6 * after,
      bloom: { radius: 0.85 - 0.25 * qaB, strength: 0.8 - 0.35 * qaB + 1.5 * swell * (t < T.burst ? 1 : 0) + 1.6 * after + 0.25 * smooth((t - T.titleOn) / 2) },
    })
  },
})
