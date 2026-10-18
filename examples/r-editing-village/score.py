"""Bed and effects for the slice: a quiet, slightly crooked piano waltz under the narration and
foley-like synth effects on the actions (whip, rush, books landing, the dark turn, the instruction).

    uv run --project cueframe/python cueframe-py synth examples/r-editing-village/score.py
    uv run --project cueframe/python cueframe-py mix examples/r-editing-village/mix.json

cueframe: effect times repeat the scenes' timing rules (said(), the book schedule) because scenes
cannot hand event times to the audio side; keep the two in step by hand.
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


def said(ctx, line_id: str, text: str) -> float:
    line = next(ln for ln in ctx.words['lines'] if ln['id'] == line_id)
    at = line['text'].index(text)
    w = next((w for w in line['words'] if at in w.get('chars', [])), None) or next(w for w in line['words'] if w['chars'][0] >= at)
    return w['t']


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

    # Actions, at the same times the scenes use.
    sfx.put(whoosh(0.45, up=True, seed=3), ctx.cue('scene.s2.start') - 0.32, 0.5, 0.4)
    sfx.put(pop(700, 1500, 0.08), said(ctx, 's2', '指向') - 0.1, 0.35)
    sfx.put(whoosh(0.5, up=False, seed=5), said(ctx, 's3', '镜头'), 0.2)
    sfx.put(whoosh(0.35, up=True, seed=9), said(ctx, 's6', '冲') - 0.1, 0.55, -0.5)
    sfx.put(kick(0.3), said(ctx, 's6', '台'), 0.5)
    first, a, b2 = said(ctx, 's7', '机会'), said(ctx, 's8', '软件'), said(ctx, 's8', '夜晚') - 0.4
    lands = [first] + [a + (b2 - a) * (i - 1) / 6 for i in range(1, 8)]
    for i, land in enumerate(lands):
        sfx.put(thud(0.35, seed=i), land, 0.7 if i == 0 else 0.5, 0.1 * (-1) ** i)
    sfx.put(boom(0.9), said(ctx, 's9', '不一样') - 0.1, 0.45)
    sfx.put(bonk(0.4), said(ctx, 's11', '说') - 0.1, 0.25)
    sfx.put(pop(500, 1300, 0.09), said(ctx, 's12', '运镜') - 0.1, 0.45)
    fly = said(ctx, 's12', '改顺')
    sfx.put(whoosh(0.6, up=True, seed=11), fly, 0.35, 0.3)
    sfx.put(ding(1568, 1.2), fly + 0.7, 0.3, 0.3)
    sfx.put(sparkle(1.4), fly + 0.75, 0.22, 0.3)
