# 东八区海关 (UTC+8 Customs)

A 3-minute flat, Bauhaus-style satire on printed paper: Claude as a border officer who only checks
UTC+8. Travelers disguised as Americans, Japanese and Singaporeans are caught by small tells —
"在吗", full-width commas, a 思想汇报, pinyin variable names, a lunch break at midnight New York
time, a Saturday marked 班 — and stamped. The rejected ones change hats and queue again; the
"US users" clock in at 9 a.m. Beijing time; the sun rises over UTC+8.

It was made through `cueframe board` (docs/guide/production.md): a plan round, a look round with five
style frames, then the cut. Rounds and feedback are in `review/board/`.

```sh
bash examples/utc8-customs/make.sh      # needs ../mlx-audio and ../voices beside this repo
```

| File | What |
|---|---|
| `storyboard.json` | the brief and the 16 shots, as reviewed on the board |
| `script.json`, `scripts/say.py` | narration (Lingyu) and the travelers' lines (Junhao, Weiguo, Zhiming, Nathan), MOSS-TTS 1.7B 8-bit on mlx-audio; Whisper word times |
| `timing.ts` | every action time from the narration words; the score's events |
| `lib.ts` | palette, type, printed-paper shapes, Claude the officer, the disguised travelers, the booth set, rings, stamps, cards, bubbles |
| `scenes/hall.ts` | s01 opening (the clocks, the cap), s03 the queue |
| `scenes/booth.ts` | the counter shots: s02, Kevin s04–s05, Tanaka s06, Lim s07, Mike s09, lunch s12, Kevin again s14 |
| `scenes/code.ts`, `scenes/evidence.ts` | s08 the laptop; s10 calendar, s11 montage, s15 traffic chart |
| `scenes/loop.ts`, `scenes/sunrise.ts` | s13 the loop through the hat stall; s16 sunrise and the title |
| `scenes/overlay.ts` | paper sheet, boxed subtitles for the narration (characters speak in bubbles) |
| `score.py`, `mix.json` | bossa bed and foley; voices levelled line by line |
