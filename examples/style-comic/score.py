"""Bed and foley for the comic strip: a bouncy ukulele-ish pluck in C that starts when the camera
enters panel 1 and stops dead on the pillow's 啪; the bell trill; a sleepy glockenspiel tag for the
last panel. Every sound is timed from timing.ts (`cueframe cues` → build/page-cues.json).

    pnpm exec cueframe cues examples/style-comic
    uv run --project cueframe/python cueframe-py synth examples/style-comic/score.py --project examples/style-comic
"""

import numpy as np

from cueframe_py.audio.synth import T, boing, bonk, boom, click, ding, env, highpass, lowpass, noise, note, pluck, pop, sine, whoosh

BEAT = 0.5  # 120 BPM
# C – Am – F – G, one bar each; voicings for the strum, bass roots.
PROG = [((60, 64, 67, 72), 48), ((57, 60, 64, 69), 45), ((53, 57, 60, 65), 41), ((55, 59, 62, 67), 43)]


def strum(chord, seed: int, d: float = 0.42) -> np.ndarray:
    """A down-strum: the strings a few ms apart."""
    out = np.zeros(int(48000 * (d + 0.04)))
    for i, n in enumerate(chord):
        x = pluck(n, d, seed + i)
        k = int(48000 * 0.009 * i)
        out[k:k + len(x)] += x * 0.3
    return out


def glock(n: float, d: float = 1.2) -> np.ndarray:
    f = note(n)
    return (sine(f, d) + 0.25 * sine(f * 2.76, d) * np.exp(-T(d) * 6)) * env(d, 0.002, d, 4) * 0.4


def alarm(d: float, seed: int = 3) -> np.ndarray:
    """A mechanical alarm bell: a hammer striking two bells ~22 times a second."""
    out = np.zeros(int(48000 * (d + 0.3)))
    k, i = 0.0, 0
    while k < d:
        f = 2350 if i % 2 else 2620
        s = (sine(f, 0.25) + 0.5 * sine(f * 2.32, 0.25) + 0.3 * sine(f * 3.9, 0.25)) * env(0.25, 0.0008, 0.25, 6)
        s[:960] += highpass(noise(0.02, seed + i), 3000) * env(0.02, 0.0005, 0.02, 8) * 0.6
        a = int(48000 * k)
        out[a:a + len(s)] += s * 0.22
        k += 1 / 22
        i += 1
    n = min(len(out), len(T(d + 0.3)))
    return out[:n] * np.minimum(1, (d + 0.3 - T(d + 0.3)[:n]) / 0.25)


def snore(d: float = 1.6, seed: int = 9) -> np.ndarray:
    """In on a low buzz, out on a breath."""
    t = T(d)
    half = d / 2
    buzz = lowpass(np.sign(np.sin(2 * np.pi * 38 * t)) * (0.6 + 0.4 * noise(d, seed)), 700)
    breath = highpass(lowpass(noise(d, seed + 1), 2500), 400)
    inn = np.where(t < half, np.sin(np.pi * t / half) ** 2, 0)
    out = np.where(t >= half, np.sin(np.pi * (t - half) / half) ** 2, 0)
    return 0.22 * buzz * inn + 0.12 * breath * out


def thwack(seed: int = 5) -> np.ndarray:
    """The pillow: a soft heavy slap with a low body."""
    d = 0.5
    t = T(d)
    slap = lowpass(noise(d, seed), 1800) * np.exp(-t * 30)
    return 0.9 * slap + 0.7 * boom(d, seed) * 0.6


def score(ctx):
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    e1, ev = ctx.event1, ctx.event
    start, hit = e1('sfx.panel1'), e1('sfx.hit')

    # The strum, from panel 1 to the hit, quieter under the bell.
    t, b = start, 0
    ring = (e1('sfx.ring'), hit)
    while t < hit - 0.02:
        chord, root = PROG[(b // 4) % 4]
        quiet = 0.55 if ring[0] <= t < ring[1] else 1.0
        if b % 2 == 0:
            bed.put(pluck(root - 12, 0.9, 50 + b) * 0.9, t, 0.6 * quiet)
        bed.put(strum(chord, 10 * b, 0.36), t + BEAT / 2, (0.5 if b % 2 else 0.4) * quiet, 0.2 * (-1) ** b)
        b += 1
        t += BEAT
    ctx.section('page', 0, start)
    ctx.section('strum', start, hit)
    ctx.section('aftermath', hit, ctx.duration)

    # The sleepy tag: a slow lullaby fall over panel 4 and the pull-back.
    tag = e1('sfx.tbc')
    for i, n in enumerate([79, 76, 72, 74, 71, 67, 72]):
        bed.put(glock(n, 1.6), tag - 1.3 + i * 0.5, 0.3 if i < 6 else 0.36, 0.1 * (-1) ** i)

    for i, t in enumerate(ev('sfx.ink')):
        sfx.put(click(70 + i), t, 0.5, -0.3 + 0.2 * i)
        sfx.put(lowpass(noise(0.05, 80 + i), 1500) * env(0.05, 0.001, 0.05, 6), t, 0.2, -0.3 + 0.2 * i)
    sfx.put(pop(300, 900, 0.12), e1('sfx.mast'), 0.45)
    for i, t in enumerate(ev('sfx.tick')):
        sfx.put(bonk(0.15) * (1.4 if i == 2 else 1), t, 0.25)
    sfx.put(boing(0.4), e1('sfx.wake'), 0.4)
    sfx.put(alarm(hit - e1('sfx.ring') - 0.05), e1('sfx.ring'), 0.55)
    for i, t in enumerate(ev('sfx.hop')):
        sfx.put(bonk(0.2), t + 0.48, 0.18, 0.2 * (-1) ** i)
    sfx.put(ding(2093, 0.5), e1('sfx.ring2'), 0.3, 0.4)
    sfx.put(whoosh(0.55, up=True, seed=7), e1('sfx.throw') + 0.05, 0.45, -0.4)
    sfx.put(thwack(), hit, 0.9)
    sfx.put(lowpass(noise(0.35, 12), 900) * env(0.35, 0.002, 0.35, 6), e1('sfx.drop'), 0.55)
    sfx.put(boom(0.4, 13), e1('sfx.drop'), 0.3)
    sfx.put(pop(500, 1100, 0.1), e1('sfx.balloon'), 0.4)
    sfx.put(snore(1.6), e1('sfx.snore'), 0.7)
    sfx.put(snore(1.6, 11), e1('sfx.snore') + 1.6, 0.6)
