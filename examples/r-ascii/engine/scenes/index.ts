import type { ActId } from '../song.ts'
import type { Scene } from '../types.ts'
import { boot, title } from './intro.ts'
import { geometry } from './geometry.ts'
import { chorus, current } from './mid.ts'
import { organic, switchAct, vibrate } from './organic.ts'
import { crash, fragments, illegal, left } from './late.ts'
import { REG } from './kit.ts'
import { chorus2, decay, execution, finale, love } from './end.ts'

export const SCENES: Record<ActId, Scene> = {
  boot, title, geometry, current, chorus,
  organic, switch: switchAct, vibrate, left, fragments,
  illegal, crash, execution, chorus2, love,
  decay, finale,
}
REG.scenes = SCENES
