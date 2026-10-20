// The cut: six sections of the song (Mixkit "Slow Rain", 6.86–66.06 s), each with its own cut rate,
// window grammar, clips and overlay density. Shots come from the beat grid and the drum hits.
import { cutList, tiers, type Duotone, type Shot, type WindowKind, DUO } from '@cueframe/recipes/beatcut.js'
import hitsFile from './build/hits.json'

export const DUR = hitsFile.dur
export const HITS = tiers(hitsFile.hits)
const BEATS = hitsFile.beats
const BEAT = 60 / hitsFile.tempo

export interface Section {
  id: string
  title: string
  at: number
  end: number
  /** A cut every `every` beats; `cuts` forces cuts (seconds from the section start). */
  every: number
  cuts?: number[]
  clips: string[]
  kinds: WindowKind[]
  density: [number, number]
  grade: Duotone
}

const ORANGE: Duotone = { dark: '#140400', light: '#ff6a2a', contrast: 1.25 }
export const SECTIONS: Section[] = [
  { id: 'calib', title: '01 CALIBRATION', at: 0, end: 6.86, every: 64, clips: ['clouds-dark'], kinds: ['tint'], density: [0.05, 0.3], grade: DUO.cobalt },
  {
    id: 'sky', title: '02 SKY', at: 6.86, end: 13.71, every: 4,
    clips: ['clouds-moving', 'lightning-cut', 'waves-storm'], kinds: ['pip', 'sliver', 'outline'], density: [0.3, 0.45], grade: DUO.cobalt,
  },
  {
    // the snare roll: cuts every 4, then 2, then 1 beat; a still cobalt breath before the drop
    id: 'build', title: '03 PRESSURE', at: 13.71, end: 20.57, every: 64,
    cuts: [...[4, 6, 8, 9, 10].map((b) => b * BEAT), 6.86 - 0.62],
    clips: ['rain-dark', 'screen-rain', 'roof', 'window', 'lamp-rain', 'clouds-dark', 'lightning-city'],
    kinds: ['tint', 'sliver', 'pip', 'sliver', 'tint', 'grow', 'tint'], density: [0.45, 0.8], grade: DUO.cobalt,
  },
  {
    id: 'drop', title: '04 RAINFALL', at: 20.57, end: 34.28, every: 2,
    clips: ['lightning-city', 'times-square', 'traffic-night', 'cars-rain', 'lamp-rain', 'window', 'screen-rain', 'roof', 'rain-dark', 'city-rain', 'lightning-clouds', 'traffic-night'],
    kinds: ['circle', 'pip', 'sliver', 'tint', 'grow', 'pip', 'sliver', 'circle', 'tint', 'pip', 'sliver', 'grow'], density: [1, 1], grade: DUO.cobalt,
  },
  {
    id: 'surface', title: '05 SURFACE', at: 34.28, end: 48.0, every: 2,
    clips: ['puddle', 'drops-puddle', 'puddle-slow', 'drop-macro', 'leaves', 'lily', 'flowers-rain', 'reflection-house', 'reflection-men', 'umbrella-jump', 'umbrella-girl', 'umbrella-park'],
    kinds: ['circle', 'split', 'pip', 'tint', 'circle', 'split', 'sliver', 'pip', 'split', 'circle', 'tint', 'grow'], density: [0.9, 0.8], grade: DUO.steel,
  },
  {
    id: 'clear', title: '06 CLEARING', at: 48.0, end: DUR, every: 4,
    clips: ['gulls-silhouette', 'flock', 'gull-glide', 'gulls-sunset', 'moon'],
    kinds: ['outline', 'pip', 'tint', 'letterbox', 'outline'], density: [0.45, 0.1], grade: DUO.cobalt,
  },
]

export interface Plan { shot: Shot; section: Section; n: number; clip: string; insert: string; kind: WindowKind; density: number; grade: Duotone; alt: Duotone; overlay: 'chain' | 'rays' }

function sectionShots(s: Section): Shot[] {
  const shift = (t: number) => +(t - s.at).toFixed(3)
  const shots = cutList({
    dur: s.end - s.at,
    beats: BEATS.filter((b) => b >= s.at && b < s.end).map(shift),
    hits: HITS.filter((h) => h.t >= s.at && h.t < s.end).map((h) => ({ ...h, t: shift(h.t) })),
    every: s.every, at: s.cuts, min: 0.5, tail: 0.5,
  })
  return shots.map((x) => ({ ...x, at: x.at + s.at, end: x.end + s.at, hits: x.hits.map((h) => ({ ...h, t: h.t + s.at })) }))
}

export const PLANS: Plan[] = []
for (const s of SECTIONS) {
  const shots = sectionShots(s)
  shots.forEach((shot, n) => {
    const clip = s.clips[n % s.clips.length]!
    const kind = s.kinds[n % s.kinds.length]!
    // a growing window opens onto the next shot's clip; other windows show a clip of the section
    const next = s.clips[(n + 1) % s.clips.length]!
    const p = shots.length > 1 ? n / (shots.length - 1) : 0
    PLANS.push({
      shot: { ...shot, i: PLANS.length }, section: s, n, clip, insert: next, kind,
      density: s.density[0] + (s.density[1] - s.density[0]) * p,
      grade: s.id === 'clear' && clip === 'gulls-sunset' ? ORANGE : s.grade,
      alt: ORANGE, overlay: PLANS.length % 2 ? 'rays' : 'chain',
    })
  })
}
// the grow window of the build's last shot opens onto the drop's first clip
for (let i = 0; i + 1 < PLANS.length; i++) if (PLANS[i]!.kind === 'grow') PLANS[i]!.insert = PLANS[i + 1]!.clip

export const SHOTS = PLANS.map((p) => p.shot)
export const CLIPS = [...new Set(PLANS.flatMap((p) => [p.clip, p.insert]))]

/** The breath before the drop: no footage, a cobalt field and the slate. */
export const BREATH: [number, number] = [20.57 - 0.62, 20.57]
