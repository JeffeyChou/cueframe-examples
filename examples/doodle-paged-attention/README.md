# doodle-paged-attention

A dark-mode hand-drawn explainer (Excalidraw-like chalk on a slate board) on why LLM serving runs
out of GPU memory and how PagedAttention fixes it. Built on `recipes/doodle.ts`.

Five shots on one infinite canvas, each ending in a hold, then a zoom-out over the whole board:

| Hold | Shot | Camera |
|---|---|---|
| `pain` | user with an unknown-length request, a sweating GPU, "OOM?" | fixed |
| `drawers` | pre-allocated filing cabinet: 20% used, 80% reserved waste, user B blocked | pan right, 1.15× |
| `paging` | locked hardcover book vs ring binder of fixed-size pages, scheduler with a wand | zoom out, pan, push in |
| `page-table` | logical blocks, block table, scattered physical slots | pan |
| `sharing` | two users share system-prompt blocks, throughput gauge | pan |
| `overview` | the whole board | zoom out, fade |

Every element is drawn on stroke by stroke (`pathLength` dash write-on, text revealed by a clip)
and then stays still. Only marks that should feel alive boil (`boil: true`, 8 Hz through three
jitter variants): the GPU's smoke, sweat and cheek lines, and the highlighter loop around the
shared prefix. Holds keep those and a few small loops (tokens in the pipe, the trembling GPU)
running on `f.idle`.

```
pnpm exec cueframe dev examples/doodle-paged-attention          # present: → plays to the next hold
pnpm exec cueframe stills examples/doodle-paged-attention --holds pain,drawers,paging,page-table,sharing,overview
pnpm exec cueframe export examples/doodle-paged-attention        # mp4, holds play for their `dur`
pnpm exec cueframe audit examples/doodle-paged-attention         # includes jitter: unmarked shapes that keep changing
```

Timing: `timings()` dry-runs the shots on a detached board, and each shot's hold follows from how
long it draws, so editing a shot moves its hold and every later one. The storyboard's 10-minute
narration is in `notes.md`; the video runs about 1:53 without narration.

Review one shot without rendering the rest: `cueframe export … --hold paging` writes
`out/landscape-paging.mp4`.

Fonts: Virgil (Excalidraw's hand font, OFL, `fonts/OFL-Virgil.md`) and JetBrains Mono (OFL).
Virgil has no arrow glyphs, so arrows are drawn strokes.
