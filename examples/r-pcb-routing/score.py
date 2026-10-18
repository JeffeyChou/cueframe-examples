"""Chiptune bed at 120 BPM under the narration, and SFX on the picture's events.

    uv run --project cueframe/python cueframe-py synth examples/r-pcb-routing/score.py --project examples/r-pcb-routing

The bed's beat 0 is t = 0, the grid the timeline's `beats` and the splits in scenes/field.ts use.
cueframe: the SFX times repeat the rules the scenes use (a word's time, the next beat), because the
picture's event times are computed in TypeScript and never written out as cues.
"""

import math

import numpy as np

from cueframe_py.audio.synth import T, env, hat, kick, lowpass, noise, note, pop, powerup, square, tri, whoosh

BPM = 120
SPB = 60 / BPM
# Am – F – C – G, one chord per bar (MIDI roots and arpeggio notes)
PROG = [(45, [69, 72, 76, 81]), (41, [65, 69, 72, 77]), (48, [67, 72, 76, 79]), (43, [67, 71, 74, 79])]


def blip(n: float, d: float, duty: float = 0.25) -> np.ndarray:
    return lowpass(square(note(n), d, duty), 5000) * env(d, 0.002, d, 6) * 0.22


def snare(d: float = 0.16) -> np.ndarray:
    return lowpass(noise(d, 7), 7000) * env(d, 0.001, d, 9) * 0.5


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
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    split = said('s1', '不止')
    stack = ctx.cue('scene.k1.start')
    final = said('k3', '布完')
    end = final + 0.5

    t, b = 0.0, 0
    while t < end:
        root, arp = PROG[(b // 8) % len(PROG)]
        k = b % 8  # eighth within the bar
        bed.put(tri(note(root - 12), SPB / 2) * env(SPB / 2, 0.003, SPB / 2, 3) * 0.35, t, 0.9)
        for s in range(2):
            n = arp[(2 * k + s) % len(arp)] + (12 if t >= stack and (2 * k + s) % 4 == 3 else 0)
            bed.put(blip(n, SPB / 4 * 0.9), t + s * SPB / 4, 0.8, 0.3 * math.sin(b + s))
        bed.put(hat(), t + SPB / 4, 0.35 if t < split else 0.5, 0.2)
        if t >= split:
            if k % 4 == 0:
                bed.put(kick(), t, 0.8)
            if k % 4 == 2:
                bed.put(snare(), t, 0.55, -0.1)
        b += 1
        t += SPB / 2

    # The last chord rings out under "布完了".
    root, arp = PROG[0]
    for j, n in enumerate(arp + [arp[0] + 12]):
        bed.put(blip(n, 2.4, 0.5), final + 0.06 * j, 0.5, -0.3 + 0.15 * j)
    bed.put(tri(note(root - 12), 2.6) * env(2.6, 0.01, 2.6, 2) * 0.4, final, 0.9)

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
    drill = said('k2', '打孔')
    for j in range(6):
        sfx.put(zap(), drill + j * 0.06, 0.4, -0.5 + 0.2 * j)
    sfx.put(whoosh(0.6, False, 90), said('k3', '十层'), 0.3)
    sfx.put(powerup(0.55), final, 0.35)
