// Film looks for archival and screen stories: footage redrawn as ink (`redraw`), a projected film
// print (`film`: weave, flicker, halation, scratches, dust, hair, burn, iris, toning, tint) and a
// CRT fed by a worn tape (`crt`). Ported in spirit from lemo-opuscar's silent-film engine and
// core/post/crt.js (MIT, Copyright (c) 2026 LemoLab).
//
//   const comp = hdr(ctx), src = frameCanvas(ctx, 'footage'), ink = redraw(ctx), print = film(ctx)
//   render: src.draw((g) => clip.draw(g, k, gateRect(ctx.stage)))
//           comp.begin(f); ink.draw(f, src.texture); print.apply(f, comp, { iris })
//
// `redraw` draws into the current hdr compositor; `film` and `crt` end the frame like `post.apply`:
// they read the compositor's target and write the layer.
import * as THREE from 'three'
import type { Frame, MountContext, Stage } from '@cueframe/core'
import { fsPass, glsl, lib, linearRGB, type FsPass, type Hdr } from '@cueframe/gfx'

const srgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`film: colour "${hex}" is not #rrggbb`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Scene time on a hand-cranked camera: `fps` (default 18) steps a second. */
export const crank = (t: number, fps = 18): number => Math.floor(t * fps + 1e-6) / fps

/** The picture area of an `aspect` gate centred in the stage (default 4:3, pillarboxed), logical px. */
export function gateRect(stage: Pick<Stage, 'w' | 'h'>, aspect = 4 / 3): { x: number; y: number; w: number; h: number } {
  const w = Math.min(stage.w, stage.h * aspect), h = Math.min(stage.h, stage.w / aspect)
  return { x: (stage.w - w) / 2, y: (stage.h - h) / 2, w, h }
}

export interface FrameCanvas {
  readonly canvas: HTMLCanvasElement
  readonly g: CanvasRenderingContext2D
  readonly texture: THREE.CanvasTexture
  /** Clear to black, draw in logical px, upload. */
  draw(fn: (g: CanvasRenderingContext2D) => void): void
}

/** A stage-sized 2D canvas as a texture: draw footage frames (`ctx.frames(...).draw`) or anything into it. */
export function frameCanvas(ctx: MountContext, id: string): FrameCanvas {
  const s = ctx.stage.scale
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(ctx.stage.w * s)
  canvas.height = Math.round(ctx.stage.h * s)
  canvas.dataset.cfFrameCanvas = id
  const g = canvas.getContext('2d', { alpha: false })
  if (!g) throw new Error(`frameCanvas ${id}: Canvas2D unavailable`)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return {
    canvas, g, texture,
    draw(fn) {
      g.save()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.filter = 'none'
      g.fillStyle = '#000'
      g.fillRect(0, 0, canvas.width, canvas.height)
      g.setTransform(s, 0, 0, s, 0, 0)
      fn(g)
      g.restore()
      texture.needsUpdate = true
    },
  }
}

// ── redraw: footage → ink drawing ───────────────────────────────────────────────────────────────
export interface RedrawOptions {
  /** Gain on the edge signal; higher draws more and darker lines (default 14). */
  lines?: number
  /** Edge threshold; lower picks up fainter edges (default 0.35). */
  threshold?: number
  /** Edge softness: the ramp is 1/phi wide (default 4). */
  phi?: number
  /** Line scale in logical px: edges are found at this spacing, so soft or upscaled footage wants 2–3 (default 2). */
  spread?: number
  /** Posterised wash levels; 0 leaves the paper bare (default 5). */
  levels?: number
  /** Darkest wash, 0..1 of the paper (default 0.34). */
  wash?: number
  /** Cross-hatching in the shadows, 0..1 (default 1). */
  hatch?: number
  /** Hatch spacing, logical px (default 5.5). */
  gap?: number
  /** Source colour kept in the wash, 0..1 (default 0: monochrome). */
  colour?: number
  paper?: string
  ink?: string
  /** Output frames per redrawn drawing: lines and hatching boil this often (default 2). */
  boil?: number
}

const REDRAW = glsl`${lib.common}${lib.noise}
uniform sampler2D src;
uniform float lines, thresh, phi, spread, levels, wash, hatch, gap, colour, bk, jitter, amount;
uniform vec3 paper, inkC;

float lumAt(vec2 uv) { return clamp((luma(texture(src, uv).rgb) - 0.5) * 1.08 + 0.5, 0.0, 1.0); }

void main() {
  vec2 tx = 1.0 / logical;
  vec2 q = vec2(vUv.x, 1.0 - vUv.y) * logical;
  vec3 photo = toLinear(texture(src, vUv).rgb);
  if (amount <= 0.0) { fragColor = vec4(photo, 1.0); return; }
  vec2 jit = (vec2(vnoise(q * 0.015 + bk * 7.1), vnoise(q * 0.015 + 31.0 + bk * 3.3)) - 0.5) * jitter * tx;
  vec2 uv = vUv + jit;
  float a1 = 0.0, w1 = 0.0, a2 = 0.0, w2 = 0.0;
  for (int j = -5; j <= 5; j++) for (int i = -5; i <= 5; i++) {
    vec2 o = vec2(float(i), float(j));
    float r2 = dot(o, o);
    float L = lumAt(uv + o * spread * tx);
    float k1 = exp(-r2 / 2.42), k2 = exp(-r2 / 6.2);
    a1 += L * k1; w1 += k1; a2 += L * k2; w2 += k2;
  }
  float g1 = a1 / w1, g2 = a2 / w2;
  float edge = smoothstep(thresh, thresh + 1.0 / phi, (g2 - g1) * lines);

  float x = mix(lumAt(uv), g1, 0.6);
  float tone = 1.0;
  if (levels > 0.0) {
    float lv = x * levels, st = floor(lv);
    float w = (st + smoothstep(0.42, 0.58, lv - st)) / levels;
    tone = mix(wash, 1.0, pow(sat(w), 1.25));
  }

  float d = 1.0 - g1, hatchInk = 0.0;
  vec2 pp = q + (vec2(vnoise(q * 0.01 + bk * 1.7), vnoise(q * 0.01 + 40.0 + bk * 2.3)) - 0.5) * 3.0;
  for (int i = 0; i < 3; i++) {
    float th = i == 0 ? 0.58 : i == 1 ? 0.72 : 0.86;
    float an = i == 0 ? 0.785 : i == 1 ? -0.785 : 0.12;
    if (d < th) continue;
    vec2 n = vec2(cos(an), sin(an));
    float u = dot(pp, n) / gap, v = dot(pp, vec2(-n.y, n.x));
    float dist = abs(fract(u) - 0.5) * gap;
    float wpx = 0.55 + 0.6 * smoothstep(th, 1.0, d);
    float stroke = 1.0 - smoothstep(wpx, wpx + 0.8, dist);
    float brk = step(0.3, vnoise(vec2(v * 0.03, floor(u) * 3.1 + bk * 5.0 + float(i) * 17.0)));
    hatchInk = max(hatchInk, stroke * brk * smoothstep(th, th + 0.06, d));
  }
  float inkK = max(edge, hatchInk * hatch);
  vec3 base = paper * mix(vec3(tone), toLinear(texture(src, uv).rgb), colour);
  float n = 0.65 * vnoise(q * 0.004 + 3.0) + 0.35 * vnoise(q * 0.02 + 9.0);
  float m = smoothstep(n - 0.06, n + 0.06, amount * 1.2 - 0.1);
  fragColor = vec4(mix(photo, mix(base, inkC, inkK), m), 1.0);
}`

export interface Redraw {
  readonly pass: FsPass
  /**
   * Draw `src` (a frameCanvas texture) into the current hdr compositor: as ink, or with `amount`
   * < 1 partly as it is (0 = the source untouched; in between the drawing spreads in patches).
   */
  draw(f: Frame, src: THREE.Texture, o?: Partial<Pick<RedrawOptions, 'lines' | 'threshold' | 'hatch' | 'colour'>> & { amount?: number }): void
}

export function redraw(ctx: MountContext, o: RedrawOptions = {}): Redraw {
  const base = {
    lines: o.lines ?? 14, thresh: o.threshold ?? 0.35, phi: o.phi ?? 4, spread: o.spread ?? 2, levels: o.levels ?? 5, wash: o.wash ?? 0.34,
    hatch: o.hatch ?? 1, gap: o.gap ?? 5.5, colour: o.colour ?? 0,
    paper: linearRGB(o.paper ?? '#F2EEE4'), inkC: linearRGB(o.ink ?? '#141210'),
  }
  const boil = Math.max(1, o.boil ?? 2)
  const pass = fsPass(ctx, REDRAW, { blend: 'replace', uniforms: { ...base, src: new THREE.Texture(), bk: 0, jitter: 0.8, amount: 1 } })
  return {
    pass,
    draw(f, src, p = {}) {
      pass.draw(f, {
        src, bk: Math.floor(f.frame / boil), amount: p.amount ?? 1,
        lines: p.lines ?? base.lines, thresh: p.threshold ?? base.thresh, hatch: p.hatch ?? base.hatch, colour: p.colour ?? base.colour,
      })
    },
  }
}

// ── film: the projected print ───────────────────────────────────────────────────────────────────
export interface FilmOptions {
  /** Overall wear, 0..1; scales flicker, softness, scratches, dust, weave and grain (default 0.6). */
  strength?: number
  grain?: number
  flicker?: number
  scratches?: number
  /** Dust, hairs and the rare blotch (default 1). */
  dust?: number
  /** Gate weave in px at strength 1, and the rare perforation jump (default 1). */
  weave?: number
  /** Glow around highlights (default 1). */
  halation?: number
  vignette?: number
  /** 0 = silver print, 1 = sepia toned (default 0.12). */
  sepia?: number
  /** Print density endpoints, display 0..1 (defaults 0.055, 0.93). */
  black?: number
  white?: number
  /** S-curve amount (default 0.5). */
  contrast?: number
  /** Source colour kept, 0..1: 0 = monochrome print (default 0). */
  colour?: number
  /** Picture aspect inside the stage, pillarboxed in black; 0 = full frame (default 4/3). */
  gate?: number
  /** Projection speed: weave, flicker and damage change this many times a second (default 18). */
  fps?: number
}

export interface FilmFrame {
  /** Overrides FilmOptions.strength for this frame. */
  strength?: number
  exposure?: number
  /** The print burning through, 0..1, from `burnAt` (logical px; default the centre). */
  burn?: number
  burnAt?: readonly [number, number]
  /** Iris: 1 open (default), 0 closed, on `irisAt` (logical px; default the centre). */
  iris?: number
  irisAt?: readonly [number, number]
  /** A dyed print, the whites included: e.g. amber '#E9B35A' for lamplight, blue '#6F8FC8' for night. */
  tint?: string
  /** 0..1 of the tint (default 1 when `tint` is set). */
  tintAmount?: number
  /** Fade to black, 0..1. */
  fade?: number
}

const FILM = glsl`${lib.fbm}${lib.hash}
uniform sampler2D src;
uniform float strength, grainK, flickerK, scratchK, dustK, weaveK, halK, vigK, sepia, black, white, con, colour, gate, fps;
uniform float exposure, burn, iris, tintK, fade;
uniform vec2 burnAt, irisAt;
uniform vec3 tint;

vec3 S(vec2 uv) { return toSRGB(texture(src, uv).rgb); }

void main() {
  vec2 q = vec2(vUv.x, 1.0 - vUv.y) * logical;
  vec2 tx = 1.0 / logical;
  float F = floor(t * fps + 1e-4), k = strength;
  float gw = gate > 0.0 ? min(logical.x, logical.y * gate) : logical.x;
  float gx0 = 0.5 * (logical.x - gw);
  vec2 pq = vec2((q.x - gx0) / gw, q.y / logical.y);
  if (pq.x < 0.0 || pq.x > 1.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  vec2 w = vec2(sin(F * 0.71) + 0.5 * sin(F * 1.93 + 1.3), sin(F * 0.53 + 0.7) + 0.6 * sin(F * 2.41)) * vec2(0.93, 1.0) * weaveK * k;
  w.y += step(0.985, hash11(F * 1.37 + 3.1)) * 4.0 * weaveK * k;
  vec2 uv = vUv - vec2(w.x, -w.y) * tx;

  vec3 c = S(uv);
  vec3 soft = 0.25 * (S(uv + vec2(tx.x, 0.0)) + S(uv - vec2(tx.x, 0.0)) + S(uv + vec2(0.0, tx.y)) + S(uv - vec2(0.0, tx.y)));
  c = mix(c, soft, 0.45 * k);
  float L = luma(c);
  if (halK > 0.0) {
    float hb = 0.0;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * TAU / 12.0, r = i % 2 == 0 ? 7.0 : 14.0;
      hb += luma(S(uv + vec2(cos(a), sin(a)) * r * tx));
    }
    L += halK * 0.4 * max(0.0, hb / 12.0 - 0.55) * 1.8;
  }
  float L0 = max(luma(c), 1e-3);

  float flick = 1.0 + ((hash11(F * 0.913 + 0.17) - 0.5) * 0.09 + sin(F * 1.9) * 0.025 + sin(F * 0.37) * 0.02) * flickerK * k * 1.6;
  L *= exposure * flick;
  L += (vfbm(pq * vec2(3.0 * gw / logical.y, 3.0) + vec2(F * 0.37, F * 0.11), 3) - 0.44) * 0.2 * k;
  L = clamp(L, 0.0, 1.0);
  L = mix(L, smoothstep(0.0, 1.0, L), con);
  L = mix(black, white, L);

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float life = floor((F + fi * 17.0) / (5.0 + fi * 3.0));
    if (hash11(life * 7.13 + fi) <= 1.0 - scratchK * k * (0.55 - fi * 0.1)) continue;
    float x = gx0 + hash11(life * 3.71 + fi * 1.9) * gw + sin(F * 0.9 + fi) * 2.0;
    float wpx = 0.8 + hash11(life + fi * 5.0) * 1.2;
    float on = step(0.35, vnoise(vec2(q.y * 0.012 + life * 3.0, fi * 7.0)));
    float d = (1.0 - smoothstep(0.0, wpx, abs(q.x - x))) * on;
    L += d * (hash11(life * 1.7 + fi * 2.3) > 0.5 ? 0.6 : -0.45);
  }
  for (int i = 0; i < 14; i++) {
    vec3 h = hash33(vec3(F, float(i), 3.7));
    if (h.z > dustK * k * 0.9) continue;
    vec2 p = vec2(gx0 + h.x * gw, h.y * logical.y);
    float r = 1.0 + 3.5 * hash11(F * 0.31 + float(i) * 1.7);
    vec2 d = q - p;
    float rr = r * (0.6 + 0.7 * vnoise(d * 0.5 + float(i) * 13.0));
    float m = 1.0 - smoothstep(rr - 0.8, rr + 0.4, length(d));
    L = mix(L, hash11(float(i) + F * 2.1) < 0.35 ? 0.95 : 0.04, m);
  }
  float hl = floor(F / 11.0);
  if (hash11(hl * 5.31) < dustK * k * 0.7) {
    vec2 h0 = vec2(gx0 + hash11(hl * 1.1) * gw, hash11(hl * 2.3) * logical.y);
    float y = q.y - h0.y, len = 60.0 + 120.0 * hash11(hl * 3.7);
    if (y > 0.0 && y < len) {
      float cx = h0.x + 14.0 * sin(y * 0.03 + hl) + 5.0 * sin(y * 0.09 + F * 0.4);
      L = mix(L, 0.05, (1.0 - smoothstep(0.5, 1.4, abs(q.x - cx))) * 0.85);
    }
  }
  if (hash11(F * 0.77 + 9.1) < 0.05 * dustK * k) {
    vec2 b = vec2(gx0 + hash11(F * 1.3) * gw, hash11(F * 2.9) * logical.y);
    float e = length(q - b) / (40.0 + 60.0 * hash11(F * 4.1)) + 0.35 * vfbm((q - b) * 0.02 + F, 3);
    L = mix(L, L * 0.55, (1.0 - smoothstep(0.8, 1.0, e)) * 0.7);
  }

  vec2 vq = (pq - 0.5) * vec2(gw / logical.y, 1.0);
  L *= 1.0 - smoothstep(0.10, 0.62, length(vq) * 0.85) * 0.62 * vigK;

  float g1 = hash13(vec3(floor(q * scale / 1.5), F)) - 0.5;
  float g2 = hash13(vec3(floor(q * scale / 3.0), F + 91.0)) - 0.5;
  L += (g1 * 0.6 + g2 * 0.4) * grainK * k * 0.22 * (0.35 + 2.6 * L * (1.0 - L));
  L = clamp(L, 0.0, 1.0);

  vec3 sep = L < 0.5 ? mix(vec3(0.105, 0.07, 0.045), vec3(0.62, 0.50, 0.37), L * 2.0)
                     : mix(vec3(0.62, 0.50, 0.37), vec3(0.97, 0.92, 0.82), L * 2.0 - 1.0);
  vec3 col = mix(vec3(L) * vec3(0.985, 1.0, 1.015), sep, sepia);
  col = mix(col, c * (L / L0), colour);
  col *= mix(vec3(1.0), tint, tintK);

  if (burn > 0.0) {
    float n = length(q - burnAt) / logical.y + 0.12 * fbm(q * 0.008 + vec2(0.0, F * 0.05), 4);
    float front = burn * 1.1 - 0.05;
    col = mix(col, col * vec3(0.72, 0.48, 0.28), (1.0 - smoothstep(front, front + 0.1, n)) * 0.85);
    col = mix(col, vec3(1.0, 0.62, 0.2), 1.0 - smoothstep(0.0, 0.012, abs(n - front)));
    col = mix(col, vec3(1.0, 0.97, 0.9), 1.0 - smoothstep(front - 0.012, front - 0.004, n));
  }
  if (iris < 1.0) {
    float r = iris * 1.15 * length(vec2(gw, logical.y));
    col *= 1.0 - smoothstep(r - 1.5, r + 1.5, length(q - irisAt));
  }
  col *= 1.0 - fade;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

export interface FilmPost {
  readonly pass: FsPass
  /** Print the compositor's frame as film onto its layer and release the target (like `post.apply`). */
  apply(f: Frame, comp: Hdr, p?: FilmFrame): void
}

export function film(ctx: MountContext, o: FilmOptions = {}): FilmPost {
  const centre = [ctx.stage.w / 2, ctx.stage.h / 2] as const
  const pass = fsPass(ctx, FILM, {
    blend: 'replace',
    uniforms: {
      src: new THREE.Texture(),
      grainK: o.grain ?? 1, flickerK: o.flicker ?? 1, scratchK: o.scratches ?? 1, dustK: o.dust ?? 1, weaveK: o.weave ?? 1,
      halK: o.halation ?? 1, vigK: o.vignette ?? 1, sepia: o.sepia ?? 0.12, black: o.black ?? 0.055, white: o.white ?? 0.93,
      con: o.contrast ?? 0.5, colour: o.colour ?? 0, gate: o.gate ?? 4 / 3, fps: o.fps ?? 18,
    },
  })
  return {
    pass,
    apply(f, comp, p = {}) {
      const src = comp.texture
      comp.layer.draw(() => pass.draw(f, {
        src, strength: p.strength ?? o.strength ?? 0.6, exposure: p.exposure ?? 1,
        burn: p.burn ?? 0, burnAt: [...(p.burnAt ?? centre)], iris: p.iris ?? 1, irisAt: [...(p.irisAt ?? centre)],
        tint: p.tint ? srgb(p.tint) : [1, 1, 1], tintK: p.tint ? (p.tintAmount ?? 1) : 0, fade: p.fade ?? 0,
      }, { into: null }))
      comp.end()
    },
  }
}

// ── crt: a tube fed by a worn tape ──────────────────────────────────────────────────────────────
export interface CrtOptions {
  /** Scanline depth (default 0.5). */
  scanlines?: number
  /** RGB aperture-grille stripes (default 0.25). */
  mask?: number
  /** Phosphor glow around highlights (default 0.6). */
  glow?: number
  /** VHS chroma smear and delay, logical px (defaults 6 and 2); 0, 0 for a clean broadcast. */
  bleed?: number
  shift?: number
  /** Tape tracking: line tearing and a rolling noise band, 0..1 (default 0.25). */
  tracking?: number
  /** Head-switching tear in the bottom 6 % (default 1). */
  head?: number
  noise?: number
  saturation?: number
  contrast?: number
  /** Darkened corners (default 0.35). */
  corners?: number
  flicker?: number
}

export interface CrtFrame {
  /** Power: 0 off, 0..0.35 a line opening sideways, 0.35..1 opening vertically, 1 on (default). */
  on?: number
  tracking?: number
  noise?: number
}

const CRT = glsl`${lib.common}${lib.hash}
uniform sampler2D src;
uniform float scan, mask, glow, bleed, shiftPx, tracking, head, noiseK, sat_, con, corners, flick, on;

vec3 S(vec2 uv) { return toSRGB(texture(src, clamp(uv, 0.0, 1.0)).rgb); }
vec3 toYC(vec3 c) { float y = dot(c, vec3(0.299, 0.587, 0.114)); return vec3(y, (c.b - y) * 0.565, (c.r - y) * 0.713); }
vec3 fromYC(vec3 v) { return vec3(v.x + 1.403 * v.z, v.x - 0.344 * v.y - 0.714 * v.z, v.x + 1.773 * v.y); }

void main() {
  float onK = clamp(on, 0.0, 1.0);
  if (onK <= 0.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 q = vec2(vUv.x, 1.0 - vUv.y) * logical;
  vec2 tx = 1.0 / logical;
  float Fr = float(frame);
  float hx = smoothstep(0.0, 0.35, onK), vy = smoothstep(0.35, 1.0, onK);
  vec2 cq = abs(vUv - 0.5);
  float vis = step(cq.x, hx * 0.5) * step(cq.y, max(vy * 0.5, 1.5 * tx.y));
  vec2 uv = vec2(vUv.x, 0.5 + (vUv.y - 0.5) / max(vy, 0.004));

  float yb = q.y / logical.y;
  float line = floor(q.y / 2.0);
  float tear = (hash12(vec2(line, Fr)) - 0.5) * tracking * 3.0;
  float bc = fract(t * 0.11 + 0.3) * 1.3 - 0.15;
  float band = exp(-pow((yb - bc) / 0.035, 2.0)) * tracking;
  tear += band * (hash12(vec2(line * 0.5, Fr + 3.0)) - 0.3) * 40.0;
  float hs = smoothstep(0.94, 1.0, yb) * head;
  tear += hs * (18.0 + 10.0 * hash11(Fr + line * 0.1));
  uv.x -= tear * tx.x;

  float Y = 0.5 * toYC(S(uv)).x + 0.25 * toYC(S(uv + vec2(tx.x, 0.0))).x + 0.25 * toYC(S(uv - vec2(tx.x, 0.0))).x;
  vec2 C = vec2(0.0);
  for (int i = -3; i <= 3; i++) C += toYC(S(uv + vec2((float(i) * bleed / 3.0 - shiftPx) * tx.x, 0.0))).yz;
  vec3 c = fromYC(vec3(Y, C / 7.0));

  vec3 gs = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * TAU / 12.0 + 0.3, r = i % 2 == 0 ? 5.0 : 12.0;
    gs += max(S(uv + vec2(cos(a), sin(a)) * r * tx) - 0.45, 0.0);
  }
  c += glow * gs / 12.0 * vec3(1.0, 0.85, 0.75) * 1.4;
  float l = luma(c);
  c = mix(vec3(l), c, sat_);
  c = mix(c, smoothstep(0.0, 1.0, sat(c)), con);
  c += (hash13(vec3(floor(q * scale), Fr)) - 0.5) * (noiseK + band * 0.5 + hs * 0.4);

  float ph = 0.5 + 0.5 * cos(TAU * q.y / 3.0);
  c *= 1.0 - scan * (1.0 - ph) * (1.0 - 0.6 * luma(sat(c)));
  float sx = mod(floor(q.x), 3.0);
  vec3 m = vec3(sx == 0.0 ? 1.0 : 0.0, sx == 1.0 ? 1.0 : 0.0, sx == 2.0 ? 1.0 : 0.0);
  c *= mix(vec3(1.0), 0.55 + 0.9 * m, mask);
  c *= 1.0 - corners * smoothstep(0.7, 1.45, length((vUv - 0.5) * 2.0 * vec2(1.0, 0.9)));
  c *= 1.0 + flick * (hash11(Fr * 0.37) - 0.5);
  c *= vis * (1.0 + 2.0 * (1.0 - vy));
  fragColor = vec4(sat(c), 1.0);
}`

export interface CrtPost {
  readonly pass: FsPass
  /** Show the compositor's frame on the tube and release the target (like `post.apply`). */
  apply(f: Frame, comp: Hdr, p?: CrtFrame): void
}

export function crt(ctx: MountContext, o: CrtOptions = {}): CrtPost {
  const pass = fsPass(ctx, CRT, {
    blend: 'replace',
    uniforms: {
      src: new THREE.Texture(),
      scan: o.scanlines ?? 0.5, mask: o.mask ?? 0.25, glow: o.glow ?? 0.6, bleed: o.bleed ?? 6, shiftPx: o.shift ?? 2,
      head: o.head ?? 1, sat_: o.saturation ?? 1, con: o.contrast ?? 0.25, corners: o.corners ?? 0.35, flick: o.flicker ?? 0.03,
    },
  })
  return {
    pass,
    apply(f, comp, p = {}) {
      const src = comp.texture
      comp.layer.draw(() => pass.draw(f, {
        src, on: p.on ?? 1, tracking: p.tracking ?? o.tracking ?? 0.25, noiseK: p.noise ?? o.noise ?? 0.06,
      }, { into: null }))
      comp.end()
    },
  }
}
