// The cut: a car's design borrows from animals. After Muybridge's horse becomes the car, each
// chapter takes one animal, traces the feature in red, and lands the trace on the car across the
// cut (spine → haunch and roofline, eye → headlight, body → profile, wing → airflow). Sections
// follow the song (Mixkit "Need for speed", Arulo; excerpt from 6.43 s); cuts come from the beat grid
// snapped to drum hits; in each chapter the pattern and the specs line up one to one.
import { cutSections, tiers, type Section as CutRule, type SectionShot } from '../../kits/beatcut.js'
import type { Mode } from './lib/look.js'
import hitsFile from './build/hits.json'

export const DUR = hitsFile.dur
export const HITS = tiers(hitsFile.hits)
export const BEAT = 60 / hitsFile.tempo

/** Section boundaries, seconds into the excerpt (from build/hits.json and the spectrogram). */
export const T = {
  roll: 5.57,          // the intro's 16th snare roll
  drop: 6.86,          // I EQUUS
  stop: 20.9,          // the drums stop for a bar: the gallop freezes
  machine: 22.72,      // hats return: the car is revealed
  kick: 25.07,         // the first kick: II FELIS
  oculus: 30.86,       // III OCULUS
  squalus: 36.0,       // IV SQUALUS
  ala: 41.15,          // V ALA
  chimera: 48.0,       // VI CHIMERA: the recap
  // three bars (53.149–58.292 in the source excerpt) are cut out of the song (make.sh --cut)
  gallop: 53.149,      // the car runs back into a horse
  finale: 55.287,      // the closing snare roll
  card: 56.578,        // the downbeat: end card
} as const

export type Kind =
  | 'plate' | 'rollgrid' | 'horse' | 'muybridge' | 'clip' | 'mirror' | 'transit'
  | 'car' | 'dragonfly' | 'flock' | 'windtunnel' | 'eyes' | 'pair' | 'cloud' | 'card' | 'chimera'

/** A red contour carried across a cut: on the animal, then on the car. */
export type Trace = 'spine' | 'body' | 'eye' | 'flow'

export interface Spec {
  kind: Kind
  /** Footage ids (clips.json); `pair` uses two (or `clip` + a 3D `view`). */
  clip?: string
  clip2?: string
  /** Camera view for 3D kinds: side, front, top, rear34, wheel, haunch, reveal… */
  view?: string
  mode?: Mode
  /** Framing on the black stage: the full frame, a small window, a band. */
  frame?: 'full' | 'window' | 'band' | 'tall'
  trace?: Trace
  /** Hold the footage on the trace's frame (a freeze on the hit). */
  freeze?: boolean
  /** A caption for this shot (a fact), shown under the slate. */
  note?: string
}

export interface Section extends CutRule {
  title: string
  latin: string
  /** The borrowed feature, shown when the chapter opens. */
  feature?: string
  specs: Spec[]
}

const chapter = (id: string, title: string, latin: string, feature: string, at: number, end: number, shots: [number, Spec][]): Section =>
  ({ id, title, latin, feature, at, end, min: 0.2, pattern: shots.map((s) => s[0]), specs: shots.map((s) => s[1]) })

export const SECTIONS: Section[] = [
  {
    id: 'intro', title: '0 · 1878', latin: 'PALO ALTO', at: 0, end: T.drop, pattern: [64], cuts: [T.roll],
    specs: [{ kind: 'plate' }, { kind: 'rollgrid' }],
  },
  // I: few long shots; the 3D horse runs across the ground in one travelling shot, then the real
  // horses, each clip once, then the horse turns to points and runs into the stop
  chapter('equus', 'I · EQUUS', 'EQUUS FERUS CABALLUS', 'THE MEASURE', T.drop, T.stop, [
    [8, { kind: 'horse', view: 'travel', mode: 'dots', note: 'ONE STRIDE PER BEAT · 140 BPM ≈ 2.33 STRIDES/S' }],
    [4, { kind: 'clip', clip: 'horses-run', mode: 'dither' }],
    [4, { kind: 'clip', clip: 'rider-beach', mode: 'clean', note: '1 HP = 745.7 W · J. WATT, 1782' }],
    [2, { kind: 'muybridge', frame: 'band' }],
    [2, { kind: 'clip', clip: 'horse-eye', mode: 'clean' }],
    [4, { kind: 'clip', clip: 'horse-white', mode: 'dither', note: 'CAVALLINO RAMPANTE · F. BARACCA → E. FERRARI, 1923' }],
    [8.75, { kind: 'cloud', view: 'horse' }],
  ]),
  { id: 'stop', title: 'TRANSIT', latin: 'ALL FOUR HOOVES OFF THE GROUND', at: T.stop, end: T.machine, pattern: [64], specs: [{ kind: 'transit' }] },
  { id: 'reveal', title: 'MACHINA', latin: '458 · 4497 CC · 570 CV', at: T.machine, end: T.kick, pattern: [64], specs: [{ kind: 'car', view: 'reveal' }] },
  chapter('felis', 'II · FELIS', 'ACINONYX JUBATUS', 'THE HAUNCH', T.kick, T.oculus, [
    [3, { kind: 'clip', clip: 'cheetah-hunt', mode: 'clean', trace: 'spine', freeze: true, note: 'A CAT CROUCHED TO SPRING · 0–100 KM/H ≈ 3 S' }],
    [3, { kind: 'car', view: 'side', trace: 'spine', note: 'THE HAUNCH: THE REAR ARCH, TENSED' }],
    [2, { kind: 'clip', clip: 'car-road', mode: 'clean' }],
    [2, { kind: 'clip', clip: 'lion-head', mode: 'clean', frame: 'window' }],
    [2, { kind: 'car', view: 'haunch' }],
    [1.5, { kind: 'clip', clip: 'car-macro', mode: 'clean' }],
  ]),
  chapter('oculus', 'III · OCULUS', 'AQUILA · STRIX · FELIS', 'THE FACE', T.oculus, T.squalus, [
    [2, { kind: 'clip', clip: 'eagle-eye', mode: 'clean', trace: 'eye', freeze: true, note: 'A FACE READS AS A FACE: TWO EYES, A MOUTH' }],
    [2, { kind: 'clip', clip: 'car-pan', mode: 'clean', trace: 'eye' }],
    [1, { kind: 'clip', clip: 'owl-eye', mode: 'dither', trace: 'eye' }],
    [1, { kind: 'car', view: 'front', trace: 'eye' }],
    [2, { kind: 'clip', clip: 'cat-black', mode: 'clean', trace: 'eye' }],
    [4, { kind: 'eyes' }],
  ]),
  chapter('squalus', 'IV · SQUALUS', 'ISURUS · GINGLYMOSTOMA', 'THE SKIN', T.squalus, T.ala, [
    [3, { kind: 'clip', clip: 'shark', mode: 'clean', trace: 'body', freeze: true, note: 'XP-755 MAKO SHARK · B. MITCHELL / L. SHINODA, 1961' }],
    [3, { kind: 'car', view: 'side', trace: 'body', note: 'DENTICLE RIBLETS: −8–10 % SKIN DRAG' }],
    [2, { kind: 'clip', clip: 'car-rear', mode: 'clean' }],
    [2, { kind: 'mirror', view: 'car', mode: 'ascii' }],
    [2, { kind: 'car', view: 'top', mode: 'clean' }],
  ]),
  chapter('ala', 'V · ALA', 'ANISOPTERA', 'THE AIR', T.ala, T.chimera, [
    [3, { kind: 'dragonfly', view: 'side', trace: 'flow', note: 'PTEROSTIGMA: A WEIGHT AT THE TIP DAMPS FLUTTER' }],
    [3, { kind: 'windtunnel', view: 'side', trace: 'flow', note: 'AIR OVER A WING · AIR OVER A ROOF' }],
    [2, { kind: 'clip', clip: 'dragonfly-grass', mode: 'dither' }],
    [2, { kind: 'dragonfly', view: 'top' }],
    [2, { kind: 'clip', clip: 'eagle-glide', mode: 'clean' }],
    [2, { kind: 'flock', mode: 'ascii' }],
    [2, { kind: 'dragonfly', view: 'front', note: '30 WINGBEATS A SECOND' }],
  ]),
  // VI: every borrowed feature lands on one car
  chapter('chimera', 'VI · CHIMERA', 'EVERY MACHINE REMEMBERS AN ANIMAL', 'THE SUM', T.chimera, T.gallop, [
    [12, { kind: 'chimera', view: 'side' }],
  ]),
  { id: 'gallop', title: 'VI · CHIMERA', latin: 'EVERY MACHINE REMEMBERS AN ANIMAL', at: T.gallop, end: T.finale, pattern: [64], specs: [{ kind: 'cloud', view: 'gallop' }] },
  {
    id: 'end', title: 'LOCOMOTION', latin: 'MOTION STUDY', at: T.finale, end: DUR, pattern: [64], cuts: [T.card - T.finale],
    specs: [{ kind: 'rollgrid' }, { kind: 'card' }],
  },
]

export interface Plan { shot: SectionShot; section: Section; spec: Spec; prev: Plan | null }

// snap half a beat: this groove puts many kicks on the 'and', and a cut should land on the kick
const RAW = cutSections(SECTIONS, { beats: hitsFile.beats, hits: HITS, dur: DUR, min: 0.4, tail: 0.3, snap: 0.22 })
// a chapter has exactly its specs: a cut past the last one (the pattern's tail) joins the shot before
export const SHOTS: SectionShot[] = []
for (const shot of RAW) {
  const sec = SECTIONS.find((x) => x.id === shot.section)!
  const prev = SHOTS[SHOTS.length - 1]
  if (shot.n >= sec.specs.length && prev && prev.section === shot.section) { prev.end = shot.end; prev.hits.push(...shot.hits); continue }
  SHOTS.push({ ...shot, i: SHOTS.length, hits: [...shot.hits] })
}
export const PLANS: Plan[] = []
for (const shot of SHOTS) {
  const section = SECTIONS.find((s) => s.id === shot.section)!
  PLANS.push({ shot, section, spec: section.specs[shot.n]!, prev: PLANS[PLANS.length - 1] ?? null })
}

export const CLIPS = [...new Set(PLANS.flatMap((p) => [p.spec.clip, p.spec.clip2]).filter((c): c is string => !!c))]
