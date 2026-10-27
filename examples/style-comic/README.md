# 周一 (newspaper comic style demo)

The demo of the newspaper-comic style kit ([`kits/comic.ts`](../../kits/comic.ts), bible
[`kits/styles/comic.md`](../../kits/styles/comic.md)): a 17 s four-panel strip on a newspaper page.
起 the alarm clock wakes at seven; 承 it rings; 转 the pillow strikes; 合 it lies down on the
pillow: "……再睡五分钟。" Ben-Day dots in three plates off register, inked panels, a caption box,
balloons, lettered sound effects, a starburst, speed lines, a camera that reads the page with
motion blur on its moves, a bouncy bed that stops dead on the hit.

```sh
bash examples/style-comic/make.sh      # fonts, cues, score, mix, export, checks
pnpm exec cueframe dev examples/style-comic
```

| File | What |
|---|---|
| `timing.ts` | every beat and the score's events |
| `lib/props.ts` | the cast and set: alarm clock, pillow, nightstand, bed and sleeper, window, Z, star |
| `scenes/strip.ts` | the page, the four panels and the camera |
| `scenes/overlay.ts` | the screen grain (`kits/paper.ts` `sheet`) |
| `score.py`, `mix.json` | strum bed, bell trill and foley |
