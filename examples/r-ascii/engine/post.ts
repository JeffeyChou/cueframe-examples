// Cell-space CRT: row tearing, ghost rows, colour fringes, block damage, glyph scramble, phosphor
// halo on the background, scanline banding, a rolling band, vignette and flicker. The caption band
// is protected: it only gets the light (non-destructive) part.
import { Cells, type Rect, B, G as Gc, R, mix, mul, rgb } from './cells.ts'
import { frameRng, hash } from './rng.ts'

export interface PostOpts {
  G: number
  t: number
  frame: number
  protect: Rect[]
  tint: number
  hot: readonly number[]
  /** halo strength, 0 disables (the canvas renderer has its own glow) */
  halo: number
  /** scanline darkening for odd rows (terminal only) */
  scan: number
}

const inRects = (rs: Rect[], x: number, y: number) => rs.some((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h)
const rowProtected = (rs: Rect[], y: number) => rs.some((r) => y >= r.y && y < r.y + r.h)

export function post(c: Cells, o: PostOpts) {
  const { cols, rows } = c
  const G = Math.max(0, o.G)
  const slow = frameRng('slow', Math.floor(o.frame / 3))
  const r = frameRng('post', o.frame)

  // 1. row tearing: persistent bands + per-frame jitter; rows wrap around
  const dx = new Int32Array(rows)
  const nb = Math.floor(G * 4 + (slow() < G * 0.6 ? 1 : 0))
  for (let k = 0; k < nb; k++) {
    const y0 = slow.int(0, rows), n = slow.int(1, 4), d = Math.round(slow.range(-1, 1) * (2 + 18 * G))
    for (let y = y0; y < Math.min(rows, y0 + n); y++) dx[y]! += d
  }
  for (let y = 0; y < rows; y++) if (r() < 0.07 * G) dx[y]! += Math.round(r.range(-1, 1) * (1 + 6 * G))
  const ch = c.ch.slice(), fg = c.fg.slice(), bg = c.bg.slice(), at = c.at.slice()
  for (let y = 0; y < rows; y++) {
    const d = dx[y]!
    if (!d || rowProtected(o.protect, y)) continue
    for (let x = 0; x < cols; x++) {
      const sx = (((x - d) % cols) + cols) % cols, i = y * cols + x, j = y * cols + sx
      c.ch[i] = ch[j]!; c.fg[i] = fg[j]!; c.bg[i] = bg[j]!; c.at[i] = at[j]!
    }
    // re-seal wide pairs broken by the shift
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      if (c.ch[i] === '' && (x === 0 || c.ch[i - 1] === '' || c.ch[i - 1] === ' ')) c.ch[i] = ' '
    }
  }

  // 2. ghost rows: a dim copy of a row appears a few rows away
  const ng = Math.floor(G * 3 + slow() * 1.5 * G)
  for (let k = 0; k < ng; k++) {
    const sy = slow.int(0, rows), ty = sy + slow.pick([-3, -2, -1, 1, 2, 3]), off = slow.int(-8, 9)
    if (ty < 0 || ty >= rows || rowProtected(o.protect, ty) || rowProtected(o.protect, sy)) continue
    for (let x = 0; x < cols; x++) {
      const sx = x - off
      if (sx < 0 || sx >= cols) continue
      const i = ty * cols + x, j = sy * cols + sx
      if (c.ch[i] === ' ' && c.ch[j] !== ' ' && c.ch[j] !== '') { c.ch[i] = c.ch[j]!; c.fg[i] = mul(c.fg[j]!, 0.35) }
    }
  }

  // 3. colour fringes: red echo to the right, cyan to the left, only into empty cells
  const fr = Math.min(1, 0.15 + G * 0.9)
  if (G > 0.05) {
    const off = G > 0.6 ? 2 : 1
    for (let y = 0; y < rows; y++) {
      if (rowProtected(o.protect, y)) continue
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x
        const s = c.ch[i]!
        if (s === ' ' || s === '') continue
        const L = (R(c.fg[i]!) + Gc(c.fg[i]!) + B(c.fg[i]!)) / 765
        if (L < 0.45 || hash(i, o.frame) > fr) continue
        const a = x + off, b = x - off
        if (a < cols && ch[y * cols + a] === ' ' && c.ch[y * cols + a] === ' ') { c.ch[y * cols + a] = s; c.fg[y * cols + a] = rgb(255 * L * 0.55, 20, 40) }
        if (b >= 0 && ch[y * cols + b] === ' ' && c.ch[y * cols + b] === ' ') { c.ch[y * cols + b] = s; c.fg[y * cols + b] = rgb(10, 160 * L * 0.6, 220 * L * 0.6) }
      }
    }
  }

  // 4. block damage
  const nk = Math.floor(G * G * 9)
  for (let k = 0; k < nk; k++) {
    const w = slow.int(3, 26), h = slow.int(1, 3), x = slow.int(0, cols - w), y = slow.int(0, rows - h)
    const col = slow.pick(o.hot), sh = slow.pick(['█', '▓', '▒', '░'])
    for (let yy = y; yy < y + h; yy++) {
      if (rowProtected(o.protect, yy)) continue
      for (let xx = x; xx < x + w; xx++) {
        const v = hash(xx * 31 + yy * 7, k + o.frame)
        const i = yy * cols + xx
        if (c.ch[i] === '') continue
        c.ch[i] = v < 0.3 ? '█' : v < 0.55 ? '▓' : v < 0.8 ? sh : '░'; c.fg[i] = col
        if (xx + 1 < cols && c.ch[i + 1] === '') c.ch[i + 1] = ' '
      }
    }
  }
  // 5. scrambled glyphs
  const ns = Math.floor(G * cols * rows * 0.012)
  const junk = '#%&@$*+=?!/\\<>{}[]01'
  for (let k = 0; k < ns; k++) {
    const i = r.int(0, cols * rows)
    const x = i % cols, y = Math.floor(i / cols)
    if (inRects(o.protect, x, y)) continue
    if (c.ch[i] !== ' ' && c.ch[i] !== '' && !(x + 1 < cols && c.ch[i + 1] === '')) {
      c.ch[i] = junk[r.int(0, junk.length)]!
      if (r() < 0.4) c.fg[i] = r.pick(o.hot)
    }
  }

  // 6. phosphor halo: bright glyphs tint the background of their neighbourhood
  if (o.halo > 0) {
    const lum = new Float32Array(cols * rows)
    const hr = new Float32Array(cols * rows), hg = new Float32Array(cols * rows), hb = new Float32Array(cols * rows)
    for (let i = 0; i < cols * rows; i++) {
      const s = c.ch[i]
      if (s === ' ' || s === '') continue
      const f = c.fg[i]!
      const w = s === '█' ? 1 : s === '·' || s === '.' ? 0.25 : 0.6
      lum[i] = w
      hr[i] = R(f) * w; hg[i] = Gc(f) * w; hb[i] = B(f) * w
    }
    // separable box blur 5×3
    const tr = new Float32Array(cols * rows), tg = new Float32Array(cols * rows), tb = new Float32Array(cols * rows)
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let a = 0, b = 0, d = 0
      for (let k = -2; k <= 2; k++) { const xx = x + k; if (xx < 0 || xx >= cols) continue; const j = y * cols + xx; a += hr[j]!; b += hg[j]!; d += hb[j]! }
      const i = y * cols + x; tr[i] = a; tg[i] = b; tb[i] = d
    }
    const k = o.halo / 15
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let a = 0, b = 0, d = 0
      for (let q = -1; q <= 1; q++) { const yy = y + q; if (yy < 0 || yy >= rows) continue; const j = yy * cols + x; a += tr[j]!; b += tg[j]!; d += tb[j]! }
      if (a + b + d < 8) continue
      const i = y * cols + x
      const base = c.bg[i]! >= 0 ? c.bg[i]! : 0
      c.bg[i] = rgb(R(base) + a * k * 0.5, Gc(base) + b * k * 0.5, B(base) + d * k * 0.5)
    }
  }

  // 7. scanline banding, rolling band, vignette, flicker
  const band = (((o.t * 0.31) % 1.3) - 0.15) * rows
  const flick = 1 - (frameRng('flick', Math.floor(o.frame / 5))() * 0.04 + 0.03 * G)
  const tint = o.tint
  for (let y = 0; y < rows; y++) {
    const prot = rowProtected(o.protect, y)
    const bd = Math.exp(-(((y - band) / 2.2) ** 2))
    const scan = y % 2 ? 1 - o.scan : 1
    const vy = (y / (rows - 1)) * 2 - 1
    for (let x = 0; x < cols; x++) {
      const vx = (x / (cols - 1)) * 2 - 1
      const vig = prot ? 1 : 1 - 0.38 * (vx * vx * 0.6 + vy * vy) ** 1.4
      const k = scan * vig * flick
      const i = y * cols + x
      let f = c.fg[i]!
      if (bd > 0.02 && !prot) f = mix(mul(f, 1 + 0.35 * bd), tint, 0.12 * bd)
      c.fg[i] = mul(f, k)
      const b0 = c.bg[i]!
      if (b0 >= 0) c.bg[i] = mul(bd > 0.02 && !prot ? mix(b0, mul(tint, 0.12), 0.5 * bd) : b0, k)
      else if (bd > 0.05 && !prot) c.bg[i] = mul(tint, 0.05 * bd)
    }
  }
}
