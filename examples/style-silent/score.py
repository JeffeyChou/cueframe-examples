"""市场街 1906: a cinema upright piano (`cueframe-py instruments fetch vsco2ce`) and the projector.
A parlour waltz in F at 120 BPM (one bar = 1.5 s) under the title and the street; it settles on F
as the iris closes on the clock. The second card turns it to D minor: a left-hand tremolo, a
diminished chord, a low rumble while the card burns, then silence in the black. Under the end card
the waltz's first three notes and an F chord left to ring. The projector clatters at 18 frames a
second throughout.

    pnpm exec cueframe cues examples/style-silent
    uv run --project cueframe/python --group instruments cueframe-py synth examples/style-silent/score.py --project examples/style-silent
"""

import numpy as np

from cueframe_py.audio import sampler
from cueframe_py.audio.mixing import reverb
from cueframe_py.audio.synth import T, env, highpass, lowpass, noise, rng, sine
from cueframe_py.common import SR

BAR = 1.5
BEAT = BAR / 3
P = 'upright'
F, C7, BB = (29, (57, 60, 65)), (36, (58, 60, 64)), (34, (58, 62, 65))
# (bar, chord, melody [(beat, pitch, beats)]): intro vamp, two phrases, the held A over the iris.
WALTZ = [
    (0, F, []), (1, C7, []),
    (2, F, [(0, 69, 1), (1, 72, 1), (2, 77, 1)]),
    (3, C7, [(0, 76, 2), (2, 74, 1)]),
    (4, C7, [(0, 70, 1), (1, 72, 1), (2, 76, 1)]),
    (5, F, [(0, 77, 3)]),
    (6, F, [(0, 69, 1), (1, 72, 1), (2, 81, 1)]),
    (7, BB, [(0, 79, 2), (2, 77, 1)]),
    (8, C7, [(0, 76, 1), (1, 74, 1), (2, 70, 1)]),
    (9, F, [(0, 69, 3)]),
]


def projector(d: float, fps: float = 18, seed: int = 5) -> np.ndarray:
    """The gate's claw at `fps`: a dry tick per frame with a little wow, over the motor's hum."""
    out = np.zeros(len(T(d)))
    r = rng(seed)
    tick = highpass(noise(0.012, seed), 1800) * env(0.012, 0.0005, 0.004)
    for i in range(int(d * fps)):
        k = int((i / fps + r.normal(0, 0.0015)) * SR)
        if 0 <= k < len(out) - len(tick):
            out[k:k + len(tick)] += tick * (0.7 + 0.3 * r.random()) * (1.0 if i % 2 else 0.8)
    t = T(d)
    hum = sine(100, d) * 0.02 + sine(200, d) * 0.01 + lowpass(noise(d, seed + 1), 300) * 0.05
    return out * 0.5 + hum * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t))


def crackle(d: float, seed: int = 9) -> np.ndarray:
    """Burning celluloid: sparse pops thickening to a roar."""
    t = T(d)
    r = rng(seed)
    out = np.zeros(len(t))
    for _ in range(int(60 * d)):
        at = d * r.random() ** 0.6
        k = int(at * SR)
        pop = highpass(noise(0.006, int(r.integers(1 << 30))), 900) * env(0.006, 0.0002, 0.003)
        if k + len(pop) < len(out):
            out[k:k + len(pop)] += pop * r.uniform(0.3, 1.0)
    roar = lowpass(noise(d, seed + 1), 900) * (t / d) ** 2 * 0.5
    return out * 0.8 + roar


def score(ctx):
    sampler.seed(1906)
    piano = ctx.track('piano', role='bed')
    room = ctx.track('room', role='sfx')
    ev = lambda n: ctx.event(f'cue.{n}')  # noqa: E731
    e1 = lambda n: ctx.event1(f'cue.{n}')  # noqa: E731
    cuts = ev('cut')
    card, end_card = cuts[2], cuts[3]
    burn, black = e1('burn'), e1('black')
    end = ctx.duration

    for bar, (root, chord), melody in WALTZ:
        t0 = bar * BAR
        last = bar == 9
        piano.put(sampler.note(P, root, dur=BEAT * (3 if last else 0.9), vel=0.62), t0, pan=-0.15)
        if last:
            piano.put(sampler.chord(P, chord, dur=BAR * 0.95, vel=0.4, strum=0.03), t0 + 0.02, gain=0.8, pan=-0.05)
        else:
            for beat in (1, 2):
                piano.put(sampler.chord(P, chord, dur=BEAT * 0.55, vel=0.4 - 0.04 * beat), t0 + beat * BEAT, gain=0.75, pan=-0.05)
        for beat, pitch, beats in melody:
            piano.put(sampler.note(P, pitch, dur=BEAT * beats * 0.95, vel=0.62 if beat == 0 else 0.52), t0 + beat * BEAT, pan=0.15)

    # Four days later: D minor tremolo, the diminished chord, the rumble as the card burns, then silence.
    sixteenth = BEAT / 4
    k = 0
    while card + k * sixteenth < black - 0.02:
        t = card + k * sixteenth
        swell = 0.32 + 0.3 * (t - card) / (black - card)
        piano.put(sampler.note(P, 38 if k % 2 == 0 else 50, dur=sixteenth * 1.1, vel=swell), t, gain=0.8, pan=-0.2)
        k += 1
    piano.put(sampler.chord(P, (62, 65, 69), dur=BAR * 1.4, vel=0.55), card, pan=0.1)
    piano.put(sampler.chord(P, (61, 64, 67, 70), dur=BAR * 1.2, vel=0.62), card + BAR, pan=0.1)
    piano.put(sampler.chord(P, (26, 27, 28, 29), dur=black - burn, vel=0.7), burn, gain=0.7, pan=-0.2)

    # The end card: the waltz's opening three notes, then F left to ring.
    for i, pitch in enumerate((69, 72, 77)):
        piano.put(sampler.note(P, pitch, dur=BEAT * 0.95, vel=0.45), end_card + 0.25 + i * BEAT, pan=0.15)
    piano.put(sampler.chord(P, (41, 53, 57, 60, 65), dur=end - end_card - 1.9, vel=0.42, strum=0.04), end_card + 0.25 + BAR, gain=0.85)

    piano.data += reverb(piano.data, decay=1.4, seed=2) * 0.16
    cut_at = int(black * SR)
    piano.data[cut_at:int(end_card * SR)] = 0

    room.put(projector(end), 0, gain=0.5)
    room.put(crackle(black - burn), burn, gain=0.35)

    ctx.section('street', 0, card)
    ctx.section('four days', card, end_card)
    ctx.section('credits', end_card, end)
