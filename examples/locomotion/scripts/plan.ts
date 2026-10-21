// Print the cut: shot, time, section, kind, view/clip, mode.
import { PLANS } from '../edit.js'
for (const p of PLANS) console.log(`${String(p.shot.i).padStart(3)} ${p.shot.at.toFixed(2).padStart(6)}–${p.shot.end.toFixed(2).padStart(6)} ${p.section.id.padEnd(8)} ${p.spec.kind.padEnd(10)} ${(p.spec.view ?? p.spec.clip ?? '').padEnd(16)} ${p.spec.mode ?? ''} ${p.spec.frame ?? ''}`)
