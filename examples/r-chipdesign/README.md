# r-chipdesign

A 95-second replica slice of a long Chinese explainer on chip design (a 31-minute video whose
pictures run continuously: elements stay on screen and turn into the next idea instead of
cutting). The slice covers "you cannot draw a hundred billion transistors, so you describe the
circuit": the abstraction ladder (transistor → gate → adder → core → chip), hardware description
languages, RTL as register → logic → register per clock cycle, a counter's two lines of Verilog
and the circuit they become, and software versus hardware.

The script is our own wording, narrated with a local IndexTTS voice; every visual time comes from
the narration (`said()` on Whisper word times), so re-recording a line retimes the pictures.

It is built with CueFrame as it is today, to measure what continuity costs: see
`cueframe/docs/feedback/chip-design-study.md`.

```
bash examples/r-chipdesign/make.sh
```

Needs `../index-tts` and `../voices/me` next to this repository (as manim-kepler does); without
them, `tts` cannot make the narration.
