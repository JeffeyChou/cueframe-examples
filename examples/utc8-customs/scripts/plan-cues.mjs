// Until the narration exists: build/cues.json from the storyboard's estimated shot lengths.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const dir = new URL('..', import.meta.url).pathname
const sb = JSON.parse(readFileSync(`${dir}storyboard.json`, 'utf8'))
const cues = {}
let t = 0
for (const s of sb.shots) { cues[`scene.${s.id}.start`] = t; t += s.length; cues[`scene.${s.id}.end`] = t }
cues.total = t
mkdirSync(`${dir}build`, { recursive: true })
writeFileSync(`${dir}build/cues.json`, JSON.stringify(cues, null, 1) + '\n')
