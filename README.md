# CueFrame examples

Finished pieces made with [CueFrame](https://github.com/JeffeyChou/cueframe): talks, explainers,
music videos and the benchmark replicas. Each example is a CueFrame project; the framework is a
submodule pinned to the commit the examples were last checked against, so adding an example never
changes CueFrame, and upgrading CueFrame is one reviewed bump.

| Example | What it is |
|---|---|
| `doodle-paged-attention` | PagedAttention on a hand-drawn board: five storyboard shots and an overview |
| `finccl-talks` | Two group-meeting decks (part1, part2) on a shared slide engine |
| `manim-kepler` | Newton's proof of Kepler's second law, 3Blue1Brown style, Chinese narration and subtitles |
| `r-algebra`, `r-ascii`, `r-pdoom`, `r-promo`, `r-watchdogs` | Benchmark replicas (CueFrame `docs/benchmark/`) |

## Setup

```
git clone --recurse-submodules https://github.com/JeffeyChou/cueframe-examples.git
cd cueframe-examples
pnpm bootstrap    # submodules, CueFrame + texmorph + example deps, Python tools, large fonts
```

Then, from the repository root:

```
pnpm exec cueframe dev examples/manim-kepler
pnpm exec cueframe stills examples/r-ascii --times 3,9
pnpm exec cueframe export examples/doodle-paged-attention
pnpm check                      # check types and a still for every example
```

Each example's README has its own commands; `make.sh` scripts run from the repository root.
`texmorph/` is a submodule too: CueFrame finds it beside itself.

## Licences

Code is MIT. Fonts carry their own OFL files next to them; large CJK fonts are not committed and
come from `scripts/fetch-fonts.sh`. Music and lyrics in the replicas belong to their authors and
are not included (see each example's README).
