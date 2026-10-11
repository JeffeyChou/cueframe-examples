# finccl-talks

Two group-meeting decks for FINCCL, built from the AFFiNE notes "FINCCL group meeting: cuTZ
compressor (Part 1)" and "… compressed collectives on the NCCL Device API (Part 2)".

| Project | Talk | Slides |
|---|---|---|
| `part1/` | cuTZ compressor, 60 min | 32 |
| `part2/` | Device-API collectives, ≤ 40 min | 27 |

```
pnpm exec cueframe dev examples/finccl-talks/part1    # S presenter (notes), O overview
pnpm exec cueframe dev examples/finccl-talks/part2
pnpm exec cueframe export examples/finccl-talks/part1 --pdf
```

- `deck/` is a small slide engine shared by both: `slide({ id, section, title, steps, build })`
  builds DOM blocks (`bullets`, `table`, `card`, `flow`, `stat`, `callout`, SVG `bars`/`lines`).
  Each slide is one scene; each `b.step()` adds a hold (a click build). Content is zoomed to fill
  the body box (≤ 1.4×) when it fits.
- A `chrome` scene spans the deck and draws the background, footer, counter and section bar.
- Speaker notes are in `notes.md`, one `## slide-id` per slide.
- Slides carry results and design, not provenance: no job IDs, source paths or commits. The
  AFFiNE notes and the FINCCL repo hold those.
