# The last persimmon

A 13.6-second hand-painted cartoon on brushFrame: Dou, a bean with a sprout, wants the one persimmon left on
the tree, jumps and misses by a hair, sulks, and the wind drops it on its head. No text; watercolour washes, an
ink outline that boils twelve times a second, drawn key views instead of 3D turns, and faces that act.

It shows the painted-cartoon method on CueFrame and brushFrame:

- **Reads.** `storyboard.json` lists, per shot, what a first-time viewer must understand and for how long
  (cueframe `docs/guide/production.md`, "Timing: the reads"). The times in `scenes/short.ts` come from it.
- **One background plate.** The watercolour orchard is a brushFrame `plate`, painted once in world px; each
  framing is a camera over it, so a cut shows the same paint (repainting a background per framing gave each
  cut new watercolour blooms). Dou, the persimmon and the leaves are a transparent painting drawn over it
  every frame.
- **Boil.** Every shape is keyed by its name and the boil frame (`floor(t · 12)`), so still things hold for two
  frames and redraw with a new wobble, and nothing drawn later shifts the streams of what came before.
- **Acting.** `kits/acting.ts` envelopes with the `snappy` style give anticipation, takes and settles; the
  sprout follows through from the body's vertical speed.

```sh
bash examples/persimmon/make.sh          # events → score → mix → mp4 → measure → determinism
pnpm exec cueframe stills examples/persimmon --times 2,5.8,12.3
```

brushFrame is the `brushFrame/` submodule beside `cueframe/` (or `CUEFRAME_BRUSHFRAME`).

| File | What |
|---|---|
| `storyboard.json` | the brief and the three shots with their reads |
| `lib/dou.ts` | the rig: bean body, views (front, 3/4, side), eyes, mouths, arms, legs, sprout, emotes, `emotions()` |
| `lib/world.ts` | the dusk orchard (graded washes, hills, the tree), the persimmon, blown leaves, the iris |
| `timing.ts` | every time in the film, and the events the score plays on (footsteps, the bonk, the catch …) |
| `scenes/short.ts` | the three shots, the camera, Dou's pose from the timing, the fall and the catch; `f.mark` feet and fruit for `--crop-at` |
| `score.py`, `mix.json` | a plucked 96 BPM bed in C with tonal cues on the events; checked by spectrum and section RMS |
