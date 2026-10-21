# manim-kepler

A 3Blue1Brown-style explainer (in Chinese, with narration, subtitles and a synthesized score) of
Newton's geometric proof of Kepler's second law. 2D geometry on SVG (`lib/manim.ts`),
3D shots in three.js, formulas morphed term by term with texmorph (MathJax 4, New Computer Modern).

| Hold | Shot | Technique |
|---|---|---|
| `kepler` | the orbit in 3D, equal-time sectors tile the ellipse; the camera flattens to the top view | three.js, exact Kepler orbit |
| `inertia` | no force: AB = BC, same base and height, equal triangles | SVG write-on, texmorph chain |
| `kick` | a kick at B towards S; c→C is parallel to SB, so the shear keeps the area | parallelogram, shear |
| `polygon` | kicks every Δt with F ∝ 1/r²; twelve readouts, all 0.21865 | Newton's discrete construction |
| `limit` | Δt halves to 96 steps, the polygon becomes the ellipse; r × Δv cancels | texmorph `\cancel` |
| `momentum` | back to 3D: the r, v parallelogram and the constant r × v arrow | three.js |
| `conclusion` | three central forces, equal sectors in each; dA/dt = L/2m | |

The flat shots use the same mapping as the 3D top view (240 px per world unit, orbit centre at
(760, 540)), so the 3D grid and the SVG plane coincide when the camera cuts between them.

Every number on screen is computed: the orbit polygon in `orbit.ts` coasts and then kicks, so each
triangle has area |r × v|·Δt/2 exactly.

## Build

```
examples/manim-kepler/make.sh      # narration → font → score → mix → schedule → mp4 → measure, audit
```

- Narration: `script.json` (`engine: "command"`) runs `scripts/say.py` in `../index-tts`, which
  synthesizes each line with IndexTTS-2.5 and the voice in `../voices/me/reference.wav`; `"align"`
  then times each character from the audio (`cueframe-py align`, Whisper `small` + pauses). Lines
  are cached by text; set `KEPLER_VOICE` for another voice folder.
- Subtitles: `recipes/subtitles.ts`, phrases from `build/words.json`, Noto Sans SC (OFL) subset to the spoken text;
  `scripts/fetch-fonts.sh` downloads the font from google/fonts (not committed).
- Score: `score.py` (72 BPM, D major, additive piano and pads; sections start on the narration
  cues) → `mix.json` ducks it under the voice at −16 LUFS.
- texmorph is linked from a sibling checkout (`../texmorph`), as in `m2-talk`.

```
pnpm exec cueframe stills examples/manim-kepler --holds kepler,inertia,kick,polygon,limit,momentum,conclusion
pnpm exec cueframe export examples/manim-kepler --hold kick      # one shot
```
