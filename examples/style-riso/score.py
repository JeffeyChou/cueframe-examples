"""雨停了: a small band on sampled instruments (`cueframe-py instruments fetch vcsl karoryfer`), one
instrument per plate as it lands: pizzicato bass with the teal, vibraphone with the yellow, nylon
guitar (Karplus–Strong) with the pink. 96 BPM in F, Fmaj7 – Dm9 – Bbmaj7 – C6. While the rain thins
the band drops to the vibraphone alone; the downbeat at the umbrella brings everyone back. Press
foley: the roller's swish under each plate, a drum thunk on cuts, the title stamped twice.

    pnpm exec cueframe cues examples/style-riso
    uv run --project cueframe/python --group instruments cueframe-py synth examples/style-riso/score.py --project examples/style-riso
"""

import numpy as np

from cueframe_py.audio import sampler, strings
from cueframe_py.audio.mixing import reverb
from cueframe_py.audio.synth import T, env, highpass, lowpass, noise

BAR = 2.5
BEAT = BAR / 4
# Fmaj7 – Dm9 – Bbmaj7 – C6: bass root, vibraphone voicing, guitar voicing.
PROG = [
    (41, (64, 69, 72, 76), (53, 57, 60, 64)),
    (38, (62, 65, 69, 76), (50, 57, 60, 64)),
    (46, (62, 65, 69, 74), (46, 53, 57, 62)),
    (36, (64, 67, 69, 72), (48, 55, 60, 64)),
]
# The vibraphone line over each bar (beat, pitch): a falling figure like rain off a gutter.
LINE = [(0, 76), (1.5, 74), (2, 72), (3, 69)]


def swish(d: float = 0.6, seed: int = 1) -> np.ndarray:
    """The roller: rubber on paper, band-passed noise that rises then lifts off."""
    t = T(d)
    x = highpass(lowpass(noise(d, seed), 3200), 500)
    return x * np.sin(np.pi * np.minimum(1, t / d)) ** 1.5 * 0.35


def thunk(seed: int = 2) -> np.ndarray:
    """The drum turning over: a dull wooden knock with a short paper slap."""
    d = 0.25
    body = sampler.hit('woodblock', 'c', vel=0.5, dur=d)
    slap = highpass(noise(0.03, seed), 1500) * env(0.03, 0.001, 0.03, 8) * 0.4
    out = np.zeros(max(len(body), len(slap)))
    out[:len(body)] += body.mean(axis=1) if body.ndim == 2 else body
    out[:len(slap)] += slap
    return lowpass(out, 2500) * 0.7


def score(ctx):
    sampler.seed(7)
    bed = ctx.track('bed', role='bed')
    press = ctx.track('press', role='sfx')
    e1 = lambda n: ctx.event1(f'sfx.{n}')  # noqa: E731
    ev = lambda n: ctx.event(f'sfx.{n}')  # noqa: E731
    plates = ev('plate')
    stop, snap = e1('stop'), e1('snap')
    teal, yellow, pink = plates
    end = ctx.duration

    def bar_of(t: float) -> int:
        return int(t / BAR + 1e-6)

    def playing(inst: str, t: float) -> bool:
        """Who plays when: each enters with its plate, the bass and guitar rest while the rain thins."""
        thin = stop <= t < snap
        if inst == 'bass':
            return t >= teal - 0.2 and not thin
        if inst == 'vib':
            return t >= yellow - 0.05
        return t >= pink - 0.05

    for b in range(int(end / BAR) + 1):
        t0 = b * BAR
        root, vib, gtr = PROG[b % 4]
        for k, off in enumerate((0, 1.5, 2.5)):
            t = t0 + off * BEAT
            if t >= end - 0.3 or not playing('bass', t):
                continue
            pitch = root if k != 1 else root + 7
            bed.put(sampler.note('jazz_bass', pitch, dur=BEAT * 1.4, vel=0.75 - 0.1 * k), t, gain=0.9, pan=-0.1)
        if playing('vib', t0) and t0 < end - 1:
            bed.put(sampler.chord('vibraphone', vib, dur=BAR * 0.9, vel=0.42, strum=0.012), t0, gain=0.55, pan=0.25)
        for beat, p in LINE:
            t = t0 + beat * BEAT
            if playing('vib', t) and t < end - 0.8:
                bed.put(sampler.note('vibraphone', p + (0 if b % 4 != 2 else -2), dur=BEAT * 1.6, vel=0.6), t, gain=0.7, pan=0.3)
        for beat in (1, 3):
            t = t0 + beat * BEAT
            if playing('gtr', t) and t < end - 0.5:
                bed.put(strings.strum('nylon_guitar', gtr, dur=BEAT * 1.8, vel=0.55, up=beat == 3), t, gain=0.5, pan=-0.3)
    # the last chord rings over the pull-back
    last = bar_of(end - 0.01) * BAR
    bed.put(sampler.chord('vibraphone', PROG[0][1], dur=end - last, vel=0.35), last, gain=0.45, pan=0.25)
    bed.data += reverb(bed.data, decay=2.2, seed=3) * 0.22

    for i, t in enumerate(plates):
        press.put(swish(0.6, seed=10 + i), t, gain=0.8, pan=-0.6 + 0.6 * i)
    for t in ev('cut'):
        press.put(thunk(), t, gain=0.8)
    for i, t in enumerate(ev('title')):
        press.put(thunk(seed=20 + i), t, gain=1.0 - 0.25 * i)
        press.put(sampler.hit('shaker', 'slap', vel=0.5), t, gain=0.5)
    press.put(swish(1.2, seed=31), ev('sheet')[0] - 1.2, gain=0.5)
    press.put(sampler.hit('shaker', 'roll', vel=0.3), stop, gain=0.35, pan=0.2)

    ctx.section('rain', 0, stop)
    ctx.section('thinning', stop, snap)
    ctx.section('clear', snap, end)
