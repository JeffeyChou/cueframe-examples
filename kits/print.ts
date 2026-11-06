// Printed in spot inks: risograph, silkscreen, woodcut, halftone. Draw each plate as ink density
// into a separation canvas (one plate per RGB channel: 0 = paper, 1 = solid ink) and print it with
// one fragment pass: per-plate registration, screen (dots, lines, solid, wood), grain, pinholes,
// uneven ink, a roller that lays a plate down, paper × the inks. Style bible: kits/styles/riso.md.
// Ported in spirit from lemo-opuscar's risograph engine (MIT, Copyright (c) 2026 LemoLab).

import * as THREE from 'three'
import type { Frame, MountContext } from '@cueframe/core'
import { fsPass, glsl, lib, linearRGB, type FsPass } from '@cueframe/gfx'
import { mulberry } from './svg.js'

/** Riso drum inks (approximate sRGB of the published colours). */
export const RISO = {
  black: '#000000', blue: '#0078BF', mediumBlue: '#3255A4', federalBlue: '#3D5588', teal: '#00838A', aqua: '#5EC8E5',
  green: '#00A95C', yellow: '#FFE800', sunflower: '#FFB511', orange: '#FF6C2F', red: '#FF665E', brightRed: '#F15060',
  fluoPink: '#FF48B0', fluoOrange: '#FF7477', purple: '#765BA7', burgundy: '#914E72',
} as const
export const PAPERS = { riso: '#F4EEE2', bright: '#FAF7F0', newsprint: '#EDE6D3', poster: '#EFE8D8', kraft: '#C9A877' } as const

/** dot: round halftone; line: line screen; solid: flat ink, rough edge; wood: solid with grain voids and bitten edges. */
export type Screen = 'dot' | 'line' | 'solid' | 'wood'
const SCREENS: Record<Screen, number> = { dot: 0, line: 1, solid: 2, wood: 3 }

export interface Ink {
  color: string
  screen?: Screen
  /** Screen angle in degrees (dots, lines; the grain direction for wood). Keep plates ≥ 15° apart. */
  angle?: number
  /** Screen period in logical px (default 7). */
  period?: number
  /** 0 = translucent, multiplies (riso); 1 = covers what is under it (silkscreen, opaque white). */
  opaque?: number
}

export interface PressOptions {
  /** 1–6 inks in printing order: plates 0–2 are the channels of `sep`, 3–5 of `key`. */
  inks: readonly Ink[]
  paper?: string
  /** Threshold noise; pinholes grow with its square (default 1). */
  grain?: number
  /** Feed streaks and blotchy density (default 1). */
  uneven?: number
  /** Paper fibre (default 1). */
  fiber?: number
  /** Share of the grain that changes with every print (default 0.35); the rest stays with the sheet. */
  boil?: number
  /** Ink pooled on the edges of a solid (silkscreen), 0..1 (default 0). */
  rim?: number
}

export interface PrintFrame {
  /** Per plate, logical px. */
  off?: readonly (readonly [number, number])[]
  /** Per plate, radians about the frame centre. */
  rot?: readonly number[]
  /** Per plate, 0..1: is the plate on the press yet. */
  gate?: readonly number[]
  /** Per plate, the roller's edge as a fraction of the width (≥ 1.05: fully inked; default done). */
  sweep?: readonly number[]
  /** Changes the static grain, streaks and blots: change it on cuts only. */
  sheet?: number
  /** Changes the boiling part of the grain: `printSeed(t)`. */
  print?: number
}

export interface Separation {
  readonly canvas: HTMLCanvasElement
  readonly g: CanvasRenderingContext2D
  readonly texture: THREE.CanvasTexture
  /** Fill with `base` densities (default none = paper), draw with `fn` in logical px, upload. */
  draw(fn: (g: CanvasRenderingContext2D) => void, base?: readonly number[]): void
  /**
   * Draw `fn` as a figure over the plates with a paper-white knockout ring `px` wide around it (a
   * trap: misregistered plates fringe it). Uses the current transform. Overprint (`over`) inside
   * `fn` has nothing under it to add to: overprint on the plates instead.
   */
  halo(fn: (g: CanvasRenderingContext2D) => void, px?: number): void
}

const c255 = (v: number | undefined) => Math.round(Math.max(0, Math.min(1, v ?? 0)) * 255)
/** A fill or stroke style for ink densities on plates 0, 1, 2 of a separation (0..1 each). */
export const ink = (a = 0, b = 0, c = 0) => `rgb(${c255(a)},${c255(b)},${c255(c)})`
/** Paper: no ink on any plate (a knockout). */
export const PAPER = 'rgb(0,0,0)'
/** Overprint: inside `fn`, drawing adds ink to the plates it names and knocks nothing out. */
export function over(g: CanvasRenderingContext2D, fn: () => void): void {
  const op = g.globalCompositeOperation
  g.globalCompositeOperation = 'lighter'
  try { fn() } finally { g.globalCompositeOperation = op }
}

export function separation(ctx: MountContext, id = 'plates'): Separation {
  const s = ctx.stage.scale
  const w = Math.round(ctx.stage.w * s), h = Math.round(ctx.stage.h * s)
  const make = () => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  const canvas = make()
  canvas.dataset.cfSeparation = id
  const g = canvas.getContext('2d', { alpha: false })
  const layer = make()
  const lg = layer.getContext('2d')
  if (!g || !lg) throw new Error(`separation ${id}: Canvas2D unavailable`)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return {
    canvas, g, texture,
    draw(fn, base = []) {
      g.save()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.filter = 'none'
      g.fillStyle = ink(base[0], base[1], base[2])
      g.fillRect(0, 0, w, h)
      g.setTransform(s, 0, 0, s, 0, 0)
      fn(g)
      g.restore()
      texture.needsUpdate = true
    },
    halo(fn, px = 5) {
      const m = g.getTransform()
      lg.setTransform(1, 0, 0, 1, 0, 0)
      lg.globalCompositeOperation = 'source-over'
      lg.clearRect(0, 0, w, h)
      lg.setTransform(m)
      fn(lg)
      g.save()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'source-over'
      if (px > 0) {
        g.filter = 'brightness(0)'
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2
          g.drawImage(layer, Math.cos(a) * px * s, Math.sin(a) * px * s)
        }
        g.filter = 'none'
      }
      g.drawImage(layer, 0, 0)
      g.restore()
    },
  }
}

const N = 6
const FRAG = glsl`${lib.noise}
uniform sampler2D platesA, platesB;
uniform int nInk;
uniform vec3 inks[6];
uniform vec3 paper;
uniform vec2 off[6];
uniform float rot[6], ang[6], period[6], gate[6], sweep[6], opaque[6];
uniform int screen[6];
uniform float grain, uneven, fiber, boil, rim, sheet, seed;

mat2 turn(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float plateAt(int i, vec2 q) {
  vec2 uv = vec2(q.x / logical.x, 1.0 - q.y / logical.y);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return i < 3 ? texture(platesA, uv)[i] : texture(platesB, uv)[i - 3];
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * logical;
  vec2 c = logical * 0.5;
  float fib = 0.5 + 0.25 * vnoise(px * vec2(0.9, 0.25) + 7.0) + 0.25 * vnoise(px * 0.05 + 9.0);
  vec3 col = paper * (1.0 - fiber * (0.03 - 0.035 * fib));
  for (int i = 0; i < 6; i++) {
    if (i >= nInk) break;
    if (gate[i] <= 0.001) continue;
    float fi = float(i);
    vec2 q = turn(rot[i]) * (px - c) + c - off[i];
    float d = plateAt(i, q);
    float x01 = px.x / logical.x;
    float reveal = 1.0 - smoothstep(-0.003, 0.003, x01 - sweep[i]);
    float band = exp(-pow((x01 - sweep[i]) / 0.012, 2.0));
    if (d < 0.002) continue;
    vec2 g = turn(ang[i]) * q / period[i];
    int sc = screen[i];
    float spot = sc == 0 ? 1.0 - (cos(TAU * g.x) + cos(TAU * g.y) + 2.0) * 0.25
               : sc == 1 ? 0.5 - 0.5 * cos(TAU * g.y)
               : 0.5;
    float n1 = mix(hash12(floor(q * 0.9) + sheet * 17.13 + fi * 3.1), hash12(floor(q * 0.9) + seed * 17.13 + fi * 3.1), boil);
    float n2 = 0.5 + 0.5 * vnoise(q * 0.33 + sheet * 0.7 + fi * 13.0);
    float thr = spot + ((n1 - 0.5) * 0.16 + (n2 - 0.5) * 0.12) * grain;
    float aa = sc >= 2 ? 0.04 : 0.07;
    if (sc == 3) {
      thr += 0.22 * vnoise(q * 0.07 + fi * 5.0 + sheet) + 0.08 * vnoise(q * 0.4 + 3.0);
    }
    float cov = smoothstep(thr - aa, thr + aa, d * 1.06);
    if (sc == 0 || sc == 1) cov = max(cov, smoothstep(0.9, 1.0, d) * 0.96);
    if (sc == 3) {
      vec2 r = turn(ang[i]) * q;
      float warp = 6.0 * vnoise(r * vec2(0.004, 0.02) + fi);
      float lines = 0.5 + 0.5 * sin(r.y * 0.45 + warp);
      float voids = smoothstep(0.86, 0.97, lines) * (0.55 + 0.45 * vnoise(r * vec2(0.01, 0.2) + 2.0));
      cov *= 1.0 - 0.8 * clamp(voids, 0.0, 1.0);
    }
    float sp = hash12(floor(q * 0.55) + sheet * 1.3 + fi * 7.7);
    cov *= 1.0 - step(1.0 - 0.075 * grain * grain, sp) * 0.75 * smoothstep(0.4, 1.0, d);
    float streak = 0.5 + 0.5 * vnoise(vec2(q.x * 0.025, q.y * 0.0022) + 11.0 + fi + sheet * 0.37);
    float blot = 0.5 + 0.5 * vnoise(q * 0.004 + 5.0 + fi * 2.0 + sheet * 0.13);
    float k = clamp(1.0 - uneven * (0.2 - 0.14 * streak - 0.08 * blot), 0.0, 1.0);
    if (rim > 0.0) {
      vec2 e = vec2(2.5, 0.0);
      float edge = abs(plateAt(i, q + e) - plateAt(i, q - e)) + abs(plateAt(i, q + e.yx) - plateAt(i, q - e.yx));
      k = clamp(k + rim * 0.25 * clamp(edge, 0.0, 1.0), 0.0, 1.15);
    }
    float a = clamp(cov * min(k, 1.0) * reveal + band * 0.45 * smoothstep(0.0, 0.25, d), 0.0, 1.0) * gate[i];
    vec3 ik = inks[i] * (k > 1.0 ? 2.0 - k : 1.0);
    col = mix(col * mix(vec3(1.0), ik, a), mix(col, ik, a), opaque[i]);
  }
  fragColor = vec4(col, 1.0);
}`

export interface Press {
  readonly sep: Separation
  /** Plates 3–5 (only with more than three inks). */
  readonly key: Separation | null
  readonly pass: FsPass
  /** Print the separations into the current hdr compositor (`hdr(ctx).begin(f)` first). */
  print(f: Frame, o?: PrintFrame): void
}

const pad = <T>(a: readonly T[] | undefined, fill: T): T[] => Array.from({ length: N }, (_, i) => a?.[i] ?? fill)

export function press(ctx: MountContext, o: PressOptions): Press {
  if (o.inks.length < 1 || o.inks.length > N) throw new Error(`press: 1–${N} inks, got ${o.inks.length}`)
  const sep = separation(ctx, 'plates')
  const key = o.inks.length > 3 ? separation(ctx, 'key') : null
  const inks = pad(o.inks, { color: '#ffffff' } as Ink)
  const pass = fsPass(ctx, FRAG, {
    blend: 'replace',
    uniforms: {
      platesA: sep.texture, platesB: (key ?? sep).texture, nInk: o.inks.length,
      inks: inks.flatMap((k) => linearRGB(k.color)), paper: linearRGB(o.paper ?? PAPERS.riso),
      ang: inks.map((k, i) => ((k.angle ?? [15, 75, 0, 45, 30, 60][i]!) * Math.PI) / 180),
      period: inks.map((k) => k.period ?? 7), opaque: inks.map((k) => k.opaque ?? 0),
      screen: inks.map((k) => SCREENS[k.screen ?? 'dot']),
      grain: o.grain ?? 1, uneven: o.uneven ?? 1, fiber: o.fiber ?? 1, boil: o.boil ?? 0.35, rim: o.rim ?? 0,
    },
  })
  return {
    sep, key, pass,
    print(f, p = {}) {
      pass.draw(f, {
        off: pad(p.off, [0, 0] as const).flat(), rot: pad(p.rot, 0), gate: pad(p.gate, 1), sweep: pad(p.sweep, 2),
        sheet: p.sheet ?? 0, seed: p.print ?? 0,
      })
    },
  }
}

// ── Presets: the four looks of one press ──────────────────────────────────────────────────────
/** Translucent inks, round dots 7 px, angles 15/75/0°, grain and feed streaks. */
export const riso = (colors: readonly string[], o: Partial<PressOptions> = {}): PressOptions =>
  ({ inks: colors.map((color) => ({ color, screen: 'dot' as const })), paper: PAPERS.riso, ...o })
/** Opaque flat inks with pooled edges, little grain: a screen-printed poster. */
export const silkscreen = (colors: readonly string[], o: Partial<PressOptions> = {}): PressOptions =>
  ({ inks: colors.map((color) => ({ color, screen: 'solid' as const, opaque: 0.85 })), paper: PAPERS.poster, grain: 0.25, uneven: 0.5, rim: 1, ...o })
/** The last ink is the key block (wood grain along `angle`, bitten edges); the others flat colour blocks. */
export const woodcut = (colors: readonly string[], o: Partial<PressOptions> & { angle?: number } = {}): PressOptions =>
  ({ inks: colors.map((color, i) => ({ color, screen: i === colors.length - 1 ? ('wood' as const) : ('solid' as const), angle: o.angle ?? 8 })),
     paper: PAPERS.newsprint, grain: 0.8, uneven: 0.7, ...o })
/** Process-style dots, coarse (12 px) at 15/75/0/45°, e.g. cyan, magenta, yellow, black (needs `key`). */
export const halftone = (colors: readonly string[], o: Partial<PressOptions> & { period?: number } = {}): PressOptions =>
  ({ inks: colors.map((color) => ({ color, screen: 'dot' as const, period: o.period ?? 12 })), paper: PAPERS.newsprint, grain: 0.6, uneven: 0.4, ...o })

// ── Time ─────────────────────────────────────────────────────────────────────────────────────
/** Every frame is a new print: the boiling grain changes `fps` times a second (default 12, on twos). */
export const printSeed = (t: number, fps = 12) => Math.floor(t * fps + 1e-6)
/** Time stepped to `fps`: characters act on twos while the camera moves on ones. */
export const onTwos = (t: number, fps = 12) => printSeed(t, fps) / fps

const seedOf = (k: number | string) => (typeof k === 'number' ? k : [...k].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7))

export interface Registration {
  /** Plates. */
  n: number
  /** Shot id or number: the plates' fixed offsets for the shot. */
  shot: number | string
  t: number
  /** Fixed offset per shot, ± px (default 2). */
  spread?: number
  /** Accents: each knocks the plates apart by `kick` px (default 10), settling in ~0.25 s with a little ringing. */
  kicks?: readonly number[]
  kick?: number
  /** 0..1: the plates drift apart (a held, uneasy moment), up to `driftPx` (default 24); snap back by returning it to 0. */
  drift?: number
  driftPx?: number
}

/** Plate offsets and rotations: fixed per shot, kicked on accents, drifting when asked. Never per-frame jitter. */
export function registration(o: Registration): { off: [number, number][]; rot: number[] } {
  const r = mulberry(seedOf(o.shot))
  const spread = o.spread ?? 2
  const base = Array.from({ length: o.n }, (_, i) => (i === 0 ? [0, 0, 0] : [(r() * 2 - 1) * spread, (r() * 2 - 1) * spread, (r() * 2 - 1) * 0.0006]))
  let k = -1
  for (let i = 0; i < (o.kicks?.length ?? 0); i++) if (o.kicks![i]! <= o.t) k = i
  const since = k >= 0 ? o.t - o.kicks![k]! : Infinity
  const amp = Number.isFinite(since) ? (o.kick ?? 10) * Math.exp(-since * 14) * Math.cos(since * 30) : 0
  const kr = mulberry(seedOf(o.shot) + 101 * (k + 1))
  const drift = (o.drift ?? 0) * (o.driftPx ?? 24)
  const off = base.map(([x, y], i) => {
    const a = kr() * Math.PI * 2, b = (i / Math.max(1, o.n - 1)) * Math.PI * 2 + 0.7
    const kx = i === 0 ? 0.3 : 1
    return [x! + kx * amp * Math.cos(a) + drift * Math.cos(b) * (i === 0 ? 0.2 : 1), y! + kx * amp * Math.sin(a) + drift * Math.sin(b) * (i === 0 ? 0.2 : 1)] as [number, number]
  })
  return { off, rot: base.map(([, , a], i) => a! + (i === 0 ? 0 : drift * 0.00012 * (i % 2 ? 1 : -1))) }
}

/** A plate arriving: off before `at`, then the roller crosses the frame left to right in `dur` s. */
export function inking(t: number, at: number, dur = 0.6): { gate: number; sweep: number } {
  if (t < at) return { gate: 0, sweep: -0.1 }
  return { gate: 1, sweep: -0.05 + 1.12 * Math.min(1, (t - at) / dur) }
}
