// When the hero's ride leaves, turns and dodges, from the narration only: the ride pins its path to
// these times, and the score gets them as events (timeline({ events }) → cueframe cues → ctx.event).
import { events, saidIn } from '@cueframe/core'
import words from './build/words.json'

const said = (id: string, text: string) => saidIn(words, id, text)

export const T = events('ride', {
  leave: said('r1', '出发'),
  turn: said('r2', '拐弯'),
  around: said('r2', '绕开'),
  turn2: said('r3', '拐弯'),
  dodge: said('r3', '躲'),
})
