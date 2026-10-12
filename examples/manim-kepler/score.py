"""Background score for manim-kepler: a quiet piano-and-pad bed that follows the shots.

cueframe-py synth examples/manim-kepler/score.py  → build/stems/{bed,sfx}.wav
Sections start on the narration cues (build/cues.json): each shot changes the arpeggio density and
register; the conclusion resolves to Dmaj9 and rings out.
"""

import numpy as np

from cueframe_py.audio import pad
from cueframe_py.audio.synth import T, lowpass, note, sparkle, ding

BPM = 72
# D major, slow and open: Dmaj9 – Bm9 – Gmaj9(#11) – Asus
PROG = [
    ([50, 57, 64, 66, 69], 38),
    ([47, 54, 61, 62, 66], 35),
    ([43, 50, 57, 61, 66], 31),
    ([45, 52, 57, 59, 64], 33),
]
END_CHORD = ([50, 57, 62, 64, 66, 69, 73], 38)


def piano(n: float, d: float = 3.0, vel: float = 1.0) -> np.ndarray:
    """Additive soft piano: decaying, slightly stretched partials and a short felt attack."""
    f = note(n)
    t = T(d)
    x = np.zeros_like(t)
    for k in range(1, 8):
        fk = f * k * (1 + 0.0004 * k * k)
        x += np.sin(2 * np.pi * fk * t) * (1 / k ** 1.4) * np.exp(-t * (0.9 + 0.7 * k) * (f / 440) ** 0.3)
    att = np.minimum(1, t / 0.006)
    rel = np.minimum(1, (d - t) / 0.25)
    x = lowpass(x * att * rel, 2400 + 1600 * vel)
    return (0.28 * vel * x).astype(np.float32)


# (density per bar in eighths, register shift, pad level) per section
SECTIONS = [
    ('scene.k1.start', 2, 0, 0.42),   # opening: sparse
    ('scene.i1.start', 3, 0, 0.34),   # no force: light
    ('scene.c1.start', 4, 0, 0.38),   # the kick
    ('scene.p1.start', 6, 12, 0.40),  # polygon: building
    ('scene.l1.start', 8, 12, 0.44),  # the limit: fullest motion
    ('scene.m1.start', 6, 12, 0.50),  # 3D: wide
    ('scene.a1.start', 3, 0, 0.42),   # any force, conclusion
]


def score(ctx):
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    spb = 60 / BPM
    bar = 4 * spb
    starts = [ctx.cue(c) for c, *_ in SECTIONS]
    final = ctx.cue('scene.a3.end') - 2.3          # after the last word

    def section(t):
        i = max(k for k, s in enumerate(starts) if s <= t + 1e-6)
        return SECTIONS[i]

    b = 0
    t = 0.0
    while t < final - 0.5 * bar:
        chord, root = PROG[b % 4]
        _, dens, up, lvl = section(t)
        bed.put(pad([n - 12 for n in chord[:3]] + [chord[3]], bar * 1.25, cutoff=900, detune=0.004), t, lvl)
        bed.put(piano(root - 12, bar * 1.1, 0.6), t, 0.55, -0.1)
        # Arpeggio: `dens` notes per bar on the eighth grid, rising then falling through the chord.
        order = chord[1:] + chord[1:-1][::-1]
        slots = [round(i * 8 / dens) for i in range(dens)]
        for j, s in enumerate(slots):
            n = order[j % len(order)] + up
            vel = 0.55 + 0.25 * (j == 0) - 0.04 * (j % 3)
            bed.put(piano(n, 2.4, vel), t + s * spb / 2, 0.5, 0.25 * np.sin(j * 1.7))
        b += 1
        t += bar

    # Resolution: one long chord on the conclusion, then the room.
    chord, root = END_CHORD
    bed.put(pad([n - 12 for n in chord[:4]], ctx.duration - final + 1.0, cutoff=1100), final, 0.5)
    bed.put(piano(root - 24, 6.0, 0.8), final, 0.6)
    for j, n in enumerate(chord):
        bed.put(piano(n, 6.0, 0.7), final + 0.09 * j, 0.42, -0.3 + 0.1 * j)

    # Soft accents in the pause after a line that proves something.
    sfx.put(ding(1175, 1.2), ctx.cue('scene.i5.end') - 0.7, 0.22, 0.2)       # equal areas without force
    sfx.put(ding(1319, 1.2), ctx.cue('scene.c7.end') - 0.7, 0.22, -0.2)      # still equal after the kick
    sfx.put(ding(1480, 1.4), ctx.cue('scene.l5.end') - 0.8, 0.22, 0.1)       # dA/dt = L/2m
    sfx.put(sparkle(1.6), final + 0.3, 0.25)                                 # conservation
