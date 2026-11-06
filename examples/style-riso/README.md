# 雨停了 (risograph style demo)

The demo of the print kit ([`kits/print.ts`](../../kits/print.ts), bible
[`kits/styles/riso.md`](../../kits/styles/riso.md)): a 17.5 s film printed plate by plate on a
three-drum riso. The teal plate rolls in: a walker under an umbrella in the rain. The yellow plate
lights the windows. The walker stops and holds out a hand; the rain thins and the plates drift
apart. On the downbeat the umbrella comes down, the plates snap back and the pink sky rolls in.
Sunset, the title stamped twice, and the camera pulls back to the printed sheet.

The score plays sampled instruments, one per plate: pizzicato bass, vibraphone, nylon guitar.

```sh
uv run --project cueframe/python --group instruments cueframe-py instruments fetch vcsl karoryfer   # once, ~350 MB
bash examples/style-riso/make.sh    # fonts, cues, score, mix, credits, export, checks
pnpm exec cueframe dev examples/style-riso
```

| File | What |
|---|---|
| `timing.ts` | shots, plate arrivals, the drift and the snap, title hits; the score's events |
| `scenes/print.ts` | the three shots drawn as ink densities, registration, rollers, the pull back |
| `lib/draw.ts` | the set and the walker as densities on the teal, yellow and pink plates |
| `score.py`, `mix.json` | bass, vibraphone, nylon guitar entering with the plates; roller, drum and stamp foley |
