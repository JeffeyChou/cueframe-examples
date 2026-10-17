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
Some examples import files their `make.sh` generates (`build/…`) and declare them in their
`package.json` (`cueframe.generated`, with what building them `needs`). `pnpm check` reports such a
project as SKIP until those files exist; `pnpm check --strict` fails instead. A missing import that
is not declared always fails. `make.sh` scripts use `jq`. `pnpm bootstrap` builds r-algebra's font subsets.
The others need more than a clone:

| Example | Needs | Build |
|---|---|---|
| `r-promo` | network for TTS | `bash examples/r-promo/make.sh` |
| `r-ascii` | your own copy of the song | `examples/r-ascii/README.md` |
| `manim-kepler` | a local IndexTTS voice (`../index-tts`, `../voices`) | `bash examples/manim-kepler/make.sh` |
`texmorph/` is a submodule too: CueFrame finds it beside itself.

## Licences

Code is MIT (`LICENSE`). Fonts carry their own OFL files next to them; large CJK fonts are not
committed and come from `scripts/fetch-fonts.sh`. The songs of the music-video replicas are not
included; r-ascii and r-pdoom carry lyric timing data (`data/lyrics.json`), whose words belong to
their authors (see each example's README).
