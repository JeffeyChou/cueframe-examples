// The cut: six sections of the song (Mixkit "Slow Rain", 6.86–66.06 s), each with its own cut rate,
// window grammar, clips and overlay density. Shots come from the beat grid and the drum hits.
import { cutSections, tiers, DUO, type Duotone, type Section as CutRule, type SectionShot, type WindowKind } from '@cueframe/recipes/beatcut.js'
import hitsFile from './build/hits.json'

export const DUR = hitsFile.dur
export const HITS = tiers(hitsFile.hits)
const BEAT = 60 / hitsFile.tempo

/** A cut rule (`pattern`: beats per shot, cycled; `cuts`: forced, seconds from the start) and the section's look. */
export interface Section extends CutRule {
  title: string
  clips: string[]
  kinds: WindowKind[]
  density: [number, number]
  grade: Duotone
}

const ORANGE: Duotone = { dark: '#16020a', light: '#ff2a3a', contrast: 1.25 }
export const SECTIONS: Section[] = [
  { id: 'calib', title: '01 CALIBRATION', at: 0, end: 6.86, pattern: [64], clips: ['clouds-dark'], kinds: ['tint'], density: [0.05, 0.3], grade: DUO.cobalt },
  {
    id: 'sky', title: '02 SKY', at: 6.86, end: 13.71, pattern: [4, 2, 2, 4],
    clips: ['clouds-moving', 'lightning-cut', 'waves-storm'], kinds: ['pip', 'sliver', 'outline'], density: [0.3, 0.45], grade: DUO.cobalt,
  },
  {
    // the snare roll: cuts every 4, then 2, then 1 beat; a still cobalt breath before the drop
    id: 'build', title: '03 PRESSURE', at: 13.71, end: 20.57, pattern: [64],
    cuts: [...[4, 6, 8, 9, 10].map((b) => b * BEAT), 6.86 - 0.62],
    clips: ['rain-dark', 'screen-rain', 'roof', 'window', 'lamp-rain', 'clouds-dark', 'lightning-city'],
    kinds: ['tint', 'sliver', 'pip', 'sliver', 'tint', 'grow', 'tint'], density: [0.45, 0.8], grade: DUO.cobalt,
  },
  {
    id: 'drop', title: '04 RAINFALL', at: 20.57, end: 34.28, pattern: [2, 2, 1, 1, 2, 4, 1, 0.5, 0.5, 2, 4], min: 0.25,
    clips: ['lightning-city', 'times-square', 'traffic-night', 'cars-rain', 'lamp-rain', 'window', 'screen-rain', 'roof', 'rain-dark', 'city-rain', 'lightning-clouds', 'traffic-night'],
    kinds: ['pip', 'pip', 'sliver', 'tint', 'grow', 'pip', 'sliver', 'pip', 'tint', 'pip', 'sliver', 'grow'], density: [1, 1], grade: DUO.cobalt,
  },
  {
    id: 'surface', title: '05 SURFACE', at: 34.28, end: 48.0, pattern: [4, 2, 1, 1, 2, 1, 1, 4, 0.5, 0.5, 1, 2], min: 0.25,
    clips: ['puddle', 'drops-puddle', 'puddle-slow', 'drop-macro', 'leaves', 'lily', 'flowers-rain', 'reflection-house', 'reflection-men', 'umbrella-jump', 'umbrella-girl', 'umbrella-park'],
    kinds: ['pip', 'split', 'pip', 'tint', 'pip', 'split', 'sliver', 'pip', 'split', 'pip', 'tint', 'grow'], density: [0.9, 0.8], grade: DUO.steel,
  },
  {
    id: 'clear', title: '06 CLEARING', at: 48.0, end: DUR, pattern: [4],
    clips: ['gulls-silhouette', 'flock', 'gulls-sunset', 'moon'],
    kinds: ['outline', 'pip', 'letterbox', 'outline'], density: [0.45, 0.1], grade: DUO.cobalt,
  },
]

export interface Plan { shot: SectionShot; section: Section; clip: string; insert: string; kind: WindowKind; density: number; grade: Duotone; alt: Duotone }

export const SHOTS = cutSections(SECTIONS, { beats: hitsFile.beats, hits: HITS, dur: DUR, min: 0.5, tail: 0.5 })
export const PLANS: Plan[] = SHOTS.map((shot) => {
  const s = SECTIONS.find((x) => x.id === shot.section)!
  const p = shot.of > 1 ? shot.n / (shot.of - 1) : 0
  // a growing window opens onto the next shot's clip; other windows show a clip of the section
  return {
    shot, section: s, clip: s.clips[shot.n % s.clips.length]!, insert: s.clips[(shot.n + 1) % s.clips.length]!, kind: s.kinds[shot.n % s.kinds.length]!,
    density: s.density[0] + (s.density[1] - s.density[0]) * p, grade: s.grade, alt: ORANGE,
  }
})
// the grow window of the build's last shot opens onto the drop's first clip
for (let i = 0; i + 1 < PLANS.length; i++) if (PLANS[i]!.kind === 'grow') PLANS[i]!.insert = PLANS[i + 1]!.clip

export const CLIPS = [...new Set(PLANS.flatMap((p) => [p.clip, p.insert]))]

/** The breath before the drop: no footage, a cobalt field and the slate. */
export const BREATH: [number, number] = [20.57 - 0.62, 20.57]
