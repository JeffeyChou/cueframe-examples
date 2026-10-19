"""Bed and effects for 东八区海关: a dry little bossa (upright bass, Rhodes-ish comping, brushes) that
enters when the sign drops, leans in for the montage, thins to piano for the traffic chart and stops
dead at the black; foley on every action the scenes time (stamps, rings, bows, the calendar crowd).

    pnpm exec cueframe cues examples/utc8-customs        # events of timing.ts → build/page-cues.json
    uv run --project cueframe/python cueframe-py synth examples/utc8-customs/score.py
    uv run --project cueframe/python cueframe-py mix examples/utc8-customs/mix.json --project examples/utc8-customs
"""

import numpy as np

from cueframe_py.audio.synth import T, ding, hat, lowpass, highpass, noise, note, pop, roomtone, typing, whoosh

BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
# F major ii–V–I–vi: Gm7 – C9 – Fmaj7 – Dm7 (voicings, bass root), MIDI
PROG = [([55, 58, 62, 65], 43), ([52, 58, 62, 64], 36), ([57, 60, 64, 65], 41), ([53, 57, 60, 62], 38)]


def rhodes(chord, d: float = 0.5, vel: float = 1.0) -> np.ndarray:
    t = T(d)
    x = np.zeros_like(t)
    for n in chord:
        f = note(n)
        x += (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t + 0.7 * np.sin(2 * np.pi * f * t))) * np.exp(-t * 3.2)
    att = np.minimum(1, t / 0.004)
    rel = np.minimum(1, (d - t) / 0.06)
    return (0.11 * vel * lowpass(x * att * rel, 2400)).astype(np.float32)


def upright(n: float, d: float = 0.6) -> np.ndarray:
    f = note(n)
    t = T(d)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9)
    thump = np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 30) * 0.4
    return (0.5 * (x * np.exp(-t * 3.5) + thump) * np.minimum(1, t / 0.006) * np.minimum(1, (d - t) / 0.05)).astype(np.float32)


def brush(seed: int = 0, d: float = 0.12) -> np.ndarray:
    t = T(d)
    return (0.25 * highpass(noise(d, seed), 3000) * np.exp(-t * 28)).astype(np.float32)


def stamp(seed: int = 0) -> np.ndarray:
    """A rubber stamp: a low wooden knock, the slap of rubber on paper, a tiny rattle of the handle."""
    d = 0.45
    t = T(d)
    knock = np.sin(2 * np.pi * (95 + 70 * np.exp(-t * 40)) * t) * np.exp(-t * 22)
    slap = lowpass(noise(d, seed), 2200) * np.exp(-t * 55)
    rattle = highpass(noise(d, seed + 7), 4000) * np.exp(-((t - 0.05) ** 2) / 0.0004) * 0.25
    return (0.9 * knock + 0.6 * slap + rattle).astype(np.float32)


def pencil(seed: int = 0, d: float = 0.4) -> np.ndarray:
    """A red pencil ring: scratchy band-passed noise with a circular swell."""
    t = T(d)
    x = highpass(lowpass(noise(d, seed), 6000), 1800)
    return (0.35 * x * np.sin(np.pi * t / d) ** 0.7 * (0.7 + 0.3 * np.sin(2 * np.pi * 9 * t))).astype(np.float32)


def crowd(d: float, seed: int = 0) -> np.ndarray:
    """A murmuring crowd: low-passed noise with a slow syllabic flutter."""
    t = T(d)
    x = lowpass(noise(d, seed), 900) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 3.1 * t + np.sin(2 * np.pi * 0.7 * t))))
    return (0.5 * x * np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.3)).astype(np.float32)


def score(ctx):
    if not ctx.words:
        raise SystemExit('score: run `cueframe-py tts` first (needs build/words.json)')
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    e1, ev, cue = ctx.event1, ctx.event, ctx.cue
    start, black = e1('sfx.drop') - 0.45, e1('sfx.black')
    montage = (cue('scene.s11.start'), cue('scene.s13.start'))
    sparse = (cue('scene.s15.start'), black)

    # The bed, bar by bar from the sign drop to the black; the last bar before the black resolves.
    t, b = start, 0
    while t < black - 0.05:
        chord, root = PROG[b % len(PROG)]
        thin = sparse[0] <= t < sparse[1]
        hot = montage[0] <= t < montage[1]
        if not thin:
            bed.put(upright(root - 12, BEAT * 1.4), t, 0.55)
            bed.put(upright(root - 12 + (7 if b % 2 else 12), BEAT * 0.9), t + 2.5 * BEAT, 0.42)
        for k, off in enumerate((1.5, 3.0)):
            if t + off * BEAT < black:
                bed.put(rhodes(chord, BEAT * 1.2, 0.9 if not thin else 1.1), t + off * BEAT, 0.5, 0.25 * (-1) ** k)
        if not thin:
            for k in range(8):
                if t + k * BEAT / 2 < black:
                    bed.put(brush(b * 8 + k), t + k * BEAT / 2, (0.5 if k % 2 else 0.3) * (1.6 if hot else 1.0), 0.3)
            if hot:
                for k in (0, 2):
                    bed.put(hat(False, seed=b + k), t + k * BEAT, 0.25)
        b += 1
        t += BAR
    # The room under everything, the crowd under the queue and the loop.
    sfx.put(roomtone(ctx.duration, -48), 0.0, 1.0)
    sfx.put(crowd(cue('scene.s04.start') - cue('scene.s03.start'), 3), cue('scene.s03.start'), 0.35)
    sfx.put(crowd(cue('scene.s14-kevin.start') - cue('scene.s13.start'), 5), cue('scene.s13.start'), 0.22)

    sfx.put(ding(1175, 1.2), e1('sfx.bell'), 0.35, -0.2)
    sfx.put(ding(880, 1.6), e1('sfx.bell') + 0.45, 0.35, -0.2)
    sfx.put(stamp(99), e1('sfx.drop'), 0.3)
    for i, s in enumerate(ev('sfx.stamp')):
        sfx.put(stamp(i), s - 0.01, 0.38, 0.15)
    for i, r in enumerate(ev('sfx.ring')):
        sfx.put(pencil(i), r, 0.55, -0.1)
    sfx.put(pop(300, 700, 0.06), e1('sfx.slap'), 0.3, -0.2)
    for i, w in enumerate(ev('sfx.bow')):
        sfx.put(pop(900, 600, 0.05), w + 0.12, 0.35, -0.3)
    for i, w in enumerate(ev('sfx.whoosh')):
        sfx.put(whoosh(0.45, up=True, seed=10 + i), w - 0.1, 0.35)
    sfx.put(typing(28, 0.11, seed=3), e1('sfx.typing'), 0.45, -0.1)
    sfx.put(whoosh(0.9, up=False, seed=21), e1('sfx.empty'), 0.4)
    sfx.put(crowd(1.6, 9), e1('sfx.flood'), 0.9)
    sfx.put(whoosh(0.3, up=False, seed=23), e1('sfx.miss') - 0.15, 0.4)
