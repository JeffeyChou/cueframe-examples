import type { Cells, Rect } from './cells.ts'
import type { Rng } from './rng.ts'
import type { Act } from './song.ts'
import type { Layout, Win, WinId } from './ui.ts'

/** Everything a scene may read for one frame. All of it is a function of (t, frame, size). */
export interface Ctx {
  c: Cells
  t: number
  frame: number
  L: Layout
  D: Rect
  act: Act
  /** seconds into the act, and 0..1 through it */
  lt: number
  p: number
  /** glitch intensity 0..~1.2 */
  G: number
  /** musical energy 0..1 */
  E: number
  beat: { n: number; phase: number; t0: number }
  /** kick envelope 1 → 0 after each beat */
  kick: number
  spec: Float32Array<ArrayBufferLike>
  accent: number
  pal: readonly number[]
  rng: (seed: string) => Rng
  mode: 'term' | 'canvas'
}

export interface Scene {
  /** 0 = panels docked around the viewport, 1 = viewport fills the desktop. */
  dock?: (x: Ctx) => number
  /** Adjust window rects / visibility after docking. */
  wm?: (x: Ctx, ws: Record<WinId, Win>) => void
  /** Full-desktop layer behind the windows. */
  bg?: (x: Ctx) => void
  /** Inside the viewport (already clipped). */
  view?: (x: Ctx, V: Rect) => void
  /** Over the windows, still inside the desktop. */
  over?: (x: Ctx) => void
  /** Viewport frame title; null hides the frame. */
  title?: (x: Ctx) => string | null
  readouts?: (x: Ctx) => [string, string][]
  log?: (k: number) => string
  /** Extra glitch on top of the song envelope. */
  glitch?: (x: Ctx) => number
  /** 0 hides the chrome bars (boot), 1 shows them. */
  chrome?: (x: Ctx) => number
  pal?: readonly number[]
}
