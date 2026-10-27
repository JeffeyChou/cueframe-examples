# 方圆 (Bauhaus fable style demo)

The demo of the Bauhaus-fable style kit ([`kits/bauhaus.ts`](../../kits/bauhaus.ts), bible
[`kits/styles/bauhaus.md`](../../kits/styles/bauhaus.md)): a 19 s fable. Three squares hop in step
onto the baseline; the circle rolls in late. A red marker steps along the labels: 合格, 合格, 合格;
the circle is ringed and stamped 不合格, squeezes itself square and is stamped 合格 over it, then
pops round again mid-hop, rolls off and swells into the frame. The moral, "没有规矩，不成方圆。",
turns out to be the square's (—— 方 说). Paper columns rise to the end card.

```sh
bash examples/style-bauhaus/make.sh    # fonts, cues, score, mix, export, checks
pnpm exec cueframe dev examples/style-bauhaus
```

| File | What |
|---|---|
| `timing.ts` | every beat on the bed's eighth-note grid, and the score's events |
| `scenes/fable.ts` | the poster and the inspection, the circle wipe |
| `scenes/moral.ts` | the moral on red, the column wipe |
| `scenes/end.ts` | the end card |
| `scenes/overlay.ts` | the printed sheet (`kits/paper.ts` `sheet`) |
| `score.py`, `mix.json` | bossa bed, woodblocks, stamps, pencil, chords, harp, chimes |
