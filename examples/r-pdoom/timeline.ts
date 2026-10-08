import { timeline } from '@cueframe/core'
import { BEATS, CUT, DOWNBEATS, ENTER, END, HOOK, PROMPT, archivoUrl, monoMedUrl, monoUrl } from './lib.js'
import prompt from './scenes/prompt.js'
import hook from './scenes/hook.js'

const cues: Record<string, number> = { enter: ENTER, cut: CUT, end: END }
for (const [tag, line] of [['p', PROMPT], ['h', HOOK]] as const) line.words.forEach((w, i) => { cues[`${tag}${i}`] = Math.max(0, w.t0) })

export default timeline({
  formats: { landscape: { w: 1920, h: 1080 } },
  fps: 60,
  cues,
  beats: { bpm: 132.007, offset: DOWNBEATS[0]!, perBar: 4, beats: BEATS, downbeats: DOWNBEATS },
  fonts: [
    { family: 'Archivo', src: archivoUrl, weight: '100 900' },
    { family: 'Plex Mono', src: monoUrl, weight: '400' },
    { family: 'Plex Mono', src: monoMedUrl, weight: '500' },
  ],
  scenes: [prompt, hook],
})
