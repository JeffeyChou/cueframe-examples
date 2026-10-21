// Material presets for texture.ts: each is `(fill, options) → Material`, in material units (pass
// `unit` to `material()` to fit a rig drawn at another size). Tones derive from the fill.
// Design: cueframe/docs/design/materials.md.

import { inkFor, type Material } from './texture.js'

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
/** `a` moved toward `b` by t (both #rrggbb). */
export function mix(a: string, b: string, t: number): string {
  const p = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
  const x = p(a), y = p(b)
  return '#' + x.map((v, i) => hex(v + (y[i]! - v) * t)).join('')
}
const darker = (fill: string, t: number) => mix(fill, '#000000', t)
const dark = (fill: string) => inkFor(fill) !== '#1F1C1B'
/** Light from the top left, the default for the lit presets. */
const TOP_LEFT = 225

export interface PaperOpts {
  stock?: 'speckle' | 'fibre'
  edge?: 'print' | 'cut'
  /** The shape's size in material units; the edge's wander scales with it. Default 100. */
  size?: number
  /** Pins the seeds of art made before materials (the editing-village slice's paperShape). */
  seed?: number
}

/**
 * Printed paper, as in the editing-village slice: an edge slightly off true ('print', a faint
 * wobble) or a scissor-cut wander ('cut'), and paper flecks (on dark fills cream flecks, on light
 * ones ink flecks) or fibres.
 */
export function paper(fill: string, o: PaperOpts = {}): Material {
  const size = o.size ?? 100, stock = o.stock ?? 'speckle'
  const edge = o.edge === 'cut'
    ? { amp: Math.min(3, Math.max(0.8, size * 0.007)), wavelength: Math.min(60, Math.max(16, size * 0.12)) }
    : { amp: Math.min(1.6, Math.max(0.35, size * 0.004)), wavelength: Math.min(18, Math.max(6, size * 0.05)) }
  const fibre = stock === 'fibre'
  const opacity = fibre ? (dark(fill) ? 0.22 : 0.16) : dark(fill) ? 0.16 : 0.1
  return {
    edge: { ...edge, ...(o.seed !== undefined ? { seed: o.seed } : {}) },
    layers: [{
      id: stock, tone: inkFor(fill), opacity,
      ...(o.seed !== undefined ? { seed: `${stock}:${o.seed}` } : {}),
      scatter: fibre ? { mark: 'fibre', density: 60 * 1.2, width: 0.6 } : { mark: 'dot', density: 140 * 0.9 },
    }],
  }
}

export interface LitOpts { light?: number; tone?: string }

/** Comic halftone: a rotated grid of discs, small on the lit side, large away from it. */
export function halftone(fill: string, o: LitOpts & { spacing?: number; angle?: number } = {}): Material {
  const spacing = o.spacing ?? 6
  return {
    light: { deg: o.light ?? TOP_LEFT },
    layers: [{ id: 'dots', tone: o.tone ?? darker(fill, 0.45), opacity: 0.9, scatter: { mark: 'disc', layout: { grid: { spacing, angle: o.angle ?? 45 } }, size: { light: { lo: spacing * 0.08, hi: spacing * 0.42 } } } }],
    ink: { tone: o.tone ?? '#1F1C1B', width: 1.4, amp: 0.15, wavelength: 20 },
  }
}

/** Engraving: hatching at 45° over the shape, cross-hatching at −45° on the side away from the light. */
export function engraving(fill: string, o: LitOpts & { spacing?: number } = {}): Material {
  const spacing = o.spacing ?? 3.2, tone = o.tone ?? darker(fill, 0.7)
  return {
    edge: { amp: 0.5, wavelength: 10 },
    light: { deg: o.light ?? TOP_LEFT },
    layers: [
      { id: 'hatch', tone, opacity: 0.8, hatch: { angle: 45, spacing, wobble: { amp: 0.25, wavelength: 14 }, width: 0.6, keep: { field: { light: { lo: 0, hi: 1 } }, above: 0.15 } } },
      { id: 'cross', tone, opacity: 0.8, hatch: { angle: -45, spacing, wobble: { amp: 0.25, wavelength: 14 }, width: 0.55, keep: { field: { light: { lo: 0, hi: 1 } }, above: 0.55 } } },
    ],
    ink: { tone: '#1F1C1B', width: 1.1, passes: 1, amp: 0.4, wavelength: 10 },
  }
}

/** Flat illustration: a soft gradient from the lit side, and a darker band on the side away from the
 * light, which follows `light()` (the gradient is baked: it turns with the shape). */
export function flat(fill: string, o: LitOpts & { depth?: number; gradient?: boolean } = {}): Material {
  return {
    light: { deg: o.light ?? TOP_LEFT },
    layers: [
      ...(o.gradient === false ? [] : [{ id: 'gradient', gradient: { deg: 'light' as const, stops: [[0, mix(fill, '#ffffff', 0.18), 1], [1, darker(fill, 0.1), 1]] as const } }]),
      { id: 'shade', tone: o.tone ?? darker(fill, 0.35), opacity: 1, shade: { depth: o.depth ?? 8 } },
    ],
  }
}

/** Chalk on a board: a broken short-wavelength edge, and the board showing through in streaks along
 * the stroke (`angle`, degrees, default −20) where the chalk skipped the grain. `ground` is the board. */
export function chalk(fill: string, o: { ground?: string; angle?: number } = {}): Material {
  const ground = o.ground ?? '#2B2E2C', angle = o.angle ?? -20
  return {
    edge: { amp: 1.1, wavelength: 4 },
    layers: [
      { id: 'skips', tone: ground, opacity: 0.7, scatter: { mark: 'dash', layout: 'even', density: 360, size: 0.7, width: 0.8, angle } },
      { id: 'drag', tone: ground, opacity: 0.45, hatch: { angle, spacing: 1.6, jitter: 0.7, width: 0.45, dash: [2.5, 4], wobble: { amp: 0.3, wavelength: 9 } } },
      { id: 'dust', tone: mix(fill, '#ffffff', 0.6), opacity: 0.5, scatter: { mark: 'dot', layout: 'random', density: 300, size: 0.6 } },
    ],
  }
}

/** Felt: a soft, slow edge, dense fibres in a lighter and a darker tone, faint mottling. */
export function felt(fill: string): Material {
  return {
    edge: { amp: 1.4, wavelength: 26 },
    layers: [
      { id: 'mottle', tone: darker(fill, 0.25), opacity: 0.12, scatter: { mark: 'blotch', layout: 'even', density: 30, size: 2.2 } },
      { id: 'dark', tone: darker(fill, 0.35), opacity: 0.55, scatter: { mark: 'fibre', layout: 'even', density: 320, size: 0.5, width: 0.5 } },
      { id: 'light', tone: mix(fill, '#ffffff', 0.45), opacity: 0.5, scatter: { mark: 'fibre', layout: 'even', density: 280, size: 0.5, width: 0.5 } },
    ],
  }
}

/** Wood: grain lines along `angle` (degrees, default 0), warped and a little wobbly, and a few knots. */
export function wood(fill: string, o: { angle?: number } = {}): Material {
  const tone = darker(fill, 0.35)
  return {
    edge: { amp: 0.4, wavelength: 20 },
    layers: [
      { id: 'grain', tone, opacity: 0.55, hatch: { angle: o.angle ?? 0, spacing: 3.4, jitter: 1.2, width: 0.7, wobble: { amp: 0.3, wavelength: 18 }, warp: { amp: 5, scale: 45 } } },
      { id: 'knots', tone: darker(fill, 0.45), opacity: 0.45, scatter: { mark: 'blotch', layout: 'random', density: 1.2, size: 1.1 } },
    ],
  }
}
