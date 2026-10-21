# A Survey of Rain

A 59 s rhythm cut of rain, storm and bird footage under a technical, schematic overlay:
tracked detection circles with coordinates, connections, crosshair or brackets, tangent chains and
ray pencils along the footage's motion, pixelated regions, telemetry and a corner slate. Cobalt
colour-block windows jump on the drums; an orange accent comes in with the song's second layer.

Made after studying a short rain montage (colour blocks on drum hits) and the ComfyUI-Schematic
overlay. Built on `kits/beatcut.ts` (`cutSections`, [`kits/README.md`](../../kits/README.md)), `lib/schematic.ts` (`analysis`,
[`lib/README.md`](lib/README.md)), `ctx.frames`, `f.hit` and `cueframe-py hits/excerpt/footage` (cueframe
`docs/guide/rhythm.md`).

| Section | Song (excerpt s) | Cut | Windows |
|---|---|---|---|
| 01 Calibration | 0–6.86 | one shot, title | tint block on kicks |
| 02 Sky | 6.86–13.71 | every 4 beats | pip, sliver, outline |
| 03 Pressure | 13.71–20.57 | 4 → 2 → 1 beats, cobalt breath | tint, sliver, pip, grow |
| 04 Rainfall | 20.57–34.28 | every 2 beats, flash on the drop | circle, pip, sliver, tint, grow |
| 05 Surface | 34.28–48.0 | every 2 beats, orange split | circle, split, pip, tint |
| 06 Clearing | 48.0–59.2 | every 4 beats, end card | outline, pip, tint, letterbox |

`edit.ts` holds the plan; `scenes/montage.ts` draws everything into one frame canvas;
`scenes/cards.ts` the title and end cards. `bash make.sh` rebuilds it (footage, music and fonts are
downloaded, not committed).

Credits: footage and music from Mixkit (Mixkit Stock Video / Stock Music free licences; music
"Slow Rain"); overlay after ComfyUI-Schematic by Jérémie Louvaert (MIT); JetBrains Mono and Noto
Serif SC (OFL).
