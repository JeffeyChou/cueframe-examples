// "The last persimmon": Dou wants the one persimmon left on the tree, jumps and misses, sulks, and the wind
// drops it on its head. Three shots in one scene: the background is one plate painted once, and each framing
// is a camera over it, so a cut never changes the paint; Dou and the props are drawn over it every frame (a
// transparent painting on the layer above). Timing follows storyboard.json's reads.
import { scene } from '@cueframe/core'
import { painting, plate, type Painting, type Plate } from '@brushframe/cueframe'
import type { BrushFrame } from '@brushframe/core'
import { clamp01, inCubic, inOutCubic, lerp, outCubic, seg } from '@cueframe/recipes/motion.js'
import { envelope, snappy } from '../../../kits/acting.js'
import { PAL, dou, emotions, type DouOptions, type Key, type P } from '../lib/dou.js'
import { BONK, CATCH, CLOSE, DROP, DUR, JOY, JUMP, REALISE, SEEN, SULK, TURN, U, WALK, WANT, WIND, X, walkK, walkPhase } from '../timing.js'
import { FRUIT, FRUIT_R, GROUND_Y, PLATE, STEM, background, camera, iris, leaves, persimmon, toScreen, type Camera } from '../lib/world.js'

export const SHOTS: { id: string; at: number; cam: Camera }[] = [
  { id: 's1', at: 0, cam: { cx: 960, cy: 540, zoom: 1 } },
  { id: 's2', at: 2.7, cam: { cx: 1000, cy: 690, zoom: 1.7 } },
  { id: 's3', at: 8.8, cam: { cx: 1000, cy: 690, zoom: 1.7 } },
]
const MOOD: Key[] = [
  [0, 'neutral'],
  [2.82, 'curious', { lookY: -1 }],
  [SEEN, 'surprised', { lookY: -1 }],
  [WANT, 'excited', { lookY: -0.8 }],
  [4.6, 'determined', { lookY: -1 }],
  [SULK, 'sad', { lookY: 0.4 }],
  [BONK, 'dizzy'],
  [REALISE, 'surprised', { lookY: 0.9, lookX: 0 }],
  [JOY, 'joy'],
]

/** Height of the jump in u (negative is up): a hang at the top, closed form. */
function jumpY(t: number) {
  if (t <= JUMP.at || t >= JUMP.land) return 0
  const k = (t - JUMP.at) / (JUMP.land - JUMP.at)
  return -JUMP.h * Math.sin(Math.PI * k) ** 0.7
}

function douAt(t: number, bf: number): DouOptions {
  const mood = emotions(t, MOOD)
  const o: DouOptions = { x: X, y: GROUND_Y, u: U, boil: bf, key: 'dou', ...mood }
  // walk in, in side view; turn through the 3/4 view to the front
  if (t < WALK.b) {
    o.x = lerp(WALK.from, X, walkK(t))
    o.view = 'side'
    o.walk = walkPhase(t)
    o.dy = -0.35 * Math.abs(Math.sin(o.walk))
    o.aL = o.aR = -0.7 + 0.3 * Math.sin(o.walk)
  } else if (t < TURN + 0.1) o.view = 'q'
  // crouch, jump with an arm up, squash on landing
  const crouch = seg(t, JUMP.at - 0.55, JUMP.at)
  const dy = jumpY(t)
  if (t >= JUMP.at - 0.6 && t < JUMP.at) { o.sq = 0.22 * outCubic(crouch); o.aL = o.aR = -1.2 }
  if (t >= JUMP.at && t < JUMP.land) {
    const k = (t - JUMP.at) / (JUMP.land - JUMP.at)
    o.dy = dy
    o.sq = -0.2 * Math.abs(Math.cos(Math.PI * k)) - 0.04
    o.aR = 1.38; o.aL = 0.7
    o.lookY = -1
  }
  const land = envelope(t, JUMP.land, { in: 0.04, out: 0.5 }, snappy)
  if (t >= JUMP.land) o.sq = (o.sq ?? 0) + 0.24 * land
  // the bonk: a flinch down, then the catch with both arms
  const bonk = envelope(t, BONK, { in: 0.05, out: 0.45 }, snappy)
  if (t >= BONK) o.sq = (o.sq ?? 0) + 0.3 * bonk
  if (t >= CATCH) { o.aL = o.aR = -0.75; o.hold = (b, u) => persimmon(b, 0, -2.1 * u, { key: 'fruit', bf, r: FRUIT_R * 0.95 }) }
  // the sprout follows through: it leans against the vertical speed and springs on landings
  const v = (jumpY(t + 0.02) - jumpY(t - 0.02)) / 0.04
  o.sprout = clamp01(Math.abs(v) / 40) * Math.sign(v) * 0.35 + 0.45 * land * Math.sin((t - JUMP.land) * 16) + 0.4 * bonk * Math.sin((t - BONK) * 18)
  return o
}

/** The persimmon's place: hanging (with sway and the wind's wobble), falling, bouncing off the head. */
function fruitAt(t: number): { p: P; rot: number; stem: P | null } | null {
  if (t >= CATCH) return null
  const wobble = 0.28 * clamp01((t - WIND - 0.5) / 0.6) * Math.sin((t - WIND) * 17)
  const near = 0.12 * envelope(t, JUMP.at + 0.5, { in: 0.1, out: 1.2 }, { settle: { cycles: 3, decay: 2 } })
  if (t < DROP) {
    const rot = 0.04 * Math.sin(t * 1.3) + near + wobble
    return { p: [STEM[0] + Math.sin(rot) * (FRUIT[1] - STEM[1]), STEM[1] + Math.cos(rot) * (FRUIT[1] - STEM[1])], rot, stem: STEM }
  }
  const headY = GROUND_Y - 1.1 * U - 7 * U / 1.06 - FRUIT_R
  if (t < BONK) {
    const k = (t - DROP) / (BONK - DROP)
    return { p: [FRUIT[0], lerp(FRUIT[1], headY, k * k)], rot: k * 0.8, stem: null }
  }
  const k = (t - BONK) / (CATCH - BONK)
  const held = GROUND_Y - 2.1 * U
  return { p: [FRUIT[0] + 4 * k, lerp(headY, held, k) - 120 * 4 * k * (1 - k)], rot: 0.8 + k * 5.5, stem: null }
}

export const short = scene({
  id: 'short',
  dur: DUR,
  mount(ctx) {
    // the plate first: its layer goes under the painting's. Density 1.9 covers the closest framing (the push to 1.88).
    const bg = plate(ctx, { ...PLATE, density: 1.9, seed: 'orchard', paper: '#F3EBDC' }, background)
    const p = painting(ctx, { seed: 'persimmon', paper: null })
    const shut = document.createElement('div')
    Object.assign(shut.style, { position: 'absolute', inset: '0', background: PAL.ink, display: 'none' })
    ctx.root.append(shut)
    return { bg, p, shut, w: ctx.stage.w, h: ctx.stage.h }
  },
  async prepare(_f, s) {
    await Promise.all([s.bg.ready(), s.p.ready()])
  },
  render(f, s) {
    const p: Painting = s.p
    const t = f.t
    const shot = [...SHOTS].reverse().find((x) => t >= x.at)!
    // s3 carries on from s2's framing and pushes in slowly on Dou through the fall and the catch
    const push = inOutCubic(seg(t, WIND, CLOSE.a))
    const cam = shot.id === 's3' ? { cx: shot.cam.cx, cy: lerp(shot.cam.cy, 728, push), zoom: lerp(shot.cam.zoom, 1.88, push) } : shot.cam
    const bf = Math.floor(t * 12)
    const sw = 1.7 / Math.sqrt(cam.zoom)
    ;(s.bg as Plate).draw(f, { x: cam.cx, y: cam.cy, zoom: cam.zoom })
    const b: BrushFrame = p.frame(f)
    b.push()
    camera(b, cam, s.w, s.h)
    if (t > 7.6) leaves(b, t, WIND - 0.6, { n: 9, bf, key: 'leaf', sw })
    const fr = fruitAt(t)
    if (fr) persimmon(b, fr.p[0], fr.p[1], { rot: fr.rot, stem: fr.stem, key: 'fruit', bf, sw })
    const d = douAt(t, bf)
    dou(b, { ...d, sw })
    b.pop()
    p.render()
    // review points for `--crop-at @feet,w,h` / `@fruit`
    f.mark('feet', ...toScreen(cam, [d.x, GROUND_Y], s.w, s.h))
    if (fr) f.mark('fruit', ...toScreen(cam, fr.p, s.w, s.h))

    // iris in on the persimmon (it holds on the fruit, then opens), and out on the pair
    const [fx, fy] = toScreen(cam, FRUIT, s.w, s.h)
    if (t < 1.2) {
      const r = t < 0.35 ? 110 * outCubic(t / 0.35) : t < 0.7 ? 110 : lerp(110, 2400, inCubic(seg(t, 0.7, 1.2)))
      iris(s.shut, fx, fy, r)
    } else if (t >= CLOSE.a) {
      const [cx, cy] = toScreen(cam, [X, GROUND_Y - 4.5 * U], s.w, s.h)
      const k = seg(t, CLOSE.a, CLOSE.b)
      iris(s.shut, cx, cy, k < 0.55 ? lerp(2400, 170, outCubic(k / 0.55)) : k < 0.8 ? 170 : lerp(170, 0, inCubic((k - 0.8) / 0.2)))
    } else iris(s.shut, 0, 0, 9999)
  },
})
