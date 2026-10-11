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

Every element is drawn on stroke by stroke (`pathLength` dash write-on, text revealed by a clip),
lines boil at 8 Hz through three jitter variants, and holds keep the boil and small loops (tokens
in the pipe, the trembling GPU, smoke) running on `f.idle`.

```
pnpm exec cueframe dev examples/doodle-paged-attention          # present: → plays to the next hold
pnpm exec cueframe stills examples/doodle-paged-attention --holds pain,drawers,paging,page-table,sharing,overview
pnpm exec cueframe export examples/doodle-paged-attention        # mp4, holds play for their `dur`
```

Timing: each shot's drawing length (`len` in `scenes/board.ts`) sets its hold; mount fails if a
shot draws past its hold, and the message gives the actual length. The storyboard's 10-minute
narration is in `notes.md`; the video runs about 1:52 without narration.

Fonts: Virgil (Excalidraw's hand font, OFL, `fonts/OFL-Virgil.md`) and JetBrains Mono (OFL).
Virgil has no arrow glyphs, so arrows are drawn strokes.
