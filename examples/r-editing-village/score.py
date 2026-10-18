"""Bed and effects for the slice: a quiet, slightly crooked piano waltz under the narration and
foley-like synth effects on the actions (whip, rush, books landing, the dark turn, the instruction).

    uv run --project cueframe/python cueframe-py synth examples/r-editing-village/score.py
    uv run --project cueframe/python cueframe-py mix examples/r-editing-village/mix.json

Effect times are the scenes' own: timing.ts declares them as events, `cueframe cues` publishes them,
ctx.event() reads them (run `pnpm exec cueframe cues examples/r-editing-village` before synth).
"""

import numpy as np

from cueframe_py.audio import pad
from cueframe_py.audio.synth import T, bonk, boom, ding, kick, lowpass, noise, note, pop, sparkle, whoosh

BPM = 84
# A minor, a little music-box: Am – F – Dm – E (chord notes, bass root), MIDI
PROG = [([57, 60, 64, 69], 45), ([53, 57, 60, 65], 41), ([50, 53, 57, 62], 38), ([52, 56, 59, 64], 40)]


def piano(n: float, d: float = 2.4, vel: float = 1.0) -> np.ndarray:
    f = note(n)
    t = T(d)
    x = np.zeros_like(t)
    for k in range(1, 7):
        fk = f * k * (1 + 0.0005 * k * k)
        x += np.sin(2 * np.pi * fk * t) * (1 / k ** 1.5) * np.exp(-t * (1.1 + 0.8 * k) * (f / 440) ** 0.3)
    att = np.minimum(1, t / 0.005)
    rel = np.minimum(1, (d - t) / 0.2)
    return (0.26 * vel * lowpass(x * att * rel, 2600 + 1400 * vel)).astype(np.float32)


def thud(d: float = 0.35, seed: int = 0) -> np.ndarray:
    """A book landing: a low knock and a short burst of paper noise."""
    t = T(d)
    body = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 30)) * t) * np.exp(-t * 18)
    slap = lowpass(noise(d, seed), 1800) * np.exp(-t * 40)
    return (0.8 * body + 0.5 * slap).astype(np.float32)


def score(ctx):
    if not ctx.words:
        raise SystemExit('score: run `cueframe-py tts` first (needs build/words.json)')
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    beat = 60 / BPM
    bar = 3 * beat
    end = ctx.cue('scene.s12.end')
    t, b = 0.0, 0
    while t < end - bar:
        chord, root = PROG[b % len(PROG)]
        bed.put(pad([n - 12 for n in chord[:3]], bar * 1.2, cutoff=800, detune=0.005), t, 0.3)
        bed.put(piano(root - 12, bar * 1.1, 0.7), t, 0.6, -0.15)
        for j in (1, 2):
            bed.put(piano(chord[j] + 12 * (b % 2), 1.6, 0.55), t + j * beat, 0.45, 0.2 * (-1) ** j)
        # The waltz limps on purpose in bars 7–8: a late third beat (the village's choppy animation).
        b += 1
        t += bar + (0.12 if b % 8 == 7 else 0.0)
    bed.put(piano(PROG[0][1] - 24, 5.0, 0.8), t, 0.6)
    bed.put(pad([45, 52, 57, 60], max(1.0, ctx.duration - t), cutoff=900), t, 0.35)

    # Actions, at the times the scenes use (timing.ts); small leads are the sounds' own pre-roll.
    e1 = ctx.event1
    sfx.put(whoosh(0.45, up=True, seed=3), e1('sfx.whip'), 0.5, 0.4)
    sfx.put(pop(700, 1500, 0.08), e1('sfx.point') - 0.1, 0.35)
    sfx.put(whoosh(0.5, up=False, seed=5), e1('sfx.ring'), 0.2)
    sfx.put(whoosh(0.35, up=True, seed=9), e1('sfx.rush') - 0.1, 0.55, -0.5)
    sfx.put(kick(0.3), e1('sfx.land'), 0.5)
    for i, land in enumerate(ctx.event('sfx.books')):
        sfx.put(thud(0.35, seed=i), land, 0.7 if i == 0 else 0.5, 0.1 * (-1) ** i)
    sfx.put(boom(0.9), e1('sfx.dark') - 0.1, 0.45)
    sfx.put(bonk(0.4), e1('sfx.say') - 0.1, 0.25)
    sfx.put(pop(500, 1300, 0.09), e1('sfx.pop') - 0.1, 0.45)
    fly = e1('sfx.fly')
    sfx.put(whoosh(0.6, up=True, seed=11), fly, 0.35, 0.3)
    sfx.put(ding(1568, 1.2), fly + 0.7, 0.3, 0.3)
    sfx.put(sparkle(1.4), fly + 0.75, 0.22, 0.3)
