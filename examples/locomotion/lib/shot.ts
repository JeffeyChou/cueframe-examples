// The contract between the film scene and a shot module: a shot mounts its own three.js objects
// once, names the footage frames it needs for a frame, and draws the frame into the compositor
// through the look pass. `c` carries the music for the shot.
import type { Frame } from '@cueframe/core'
import { hitIn, pulse, type Hit } from '../../../kits/beatcut.js'
import type { Plan } from '../edit.js'
import { BEAT } from '../edit.js'
import type { Kit } from './kit.js'
import type { Poly } from './trace.js'

export interface Music {
  /** Seconds since the shot's cut. */
  lt: number
  /** 0..1 through the shot. */
  u: number
  /** Beats since the shot's cut, and the song's beat phase (0..1 in a beat). */
  beats: number
  phase: number
  kick: { k: number; since: number; hit: Hit | null; pulse: number }
  snare: { k: number; since: number; hit: Hit | null; pulse: number }
  hat: { k: number; since: number; pulse: number }
  low: number
  high: number
  /** The cut's pixel-sort glitch, decaying over a few frames: pass to look.draw as `streak`. */
  glitch: { amount: number; seed: number; dir: 0 | 1 | 2 | 3; reach: number } | undefined
}

export interface ShotCtx {
  f: Frame
  k: Kit
  plan: Plan
  m: Music
}

export interface ShotDef<S = unknown> {
  mount?(k: Kit): S | Promise<S>
  /** Footage frames this frame draws: [clip id, frame index]. */
  loads?(c: ShotCtx, s: S): [string, number][]
  draw(c: ShotCtx, s: S): void
  /** The red trace in stage px at this frame (the film morphs from the previous shot's trace). */
  trace?(c: ShotCtx, s: S): Poly[] | null
  /** UI drawn on top (logical px), after the shot. Return the text rects for audit. */
  ui?(g: CanvasRenderingContext2D, c: ShotCtx, s: S): void
}

export const defineShot = <S>(d: ShotDef<S>): ShotDef<S> => d

export function music(f: Frame, plan: Plan): Music {
  const { shot } = plan
  const t = f.t
  const kickH = hitIn(shot, t, { tier: 0, kinds: ['kick'] })
  const snareH = hitIn(shot, t, { tier: 0, kinds: ['snare'] })
  const hatH = hitIn(shot, t, { tier: 1, kinds: ['hat'] })
  const lt = t - shot.at
  const span = shot.end - shot.at
  const phase = Number.isFinite(f.beatPhase) ? f.beatPhase : (t / BEAT) % 1
  // the cut glitch: a pixel-sort smear on the first frames of a shot, and smaller on strong kicks
  const cutG = lt < 0.16 ? 1 - lt / 0.16 : 0
  const kickG = kickH.hit && kickH.hit.s > 0.8 && kickH.since < 0.1 ? 0.5 * (1 - kickH.since / 0.1) : 0
  const g = Math.max(cutG, kickG)
  const seed = shot.i * 13 + (kickG > cutG ? kickH.k * 7 + 3 : 0)
  return {
    lt, u: span > 0 ? Math.min(1, lt / span) : 0, beats: lt / BEAT, phase,
    kick: { ...kickH, pulse: kickH.hit ? pulse(kickH.since, 0.14) : 0 },
    snare: { ...snareH, pulse: snareH.hit ? pulse(snareH.since, 0.16) : 0 },
    hat: { k: hatH.k, since: hatH.since, pulse: hatH.hit ? pulse(hatH.since, 0.06) : 0 },
    low: f.env('low'), high: f.env('high'),
    glitch: g > 0 ? { amount: 0.75 * g, seed, dir: (shot.i % 3 === 2 ? 2 : 0) as 0 | 2, reach: 0.25 + 0.6 * g } : undefined,
  }
}
