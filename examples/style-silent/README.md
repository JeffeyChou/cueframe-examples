# 市场街 1906 (silent-film style demo)

The demo of the film kit ([`kits/film.ts`](../../kits/film.ts), bible
[`kits/styles/silent.md`](../../kits/styles/silent.md)): a 24 s reel of real archival footage.
A title card: San Francisco, Market Street, 14 April 1906. The cable-car ride down Market Street
toward the Ferry Building, projected as a worn sepia print. The camera pushes in on the clock
tower and the photograph turns into an ink drawing; an iris closes on the clock. A card: four
days later, earthquake, fire. The card burns through in the gate. Black. The credits card.

The footage is *A trip down Market Street before the fire* (Miles Brothers, 1906), from the
Library of Congress (public domain): `make.sh` cuts 25 s out of the LoC access copy over HTTP and
never commits it; `data/sources.json` records the source seconds and where they land in the film.
The score is a cinema upright piano from the sampler (VSCO 2 CE, CC0) and the projector.

```sh
uv run --project cueframe/python --group instruments cueframe-py instruments fetch vsco2ce   # once, ~400 MB
bash examples/style-silent/make.sh    # footage, plates, fonts, cues, score, mix, credits, export, checks
pnpm exec cueframe dev examples/style-silent
```

| File | What |
|---|---|
| `timing.ts` | parts (cards, shots), the ink turn, the iris, the burn; the score's events |
| `clips.json` | the two plates cut from the excerpt, at 1.15× (the transfer runs slow) |
| `data/sources.json` | the footage's licence, archive page, file and seconds used |
| `scenes/reel.ts` | cards and footage drawn into the gate, `redraw` for the ink turn, `film` for the print |
| `score.py`, `mix.json` | upright piano waltz turning to D minor, projector clatter, burning crackle |
