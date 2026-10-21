// Where the subject sits in each clip's plate (0..1, at about 1.5 s): eyes, lights, vanishing
// points. Pairs and the eye grid crop around these so an eye and a headlight land on the same spot.
import { cover, type Rect } from './look.js'
import type { Kit } from './kit.js'

export const FOCUS: Record<string, [number, number]> = {
  'horse-eye': [0.31, 0.37], 'eagle-eye': [0.48, 0.39], 'owl-eye': [0.34, 0.25], 'chameleon': [0.56, 0.25],
  'lion-head': [0.6, 0.38], 'cat-black': [0.5, 0.5], 'cat-blue-eyes': [0.5, 0.5], 'snake-head': [0.55, 0.78],
  'car-pan': [0.55, 0.55], 'car-rear': [0.11, 0.42], 'car-macro': [0.75, 0.75], 'night-drive': [0.42, 0.65],
  'dash-accel': [0.53, 0.42], 'tunnel-dark': [0.47, 0.6], 'bridge-night': [0.5, 0.4], 'tunnel': [0.5, 0.55],
  'shark': [0.55, 0.53], 'cheetah-hunt': [0.3, 0.5], 'horses-run': [0.5, 0.6], 'car-road': [0.2, 0.5],
  'cars-race': [0.45, 0.6], 'dash-city': [0.7, 0.55], 'city-aerial': [0.5, 0.5], 'eagle-glide': [0.4, 0.38],
}

/** Paint the clip's frame `n` into board rect `to`, cropped around its focus at `zoom` for the aspect of `to`. */
export function paintFocus(k: Kit, id: string, n: number, to: Rect, zoom: number, flip = false): void {
  const s = k.clips[id]!
  const [fx, fy] = FOCUS[id] ?? [0.5, 0.5]
  const c = cover(s.w / s.h, to.w / to.h, fx, fy, zoom)
  const g = k.board.g
  g.save()
  if (flip) { g.translate(to.x * 2 + to.w, 0); g.scale(-1, 1) }
  g.drawImage(s.image(n), c.x * s.w, c.y * s.h, c.w * s.w, c.h * s.h, to.x, to.y, to.w, to.h)
  g.restore()
}
