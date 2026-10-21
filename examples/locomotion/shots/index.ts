// Shot modules by kind. A kind without a module draws the placeholder.
import type { Kind } from '../edit.js'
import { defineShot, type ShotDef } from '../lib/shot.js'
import { text } from '../lib/ui.js'
import clip from './clip.js'
import horse from './horse.js'
import car from './car.js'
import dragonfly from './dragonfly.js'
import plate from './plate.js'
import cloud from './cloud.js'
import { pair, eyes } from './pair.js'
import muybridge from './muybridge.js'
import rollgrid from './rollgrid.js'
import mirror from './mirror.js'
import flock from './flock.js'
import card from './card.js'
import windtunnel from './windtunnel.js'
import chimera from './chimera.js'

const placeholder = defineShot({
  draw() {},
  ui(g, c) { text(g, c.f, `[ ${c.plan.spec.kind.toUpperCase()} ${c.plan.spec.view ?? c.plan.spec.clip ?? ''} ]`, c.k.W / 2, c.k.H / 2, { size: 28, align: 'center' }) },
})

export const DEFS: Partial<Record<Kind | 'placeholder', ShotDef<any>>> = { placeholder, clip, horse, car, dragonfly, plate, transit: cloud, cloud, pair, eyes, muybridge, rollgrid, mirror, flock, card, windtunnel, chimera }
