// The look: one fragment pass that draws a source texture (a three.js render target or a footage
// canvas) into a rectangle of the stage, as clean grey, a dot matrix, ASCII glyphs or a 1-bit
// dither, with pixel-sort streaks and blocks of other treatments on top. The cell grid is global
// (stage px), so every tile shares it.
import * as THREE from 'three'
import type { Frame, MountContext } from '@cueframe/core'
import { fsPass, glsl, lib, type FsPass } from '@cueframe/gfx'

export const MODE = { clean: 0, dots: 1, ascii: 2, dither: 3, ink: 4, accent: 5, invert: 6, off: 7, matrix: 8, shift: 9, print: 10 } as const
export type Mode = keyof typeof MODE

export interface Rect { x: number; y: number; w: number; h: number }
/** A block inside the tile, in 0..1 of the tile, with its own treatment. */
export interface Block extends Rect { mode: Mode }

export interface Draw {
  src: THREE.Texture
  /** Where on the stage (logical px, top-left origin). Default: full stage. */
  rect?: Rect
  /** The source window in image coords (0..1, top-left origin). Default: whole image. */
  crop?: Rect
  /** Source aspect for the default crop (default: the stage's, as for render targets). */
  aspect?: number
  /** Mirror the source horizontally / vertically inside the tile. */
  flipX?: boolean
  flipY?: boolean
  mode?: Mode
  /** Cell size in logical px for dots/ascii/matrix. */
  cell?: number
  /** Grey ramp: luminance → black point, white point, gamma. */
  levels?: [number, number, number]
  ink?: string
  paper?: string
  accent?: string
  /** Keep the source colour (tinted towards ink) instead of mono. */
  colour?: number
  /** Pixel-sort streaks: 0..1 share of columns, seed, direction (0 up, 1 down, 2 left, 3 right). */
  streak?: { amount: number; seed: number; dir?: 0 | 1 | 2 | 3; width?: number; reach?: number }
  blocks?: Block[]
  /** Fade (premultiplied) 0..1. */
  opacity?: number
  /** RGB split in px. */
  split?: number
  /** Keep the source's reds as the accent colour (0..1). */
  red?: number
  /** Cells taken over by a moving noise field: amount 0..1, noise scale in cells, time, bias to dark areas. */
  field?: { amount: number; scale?: number; time: number; dark?: number; modes?: [Mode, Mode] }
  /** ACES tone mapping of the source (HDR renders): exposure. */
  exposure?: number
  /** Brightness gain on the result. */
  gain?: number
}

const MAXB = 24
const MAXS = String(MAXB)   // glsl`` turns numbers into floats; array sizes need an int literal

const FRAG = glsl`${lib.hash}${lib.fbm}
uniform sampler2D src, atlas;
uniform vec4 rect, crop;
uniform vec2 flip;
uniform float mode, cell, glyphs, colour, opacity, split, gain, red;
uniform vec3 levels, ink, paper, accent;
uniform vec4 streak;          // amount, seed, dir, width (cells)
uniform float reach;
uniform vec4 blocks[${MAXS}];
uniform float bmode[${MAXS}];
uniform float nblocks;
uniform vec4 field;           // amount, scale (cells per noise unit), time, dark bias
uniform vec2 fieldModes;      // the two treatments masked cells take
uniform vec2 aces;            // on, exposure

vec2 stagePx() { return vec2(vUv.x * logical.x, (1.0 - vUv.y) * logical.y); }
// tile coords q (0..1, top-left) → source texture uv
vec2 srcUv(vec2 q) {
  q = mix(q, 1.0 - q, flip);
  vec2 img = crop.xy + q * crop.zw;
  return vec2(img.x, 1.0 - img.y);
}
vec3 acesFilm(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 fetch(vec2 q) {
  vec3 c = textureLod(src, srcUv(clamp(q, 0.0, 1.0)), 0.0).rgb;
  return aces.x > 0.5 ? acesFilm(c * aces.y) : c;
}
float tone(vec3 lin) {
  float l = luma(toSRGB(lin));
  return pow(sat((l - levels.x) / max(1e-3, levels.y - levels.x)), levels.z);
}
// pixel-sort streak: a column (or row) above its cutoff repeats the colour at the cutoff
vec2 streakQ(vec2 p, vec2 q) {
  if (streak.x <= 0.0) return q;
  bool vert = streak.z < 1.5;
  float along = vert ? p.x : p.y;
  float w = max(1.0, streak.w) * cell;
  float col = floor(along / w);
  float h = hash12(vec2(col, streak.y));
  if (h > streak.x) return q;
  float cut = hash12(vec2(col * 1.37 + 3.1, streak.y + 7.0));
  float len = reach * (0.25 + 0.75 * hash12(vec2(col, streak.y + 19.0)));
  if (vert) {
    if (streak.z < 0.5) { float c0 = mix(0.15, 0.95, cut); if (q.y < c0 && q.y > c0 - len) q.y = c0 - (c0 - q.y) * 0.04; }
    else { float c0 = mix(0.05, 0.85, cut); if (q.y > c0 && q.y < c0 + len) q.y = c0 + (q.y - c0) * 0.04; }
  } else {
    if (streak.z < 2.5) { float c0 = mix(0.15, 0.95, cut); if (q.x < c0 && q.x > c0 - len) q.x = c0 - (c0 - q.x) * 0.04; }
    else { float c0 = mix(0.05, 0.85, cut); if (q.x > c0 && q.x < c0 + len) q.x = c0 + (q.x - c0) * 0.04; }
  }
  return q;
}
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i.y * 4 + i.x]) + 0.5) / 16.0;
}
// mean tone over a cell (4 × 4 taps): point-sampling the centre aliases, and moving content then
// flips whole cells from frame to frame (a flicker the photosensitivity check counts)
float cellTone(vec2 cellId) {
  float acc = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 sp = (cellId + (vec2(float(i), float(j)) + 0.5) / 4.0) * cell;
    acc += tone(fetch((sp - rect.xy) / rect.zw));
  }
  return acc / 16.0;
}
vec3 shade(float m, vec2 p, vec2 q) {
  vec2 cellId = floor(p / cell);
  vec2 cq = ((cellId + 0.5) * cell - rect.xy) / rect.zw;   // the cell centre in tile coords
  vec2 local = fract(p / cell);
  if (m < 0.5) {                       // clean: graded grey (or colour)
    vec3 c = fetch(q);
    float v = tone(c);
    vec3 mono = mix(paper, ink, v);
    return mix(mono, toLinear(sat(toSRGB(c) * 1.0)) , colour);
  }
  if (m > 9.5) {                       // print: ink edges, banded tone, a red spot plate, as a printed plate
    vec2 tx = 1.0 / vec2(textureSize(src, 0));
    vec2 uv = srcUv(q);
    float l[9];
    for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
      vec3 cc = textureLod(src, uv + vec2(float(i - 1), float(j - 1)) * tx * 1.5, 0.0).rgb;
      if (aces.x > 0.5) cc = acesFilm(cc * aces.y);
      l[j * 3 + i] = luma(toSRGB(cc));
    }
    float gx = (l[2] + 2.0 * l[5] + l[8]) - (l[0] + 2.0 * l[3] + l[6]);
    float gy = (l[6] + 2.0 * l[7] + l[8]) - (l[0] + 2.0 * l[1] + l[2]);
    float edge = smoothstep(0.18, 0.5, length(vec2(gx, gy)));
    vec3 c = fetch(q);
    vec3 sc = toSRGB(c);
    float v = tone(c);
    // four bands, dithered at 2 px between neighbours (finer than the flash check's cells)
    float bands = 4.0;
    float b = floor(v * bands + bayer4(floor(p / 2.0)) - 0.25) / (bands - 1.0);
    b = clamp(b, 0.0, 1.0);
    vec3 grey = mix(paper, ink, b);
    // the red plate: paint keeps its hue as flat red bands, printed a little off register
    vec3 sc2 = toSRGB(textureLod(src, uv + vec2(2.0, -1.0) * tx, 0.0).rgb);
    float redness = sat((sc2.r - max(sc2.g, sc2.b) - 0.12) * 4.0);
    vec3 redInk = accent * mix(0.32, 1.0, b);
    vec3 col = mix(grey, redInk, redness * colour);
    return mix(col, vec3(0.02), edge * 0.9);
  }
  if (m < 1.5 || (m > 7.5 && m < 8.5)) {            // dots (size by tone) / matrix (fixed squares, brightness by tone)
    float v = cellTone(cellId);
    vec2 d = abs(local - 0.5);
    float s = m < 1.5 ? 0.5 * sqrt(v) * 0.92 : 0.21;
    // anti-aliased edges (one physical pixel): a dot that grows slowly changes its cell slowly
    float aa = 1.0 / (cell * scale);
    float on = 1.0 - smoothstep(s - aa, s + aa, max(d.x, d.y));
    on *= smoothstep(0.0, 0.04, s);
    float b = m < 1.5 ? 1.0 : v;
    return mix(paper, ink, on * b);
  }
  if (m < 2.5) {                       // ascii: glyph by tone, crossfading between neighbouring glyphs
    vec3 c = fetch(cq);
    float v = cellTone(cellId);
    float gf = v * (glyphs - 1.0);
    float g0 = floor(gf), g1 = min(glyphs - 1.0, g0 + 1.0);
    vec2 a = vec2(local.x, 1.0 - local.y);
    float cov = mix(textureLod(atlas, vec2((g0 + a.x) / glyphs, a.y), 0.0).r, textureLod(atlas, vec2((g1 + a.x) / glyphs, a.y), 0.0).r, smoothstep(0.25, 0.75, gf - g0));
    vec3 inkC = mix(ink, toLinear(sat(toSRGB(c) * 1.25)), colour);
    return mix(paper, inkC, cov);
  }
  if (m < 3.5) {                       // 1-bit ordered dither at 2 px
    float v = tone(fetch(q));
    return mix(paper, ink, step(bayer4(floor(p / 2.0)), v));
  }
  if (m < 4.5) return ink;
  if (m < 5.5) return accent;
  if (m < 6.5) { float v = tone(fetch(q)); return mix(ink, paper, v); }   // invert
  return paper;
}
void main() {
  vec2 p = stagePx();
  vec2 q = (p - rect.xy) / rect.zw;
  if (q.x < 0.0 || q.y < 0.0 || q.x >= 1.0 || q.y >= 1.0 || opacity <= 0.0) { fragColor = vec4(0.0); return; }
  q = streakQ(p, q);
  float m = mode;
  for (int i = 0; i < ${MAXS}; i++) {
    if (float(i) >= nblocks) break;
    vec4 b = blocks[i];
    vec2 r = (p - rect.xy) / rect.zw;
    if (r.x >= b.x && r.y >= b.y && r.x < b.x + b.z && r.y < b.y + b.w) {
      m = bmode[i];
      if (m > 8.5) { q += (vec2(hash11(float(i) + 3.1), hash11(float(i) + 9.7)) - 0.5) * vec2(0.12, 0.06); m = 0.0; }
    }
  }
  // the AE grammar: cells where a moving noise field (biased to the dark parts of the picture) is
  // high take another treatment, so glyph clusters grow and recede over the body continuously
  if (field.x > 0.0 && (m < 0.5 || m > 9.5)) {
    vec2 cid = floor(p / cell);
    vec2 cc = ((cid + 0.5) * cell - rect.xy) / rect.zw;
    float n = 0.5 + 0.5 * fbm(vec3(cid / field.y, field.z), 3);
    float dark = 1.0 - tone(fetch(cc));
    float v = n + field.w * (dark - 0.5);
    if (v > 1.0 - field.x) m = hash12(floor(cid / 3.0) + 7.0) < 0.5 ? fieldModes.x : fieldModes.y;
  }
  vec3 c;
  if (split > 0.0 && m < 0.5) {
    vec2 o = vec2(split / rect.z, 0.0);
    c = vec3(shade(m, p, q - o).r, shade(m, p, q).g, shade(m, p, q + o).b);
  } else c = shade(m, p, q);
  if (red > 0.0 && m < 2.5 && m < 9.5) {
    // keep only the reds of the source (taillights, paint, a red eye), as the accent colour
    vec2 rq = m < 0.5 ? q : ((floor(p / cell) + 0.5) * cell - rect.xy) / rect.zw;
    vec3 sc = toSRGB(fetch(rq));
    // red, not orange: green well under red
    float redness = sat((sc.r - max(sc.g, sc.b) - 0.22) * 3.0) * smoothstep(0.15, 0.4, sc.r) * (1.0 - smoothstep(0.32, 0.5, sc.g / max(sc.r, 1e-3)));
    float lit = m < 0.5 ? 1.0 : luma(c) / max(1e-3, luma(ink));
    c = mix(c, accent * mix(0.35, 1.0, luma(sc)) * (m < 0.5 ? 1.0 : lit), redness * red);
  }
  fragColor = vec4(c * gain * opacity, opacity);
}`

/** Glyphs from dark to light, drawn into a one-row atlas. */
export const RAMP = ' .·:-=+*≡#%@'

export interface Look {
  draw(f: Frame, d: Draw): void
  readonly atlas: THREE.Texture
}

const col = (s: string, out: THREE.Color) => out.set(s).convertSRGBToLinear()

export function look(ctx: MountContext, font = '"JetBrains Mono"', ramp = RAMP): Look {
  const n = [...ramp].length
  const S = 48
  const c = document.createElement('canvas')
  c.width = S * n
  c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `600 ${S * 0.92}px ${font}`
  ;[...ramp].forEach((ch, i) => g.fillText(ch, i * S + S / 2, S / 2 + 2))
  const atlas = new THREE.CanvasTexture(c)
  atlas.minFilter = THREE.LinearFilter
  atlas.magFilter = THREE.LinearFilter
  atlas.generateMipmaps = false
  const pass: FsPass = fsPass(ctx, FRAG, { blend: 'normal' })
  const W = ctx.stage.w, H = ctx.stage.h
  const ink = new THREE.Color(), paper = new THREE.Color(), accent = new THREE.Color()
  const bl = new Float32Array(MAXB * 4), bm = new Float32Array(MAXB)
  return {
    atlas,
    draw(f, d) {
      const r = d.rect ?? { x: 0, y: 0, w: W, h: H }
      const cr = d.crop ?? cover(d.aspect ?? W / H, r.w / r.h)
      const bs = (d.blocks ?? []).slice(0, MAXB)
      bl.fill(0); bm.fill(0)
      bs.forEach((b, i) => { bl.set([b.x, b.y, b.w, b.h], i * 4); bm[i] = MODE[b.mode] })
      const st = d.streak
      pass.draw(f, {
        src: d.src, atlas, glyphs: n,
        rect: [r.x, r.y, r.w, r.h], crop: [cr.x, cr.y, cr.w, cr.h], flip: [d.flipX ? 1 : 0, d.flipY ? 1 : 0],
        mode: MODE[d.mode ?? 'clean'], cell: d.cell ?? 12, levels: d.levels ?? [0.04, 0.92, 1],
        ink: col(d.ink ?? '#f2f2ee', ink), paper: col(d.paper ?? '#000000', paper), accent: col(d.accent ?? '#ff2a3a', accent),
        colour: d.colour ?? 0, red: d.red ?? 0, opacity: d.opacity ?? 1, split: d.split ?? 0, gain: d.gain ?? 1,
        streak: [st?.amount ?? 0, st?.seed ?? 0, st?.dir ?? 0, st?.width ?? 1], reach: st?.reach ?? 1,
        blocks: bl as unknown as number[], bmode: bm as unknown as number[], nblocks: bs.length,
        field: [d.field?.amount ?? 0, d.field?.scale ?? 6, d.field?.time ?? 0, d.field?.dark ?? 0.8],
        fieldModes: [MODE[d.field?.modes?.[0] ?? 'ascii'], MODE[d.field?.modes?.[1] ?? 'matrix']],
        aces: [d.exposure !== undefined ? 1 : 0, d.exposure ?? 1],
      })
    },
  }
}

/** Cover-fit crop of an image of aspect `ia` into a rect of aspect `ra`, with a focus point and zoom. */
export function cover(ia: number, ra: number, fx = 0.5, fy = 0.5, zoom = 1): Rect {
  let w = 1, h = 1
  if (ia > ra) w = ra / ia
  else h = ia / ra
  w /= zoom
  h /= zoom
  const x = Math.min(1 - w, Math.max(0, fx - w / 2))
  const y = Math.min(1 - h, Math.max(0, fy - h / 2))
  return { x, y, w, h }
}
