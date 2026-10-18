# r-editing-village

A ~52 s replica slice of a flat, paper-textured character animation (Bilibili 守拙, "AI对传统剪辑的冲击",
roughly 86–125 s of the original): the AE elder points at the animation on the village screen, the
camera stutters on card 3, the camera pulls out through the screen to the stage, the narrator rushes
on, a tower of software drops behind it, it turns to its dark side beside Opus and sends the
instruction into the black box. Narration wording is our own; voice is the local IndexTTS voice `me`.

It was built with CueFrame as it is, to measure friction for character animation; see
[FRICTION.md](FRICTION.md).

```sh
bash examples/r-editing-village/make.sh      # needs ../index-tts and ../voices beside this repo
```

| File | What |
|---|---|
| `lib.ts` | palette, SVG helpers, the character rigs (ball, Claude, elder, villager, cube), camera |
| `scenes/strip.ts` | the twelve-card animation under critique, drawn from its own clock (a "nested" piece) |
| `timing.ts` | when things happen (whip, rush, book landings, instruction): read by the scenes and, as events, by the score |
| `scenes/elder.ts`, `stage.ts`, `books.ts`, `opus.ts` | the shots, timed by narration words; blur only in windows (whip, rush) |
| `scenes/overlay.ts` | paper texture and boxed subtitles |
| `score.py`, `mix.json` | piano waltz bed and synthesized effects |
