// 市场街 1906 as one projected reel: every frame is drawn into a stage canvas (a card, or a frame of
// the 1906 footage in the 4:3 gate), passed through `redraw` (untouched, or turning to ink in shot B)
// and printed as film (kits/film.ts): weave, flicker, dust, the iris on the clock, the burning card.
import { scene, type FrameSource } from '@cueframe/core'
import { hdr } from '@cueframe/gfx'
import { film, frameCanvas, gateRect, redraw } from '../../../kits/film.js'
import { CLOCK, K, PART, TOTAL } from '../timing.js'

type G = CanvasRenderingContext2D

const W = 1920, H = 1080
const GATE = gateRect({ w: W, h: H })
const CREAM = '#EDE6D6'
const SERIF = '"Noto Serif SC"'
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a))

type Part = 'title' | 'a' | 'b' | 'card' | 'end'
const partAt = (t: number): Part =>
  t < PART.a ? 'title' : t < PART.b ? 'a' : t < PART.card ? 'b' : t < PART.end ? 'card' : 'end'

/** Shot B pushes in on the clock, its top edge held on the gate's: the clock's screen point and the frame rect. */
function pushB(t: number) {
  const z = 1 + 0.18 * seg(t, PART.b, PART.card)
  const px = CLOCK[0] * GATE.w, py = CLOCK[1] * GATE.h
  return {
    rect: { x: GATE.x + px * (1 - z), y: GATE.y, w: GATE.w * z, h: GATE.h * z },
    clock: [GATE.x + px, GATE.y + py * z] as const,
  }
}

/** A title card of the period: black, a double rule with corner diamonds, centred cream type. */
function card(g: G, lines: readonly (readonly [text: string, font: string, y: number])[], rule?: number): void {
  const { x, y, w, h } = GATE
  g.fillStyle = '#060504'
  g.fillRect(x, y, w, h)
  g.strokeStyle = CREAM
  g.fillStyle = CREAM
  for (const [inset, lw] of [[70, 3], [84, 1.2]] as const) {
    g.lineWidth = lw
    g.strokeRect(x + inset, y + inset, w - 2 * inset, h - 2 * inset)
  }
  for (const [cx, cy] of [[x + 77, y + 77], [x + w - 77, y + 77], [x + 77, y + h - 77], [x + w - 77, y + h - 77]] as const) {
    g.beginPath()
    g.moveTo(cx, cy - 16)
    g.lineTo(cx + 16, cy)
    g.lineTo(cx, cy + 16)
    g.lineTo(cx - 16, cy)
    g.closePath()
    g.fill()
  }
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  for (const [text, font, ty] of lines) {
    g.font = font
    g.fillText(text, x + w / 2, y + ty)
  }
  if (rule !== undefined) g.fillRect(x + w / 2 - 120, y + rule, 240, 2)
}

const TITLE = [
  ['旧金山 · 市场街', `700 104px ${SERIF}`, 470],
  ['一九〇六年四月十四日', `500 50px ${SERIF}`, 640],
] as const
const FOUR_DAYS = [
  ['四天之后，', `500 64px ${SERIF}`, 430],
  ['地震，大火。', `700 112px ${SERIF}`, 640],
] as const
const CREDITS = [
  ['影像', `500 34px ${SERIF}`, 390],
  ['Miles Brothers《A Trip Down Market Street》', `400 46px ${SERIF}`, 462],
  ['美国国会图书馆藏 · 公有领域', `400 40px ${SERIF}`, 528],
  ['钢琴采样', `500 34px ${SERIF}`, 660],
  ['VSCO 2 Community Edition · CC0', `400 40px ${SERIF}`, 726],
] as const

interface State {
  comp: ReturnType<typeof hdr>
  src: ReturnType<typeof frameCanvas>
  ink: ReturnType<typeof redraw>
  print: ReturnType<typeof film>
  clip: { a: FrameSource; b: FrameSource }
}

export const reel = scene({
  id: 'reel',
  dur: TOTAL,
  async mount(ctx): Promise<State> {
    return {
      comp: hdr(ctx, { clear: [0, 0, 0] }),
      src: frameCanvas(ctx, 'reel'),
      ink: redraw(ctx, { lines: 16, threshold: 0.25, wash: 0.28, paper: '#F1E9D8' }),
      print: film(ctx, { strength: 0.65, sepia: 0.55, contrast: 0.45 }),
      clip: { a: await ctx.frames('build/plates/a', { cache: 4 }), b: await ctx.frames('build/plates/b', { cache: 4 }) },
    }
  },
  async prepare(f, s) {
    const p = partAt(f.t)
    if (p === 'a') await s.clip.a.load(s.clip.a.frameAt(f.t - PART.a))
    if (p === 'b') await s.clip.b.load(s.clip.b.frameAt(f.t - PART.b))
  },
  render(f, s) {
    const t = f.t, p = partAt(t)
    const b = pushB(t)
    s.src.draw((g) => {
      if (p === 'title') card(g, TITLE, 545)
      else if (p === 'a') s.clip.a.draw(g, s.clip.a.frameAt(t - PART.a), GATE)
      else if (p === 'b') s.clip.b.draw(g, s.clip.b.frameAt(t - PART.b), b.rect)
      else if (p === 'card') card(g, FOUR_DAYS)
      else card(g, CREDITS)
    })
    s.comp.begin(f)
    s.ink.draw(f, s.src.texture, { amount: p === 'b' ? seg(t, K.ink[0], K.ink[1]) : 0 })
    const fade =
      p === 'title' ? 1 - seg(t, 0, 0.6)
      : p === 'card' ? seg(t, K.black - 0.12, K.black)
      : p === 'end' ? Math.max(1 - seg(t, PART.end, PART.end + 0.5), seg(t, TOTAL - 0.8, TOTAL))
      : 0
    s.print.apply(f, s.comp, {
      iris: p === 'b' ? 1 - seg(t, K.iris[0], K.iris[1]) : 1,
      irisAt: b.clock,
      burn: p === 'card' ? seg(t, K.burn[0], K.burn[1]) : 0,
      burnAt: [GATE.x + GATE.w * 0.62, GATE.y + GATE.h * 0.7],
      ...(p === 'card' ? { tint: '#E0866A', tintAmount: 0.75 } : {}),
      fade,
    })
  },
})
