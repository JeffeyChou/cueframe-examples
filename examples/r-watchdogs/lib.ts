import type { Frame } from '@cueframe/core'
import { glyphs, type Glyphs, type TextLayout } from '@cueframe/gfx'
import archivo from './data/fonts/Archivo-VF.ttf?url'
import { clamp01, hash, inOutCubic, lerp, seg } from './motion.js'

export * from './motion.js'

export const W = 1920
export const H = 1080
/** Film time → timeline time (narrative 0 = film 18.20). */
export const ft = (film: number) => Math.round((film - 18.2) * 1000) / 1000
export const sans = (): Promise<Glyphs> => glyphs(archivo)
export const MONO = 'Plex'
export const C = {
  white: '#eef3f5', ink: '#0a0d0e', grey: '#8d989d', dim: '#3c4549', cyan: '#62e4ff', teal: '#2bb3ae', lime: '#c6ea4c',
}

/** Clear a ctx.canvas (base transform = stage scale) and optionally fill it. */
export function clear(g: CanvasRenderingContext2D, f: Frame, fill?: string): void {
  const s = f.stage.scale
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  g.filter = 'none'
  g.shadowBlur = 0
  g.clearRect(0, 0, g.canvas.width, g.canvas.height)
  if (fill) { g.fillStyle = fill; g.fillRect(0, 0, g.canvas.width, g.canvas.height) }
  g.setTransform(s, 0, 0, s, 0, 0)
}

export function mono(g: CanvasRenderingContext2D, size: number, weight = 500): number {
  g.font = `${weight} ${size}px ${MONO}`
  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'
  return size * 0.6
}

/** Monospace text on a box; `y` is the baseline. Returns the box width. */
export function boxText(
  g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number,
  o: { bg?: string | CanvasGradient; fg?: string; pad?: number; weight?: number; cursor?: boolean } = {},
): number {
  const cw = mono(g, size, o.weight ?? 500)
  const pad = o.pad ?? size * 0.32
  const n = text.length + (o.cursor ? 1 : 0)
  if (n === 0) return 0
  const w = n * cw + pad * 2
  g.fillStyle = o.bg ?? C.white
  g.fillRect(x, y - size * 0.86 - pad * 0.5, w, size * 1.12 + pad)
  g.fillStyle = o.fg ?? C.ink
  g.fillText(text + (o.cursor ? '_' : ''), x + pad, y)
  return w
}

/** Fixed-pitch typed string with a caret; chars [from, to) visible. */
export const typedSlice = (t: number, at: number, text: string, cps: number) => text.slice(0, Math.min(text.length, Math.max(0, Math.floor((t - at) * cps + 1e-6))))

/** Horizontal slice glitch + RGB split on a canvas, from its own pixels. Create in mount. */
export class Glitch {
  private a: HTMLCanvasElement
  private r: HTMLCanvasElement
  private c: HTMLCanvasElement
  constructor(w: number, h: number) {
    const mk = () => Object.assign(document.createElement('canvas'), { width: w, height: h })
    this.a = mk(); this.r = mk(); this.c = mk()
  }
  apply(g: CanvasRenderingContext2D, f: Frame, amt: number, seed = 1, split = 1): void {
    if (amt <= 0.001) return
    const src = g.canvas
    const Wp = src.width
    const Hp = src.height
    const sc = Wp / W
    const ag = this.a.getContext('2d')!
    ag.globalCompositeOperation = 'copy'
    ag.drawImage(src, 0, 0)
    const rng = f.rng(seed)
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    g.clearRect(0, 0, Wp, Hp)
    let y = 0
    while (y < Hp) {
      const h = Math.max(2, Math.round(rng.range(6, 90) * sc))
      const off = rng() < 0.55 * amt ? rng.range(-1, 1) * amt * 160 * sc : 0
      g.drawImage(this.a, 0, y, Wp, h, off, y, Wp, h)
      y += h
    }
    const d = split * amt * 9 * sc
    if (d > 0.3) {
      ag.drawImage(src, 0, 0)
      for (const [cv, col] of [[this.r, '#ff0000'], [this.c, '#00ffff']] as const) {
        const x = cv.getContext('2d')!
        x.globalCompositeOperation = 'copy'
        x.drawImage(this.a, 0, 0)
        x.globalCompositeOperation = 'multiply'
        x.fillStyle = col
        x.fillRect(0, 0, Wp, Hp)
        x.globalCompositeOperation = 'destination-in'
        x.drawImage(this.a, 0, 0)
      }
      g.clearRect(0, 0, Wp, Hp)
      g.globalCompositeOperation = 'lighter'
      g.drawImage(this.r, d, 0)
      g.drawImage(this.c, -d, 0)
    }
    g.restore()
  }
}

/** Horizontal motion smear of the whole canvas (whip pans). */
export class Smear {
  private a: HTMLCanvasElement
  constructor(w: number, h: number) { this.a = Object.assign(document.createElement('canvas'), { width: w, height: h }) }
  apply(g: CanvasRenderingContext2D, dx: number, v: number, n = 10): void {
    const src = g.canvas
    const sc = src.width / W
    const ag = this.a.getContext('2d')!
    ag.globalCompositeOperation = 'copy'
    ag.drawImage(src, 0, 0)
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, src.width, src.height)
    for (let k = n; k >= 0; k--) {
      g.globalAlpha = k === 0 ? 1 : 0.35 * (1 - k / (n + 1))
      g.drawImage(this.a, (dx - (v * k) / n) * sc, 0)
    }
    g.restore()
  }
}

// 5×7 dot-matrix glyphs.
const DM: Record<string, string> = {
  A: '.###.#...##...######...##...##...#', D: '####.#...##...##...##...##...#####.', E: '######....#....####.#....#....#####',
  I: '#####..#....#....#....#....#..#####', L: '#....#....#....#....#....#....#####', O: '.###.#...##...##...##...##...#.###.',
  R: '####.#...##...#####.#.#..#..#.#...#', S: '.#####....#.....###.....#....#####.', U: '#...##...##...##...##...##...#.###.',
  V: '#...##...##...##...##...#.#.#...#..',
}
/** Lit cells of `word` as {col,row}, with `gap` blank columns between letters. */
export function dotCells(word: string, gap = 1): { c: number; r: number; L: number }[] {
  const out: { c: number; r: number; L: number }[] = []
  ;[...word].forEach((ch, L) => {
    const m = DM[ch]
    if (!m) return
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (m[r * 5 + c] === '#') out.push({ c: L * (5 + gap) + c, r, L })
  })
  return out
}

export interface MeshNode { x: number; y: number; file: boolean; ph: number }
export interface Mesh { nodes: MeshNode[]; edges: [number, number][] }
export function makeMesh(rnd: () => number, n: number, x0: number, y0: number, x1: number, y1: number, k = 2): Mesh {
  const nodes: MeshNode[] = []
  for (let i = 0; i < n; i++) nodes.push({ x: lerp(x0, x1, rnd()), y: lerp(y0, y1, rnd()), file: rnd() < 0.35, ph: rnd() })
  const edges: [number, number][] = []
  nodes.forEach((a, i) => {
    const near = nodes.map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 })).filter((e) => e.j !== i).sort((p, q) => p.d - q.d)
    for (let m = 0; m < k; m++) if (i < near[m].j || m === 0) edges.push([i, near[m].j])
  })
  return { nodes, edges }
}

export function fileIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const w = s * 0.78
  const c = s * 0.28
  g.beginPath()
  g.moveTo(x - w / 2, y - s / 2)
  g.lineTo(x + w / 2 - c, y - s / 2)
  g.lineTo(x + w / 2, y - s / 2 + c)
  g.lineTo(x + w / 2, y + s / 2)
  g.lineTo(x - w / 2, y + s / 2)
  g.closePath()
  g.stroke()
  g.beginPath()
  g.moveTo(x + w / 2 - c, y - s / 2)
  g.lineTo(x + w / 2 - c, y - s / 2 + c)
  g.lineTo(x + w / 2, y - s / 2 + c)
  g.stroke()
}

/** Draw a mesh; `pos(i)` maps node i to its current position, `vis(i)` its 0..1 visibility. */
export function drawMesh(
  g: CanvasRenderingContext2D, m: Mesh, pos: (i: number) => [number, number], vis: (i: number) => number, color: string, alpha: number,
): void {
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = 1
  for (const [a, b] of m.edges) {
    const v = Math.min(vis(a), vis(b))
    if (v <= 0) continue
    const [ax, ay] = pos(a)
    const [bx, by] = pos(b)
    g.globalAlpha = alpha * 0.55 * v
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(lerp(ax, bx, v), lerp(ay, by, v)); g.stroke()
  }
  m.nodes.forEach((n, i) => {
    const v = vis(i)
    if (v <= 0) return
    const [x, y] = pos(i)
    g.globalAlpha = alpha * v
    if (n.file) { g.lineWidth = 1.4; fileIcon(g, x, y, 16) } else g.fillRect(x - 2, y - 2, 4, 4)
  })
  g.globalAlpha = 1
}

/** Shared geometry of the BLAME? push-in; pylons reads the cursor position from it. */
export interface BlameGeom {
  lay: TextLayout
  dot: [number, number]
  meLeft: number
  qRight: number
  base: number
  capH: number
  /** World → screen at timeline time t: [Dx, Dy, z]; screen = D + z·(p − dot). */
  cam(t: number): [number, number, number]
  screen(t: number, x: number, y: number): [number, number]
}
export const BLAME_PUSH = [ft(19.0), ft(20.4)] as const
export function blameGeom(gl: Glyphs): BlameGeom {
  const size = 300
  const base = 640
  const lay = gl.layout('BLAME?', { size, variation: { wght: 560, wdth: 112 }, tracking: -10, align: 'center', x: W / 2, y: base })
  const q = lay.glyphs[5]
  const dot: [number, number] = [q.x + q.advance * 0.47, base - size * 0.07]
  const meLeft = lay.glyphs[3].x
  const qRight = q.x + q.advance
  const zEnd = 1420 / (qRight - meLeft)
  const end: [number, number] = [-35 + zEnd * (dot[0] - meLeft), 700 + zEnd * (dot[1] - base)]
  const cam = (t: number): [number, number, number] => {
    const k = inOutCubic(seg(t, BLAME_PUSH[0], BLAME_PUSH[1]))
    const creep = 1 + 0.035 * clamp01((t - BLAME_PUSH[1]) / 2)
    const z = lerp(1, zEnd, k) * creep
    return [lerp(dot[0], end[0], k), lerp(dot[1], end[1], k), z]
  }
  return {
    lay, dot, meLeft, qRight, base, capH: size * 0.72, cam,
    screen(t, x, y) { const [dx, dy, z] = cam(t); return [dx + z * (x - dot[0]), dy + z * (y - dot[1])] },
  }
}

