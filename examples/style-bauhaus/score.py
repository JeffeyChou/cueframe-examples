"""Bed and foley for 方圆: the dry bossa of the Bauhaus fables (upright bass, Rhodes comping, brushes)
on the eighth-note grid the hops and stamps step on (100 BPM from the first hop), stopping as the
circle swells over the frame; two held chords under the moral; a rising harp for the paper columns;
three chimes for the primitives. Times from timing.ts (`cueframe cues` → build/page-cues.json).

    pnpm exec cueframe cues examples/style-bauhaus
    uv run --project cueframe/python cueframe-py synth examples/style-bauhaus/score.py --project examples/style-bauhaus
"""

import numpy as np

from cueframe_py.audio.synth import T, boing, ding, env, highpass, lowpass, noise, note, pop, sine

BEAT = 0.6  # 100 BPM; the grid in timing.ts is its eighth notes
BAR = 4 * BEAT
# F major ii–V–I–vi: Gm7 – C9 – Fmaj7 – Dm7 (voicings, bass root), MIDI
PROG = [([55, 58, 62, 65], 43), ([52, 58, 62, 64], 36), ([57, 60, 64, 65], 41), ([53, 57, 60, 62], 38)]


def rhodes(chord, d: float = 0.5, vel: float = 1.0) -> np.ndarray:
    t = T(d)
    x = np.zeros_like(t)
    for n in chord:
        f = note(n)
        x += (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t + 0.7 * np.sin(2 * np.pi * f * t))) * np.exp(-t * 3.2)
    return (0.11 * vel * lowpass(x * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.06), 2400)).astype(np.float32)


def upright(n: float, d: float = 0.6) -> np.ndarray:
    f = note(n)
    t = T(d)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9)
    thump = np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 30) * 0.4
    return (0.5 * (x * np.exp(-t * 3.5) + thump) * np.minimum(1, t / 0.006) * np.minimum(1, (d - t) / 0.05)).astype(np.float32)


def brush(seed: int = 0, d: float = 0.12) -> np.ndarray:
    return (0.25 * highpass(noise(d, seed), 3000) * np.exp(-T(d) * 28)).astype(np.float32)


def block(f: float = 900, seed: int = 0) -> np.ndarray:
    """A woodblock: the stepped hops and the marker."""
    d = 0.12
    t = T(d)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.6 * t)) * np.exp(-t * 45) * 0.5 + highpass(noise(d, seed), 2000) * np.exp(-t * 120) * 0.15


def stamp(seed: int = 0) -> np.ndarray:
    """A rubber stamp: a low wooden knock, the slap of rubber on paper, a tiny rattle of the handle."""
    d = 0.45
    t = T(d)
    knock = np.sin(2 * np.pi * (95 + 70 * np.exp(-t * 40)) * t) * np.exp(-t * 22)
    slap = lowpass(noise(d, seed), 2200) * np.exp(-t * 55)
    rattle = highpass(noise(d, seed + 7), 4000) * np.exp(-((t - 0.05) ** 2) / 0.0004) * 0.25
    return (0.9 * knock + 0.6 * slap + rattle).astype(np.float32)


def pencil(seed: int = 0, d: float = 0.45) -> np.ndarray:
    t = T(d)
    x = highpass(lowpass(noise(d, seed), 6000), 1800)
    return (0.35 * x * np.sin(np.pi * t / d) ** 0.7 * (0.7 + 0.3 * np.sin(2 * np.pi * 9 * t))).astype(np.float32)


def roll(d: float, turns: float, seed: int = 0) -> np.ndarray:
    """A disc rolling on paper: a low rumble with a soft tick each half turn."""
    t = T(d)
    x = lowpass(noise(d, seed), 260) * 0.8
    for k in range(int(turns * 2)):
        i = int(len(t) * k / (turns * 2))
        x[i:i + 600] += np.sin(2 * np.pi * 180 * t[:600]) * np.exp(-t[:600] * 80) * 0.5
    return x * np.sin(np.pi * t / d) ** 0.5


def strain(d: float) -> np.ndarray:
    """Squeezing: a tight rising tone that wobbles, in three pushes."""
    t = T(d)
    f = 220 * 2 ** (t / d) * (1 + 0.02 * np.sin(2 * np.pi * 11 * t))
    pushes = np.clip(np.sin(np.pi * ((t / d * 3) % 1)), 0, 1) ** 0.6
    return lowpass(np.sign(sine(f, d)) * 0.3 + sine(f, d) * 0.5, 1800) * pushes * 0.35


def harp(n: float, d: float = 1.0) -> np.ndarray:
    f = note(n)
    return (sine(f, d) + 0.3 * sine(2 * f, d) + 0.1 * sine(3 * f, d)) * env(d, 0.003, d, 5) * 0.4


def score(ctx):
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    e1, ev = ctx.event1, ctx.event
    start, wipe = ev('sfx.hop')[0], e1('sfx.wipe')

    # The bossa, bar by bar from the first hop to the swell.
    t, b = start, 0
    while t < wipe - 0.05:
        chord, root = PROG[b % len(PROG)]
        bed.put(upright(root - 12, BEAT * 1.4), t, 0.45)
        if t + 2.5 * BEAT < wipe:
            bed.put(upright(root - 12 + (7 if b % 2 else 12), BEAT * 0.9), t + 2.5 * BEAT, 0.42)
        for k, off in enumerate((1.5, 3.0)):
            if t + off * BEAT < wipe:
                bed.put(rhodes(chord, BEAT * 1.2, 0.9), t + off * BEAT, 0.5, 0.25 * (-1) ** k)
        for k in range(8):
            if t + k * BEAT / 2 < wipe:
                bed.put(brush(b * 8 + k), t + k * BEAT / 2, 0.5 if k % 2 else 0.3, 0.3)
        b += 1
        t += BAR
    ctx.section('poster', 0, start)
    ctx.section('fable', start, wipe)
    ctx.section('moral', wipe, e1('sfx.columns'))
    ctx.section('end', e1('sfx.columns'), ctx.duration)

    # The moral: a low swell as the circle fills the frame, a held chord per line.
    bed.put(upright(29, 2.2), wipe + 0.4, 0.5)
    for i, at in enumerate(ev('sfx.line')):
        bed.put(rhodes([57, 60, 64, 65] if i == 0 else [53, 57, 60, 64], 2.6, 1.2), at, 0.7, 0.15 * (-1) ** i)
    for i, n in enumerate([65, 69, 72, 77]):
        bed.put(harp(n), e1('sfx.columns') + i * 0.12, 0.3, -0.3 + 0.2 * i)
    for i, (at, n) in enumerate(zip(ev('sfx.shapes'), [77, 81, 84])):
        bed.put(ding(note(n), 1.4), at, 0.35, -0.3 + 0.3 * i)

    for i, at in enumerate(ev('sfx.hop')):
        sfx.put(block(820 if i % 2 else 980, i), at + 0.2, 0.35, -0.4 + 0.1 * i)
    for i, at in enumerate(ev('sfx.label')):
        sfx.put(block(1500, 20 + i), at, 0.2)
    for i, at in enumerate(ev('sfx.step')):
        sfx.put(block(1250, 30 + i), at, 0.35, 0.1 * i)
    for i, at in enumerate(ev('sfx.stamp')):
        sfx.put(stamp(i), at - 0.01, 0.2, -0.2 + 0.15 * i)
    sfx.put(pencil(3), e1('sfx.ring'), 0.6, 0.3)
    sfx.put(roll(1.0, 2, 5), ev('sfx.label')[0], 0.5, 0.5)  # the circle rolls in as label 01 rises
    sfx.put(pop(500, 1000, 0.08), e1('sfx.legs'), 0.35, 0.4)
    sq = e1('sfx.squeeze')
    sfx.put(strain(1.45), sq, 0.4, 0.35)
    sfx.put(boing(0.5), e1('sfx.pop'), 0.45, 0.4)
    sfx.put(roll(0.5, 0.5, 9), e1('sfx.pop') + 0.25, 0.4, 0.6)
    for i, at in enumerate(ev('sfx.nod')):
        sfx.put(block(700, 40 + i), at, 0.3)
    for i, at in enumerate(ev('sfx.speaker')):
        sfx.put(block(760 if i % 2 else 900, 50 + i), at + 0.22, 0.25, 0.4)
    sfx.put(pop(300, 700, 0.1), e1('sfx.said'), 0.3)
    for i, at in enumerate(ev('sfx.turn')):
        sfx.put(block(1100, 60 + i), at, 0.3, -0.3)
