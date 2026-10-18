# r-chipdesign

A 100-second replica slice of a long Chinese explainer on chip design (a 31-minute video whose
pictures run continuously: elements stay on screen and turn into the next idea instead of
cutting). The slice covers "you cannot draw a hundred billion transistors, so you describe the
circuit": the abstraction ladder (transistor → gate → adder → core → chip), hardware description
languages, RTL as register → logic → register per clock cycle, a counter's two lines of Verilog
and the circuit they become, and software versus hardware.

The script is our own wording, narrated with a local IndexTTS voice; every visual time comes from
the narration (`said()` on Whisper word times), so re-recording a line retimes the pictures.

Elements carry over between narration lines and scenes through `ctx.layouts` and `ctx.key`
(`cueframe/docs/guide/continuity.md`): each beat is a layout written as a table of spots
(`@cueframe/recipes/blocking`), and CueFrame moves the keys between them. The code panel is handed
from scene to scene (hdl → rtl → contrast). The first version, with every move written by hand,
is commit 7d0c15a; the comparison is in `cueframe/docs/feedback/chip-design-study.md`.

The chrome (chapter tags and cards with a road map, headlines with eyebrows and coloured keywords,
progress, subtitles) comes from `script.json` through `@cueframe/recipes/explainer`
(`cueframe/docs/guide/explainer.md`): `chapters`, and `title`/`eyebrow` per line. The cards before
chapters 03 and 04 sit in the 3.5 s pads of lines c7 and r4.

Panels, the code panel, registers, counters and the clock are HUD instruments from
`@cueframe/recipes/hud` (`cueframe/docs/guide/hud.md`), with colours by role from the theme the
chrome uses. The code panel is a panel holding `code` dials at their natural size; the links in r4
point at tokens with `ui.at` and `lay.map`, so they follow the panel as it moves.

Behind the end of the ladder a 3D die (`blender/die.py`, an EEVEE final) is placed on the narration
with `ctx.plate(..., { timing })` (`cueframe/docs/guide/plates.md`): it holds wide, pushes in from
"整颗芯片" to chapter 03's card and drifts under the card. Re-recording c7 or h1 moves the camera;
the plate does not render again.

```
bash examples/r-chipdesign/make.sh
```

Needs `../index-tts` and `../voices/me` next to this repository (as manim-kepler does); without
them, `tts` cannot make the narration.
