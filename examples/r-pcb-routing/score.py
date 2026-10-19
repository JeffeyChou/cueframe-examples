"""SFX on the picture's events (the bed is bed.py, composed first; the narration sits on its bars).

    uv run --project cueframe/python cueframe-py synth examples/r-pcb-routing/score.py --project examples/r-pcb-routing

The bed's bar 1 is t = 0 (120 BPM), the grid of the timeline's `beats` and the splits in scenes/field.ts.
The hero's turns and dodge come from timing.ts as events (`cueframe cues` first); the other SFX
times still repeat the rules the scenes use (a word's time, the next beat).
"""

import math

import numpy as np

from cueframe_py.audio.synth import T, env, pop, powerup, square, whoosh

BPM = 120
SPB = 60 / BPM
def zap(d: float = 0.18) -> np.ndarray:
    t = T(d)
    return square(np.linspace(1800, 300, len(t)), d, 0.5) * env(d, 0.001, d, 7) * 0.18


def score(ctx):
    if not ctx.words:
        raise SystemExit('run `cueframe-py tts` first (needs build/words.json)')
    lines = {ln['id']: ln for ln in ctx.words['lines']}

    def said(lid, text, end=False):
        ln = lines[lid]
        i = ln['text'].index(text)
        want = i + len(text) - 1 if end else i
        w = next(w for w in ln['words'] if want in w.get('chars', []))
        return w['t'] + w['d'] if end else w['t']

    on_beat = lambda t: math.ceil(t / SPB - 1e-6) * SPB
    sfx = ctx.track('sfx', role='sfx')
    final = said('k3', '布完')

    # Splits (scenes/field.ts): a pop on each.
    sp = [on_beat(said('s1', '不止')), on_beat(said('s2', '每一层')), on_beat(said('s2', '每一层')) + 2 * SPB, on_beat(said('s2', '布线'))]
    for j, at in enumerate(sp):
        sfx.put(pop(400 + 150 * j, 1100 + 200 * j, 0.1), at, 0.5)
    # Layers fly in bottom first (scenes/stack.ts), then the drill and the press.
    fly0 = said('k1', '十层') - 0.2
    fly_end = said('k2', '每一层', end=True) + 0.2
    step = (fly_end - fly0 - 0.8) / 9
    for j in range(10):
        sfx.put(whoosh(0.5, True, 41 + j), fly0 + j * step + 0.1, 0.18, -0.6 + 0.12 * j)
    # The hero's turns and dodge (timing.ts events, the times its path is pinned to).
    for name in ('ride.turn', 'ride.around', 'ride.turn2'):
        sfx.put(pop(300, 600, 0.06), ctx.event1(name), 0.25, 0.2)
    sfx.put(whoosh(0.35, True, 77), ctx.event1('ride.dodge') - 0.08, 0.4, 0.3)
    drill = said('k2', '打孔')
    for j in range(6):
        sfx.put(zap(), drill + j * 0.06, 0.4, -0.5 + 0.2 * j)
    sfx.put(whoosh(0.6, False, 90), said('k3', '十层'), 0.3)
    sfx.put(powerup(0.55), final, 0.35)
