# r-pcb-routing

A 49-second replica slice of a short Bilibili animation about routing a ten-layer board: a pixel
rider rides the head of a bus of traces between stones; the camera pulls back and the frame splits on
the beat into ten panels, one per layer, each its own routing world; the panels become the ten layer
tiles, which fly into an exploded 3D stack, align, are drilled through and press into one board.

The script is our own wording, narrated with a local IndexTTS voice; every event time comes from the
narration (`said()` on Whisper word times), snapped to the next beat of a 120 BPM chiptune bed
(`score.py`) where the picture splits. Routes, stones and layer copper are seeded and drawn on
Canvas2D (`lib.ts`); the stack is CSS 3D. The hero's route is authored with
`@cueframe/recipes/paths.js`: its bus turns on "拐弯", jogs on "绕开" and dodges a boulder on "躲"
because `travel` pins the path's marks to those word times (`timing.ts`), which the score also reads
as events. It was built with CueFrame as it is, to measure friction:
see `FRICTION.md`.

```
bash examples/r-pcb-routing/make.sh
```

Needs `../index-tts` and `../voices/me` next to this repository (as r-chipdesign does); without
them, `tts` cannot make the narration.
