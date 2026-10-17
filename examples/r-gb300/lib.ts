// Shared look and the overlay helpers of the three shots.
import type { Frame, MountContext, Plate } from '@cueframe/core'
import { A, chapterBar, overlay } from '@cueframe/recipes/annotate.js'

A.font = '"Noto Sans SC", sans-serif'
A.mono = '"Plex Mono", ui-monospace, monospace'
A.accent = '#d9b46c'

export const CHAPTERS = ['机柜', '计算托盘', '算力有多大']

/** A shot: its plate filling the stage, the chapter bar, and the overlay layers on top. */
export async function shot(ctx: MountContext, name: string, chapter: number) {
  ctx.root.style.background = '#050506'
  const plate: Plate = await ctx.plate(`build/plates/${name}`)
  const o = overlay(ctx.root, ctx.stage)
  const bar = chapterBar(o, CHAPTERS, 64, 48)
  return { plate, o, bar, chapter }
}

/** Crossfade in over the shot before (the incoming scene is drawn on top). */
export function fadeIn(f: Frame, root: HTMLElement) {
  root.style.opacity = String(f.tin > 0 && f.tin < 1 ? f.tin : 1)
}

/** 0..1 from `a` to `b` seconds of scene time. */
export const span = (f: Frame, a: number, b: number) => Math.min(1, Math.max(0, (f.lt - a) / (b - a)))
