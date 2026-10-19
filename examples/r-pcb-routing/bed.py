"""The 120 BPM chiptune bed, composed first on a fixed bar plan (music-first): the narration is then
placed on these bars by `tts` (script.json "music"), and the picture follows the narration.

    uv run --project cueframe/python cueframe-py synth examples/r-pcb-routing/bed.py --project examples/r-pcb-routing --duration 50

Writes build/stems/bed.wav and build/beats.json (bar 1 beat 1 at t = 0, a bar is 2 s). The bars below
are the ones script.json anchors to.
"""

import math

from cueframe_py.audio.synth import env, hat, kick, lowpass, noise, note, square, tri

BPM = 120
SPB = 60 / BPM
SPLIT = 11   # drums come in: "不止" lands here and the frame splits
STACK = 17   # the arpeggio lifts an octave: "把这十层叠起来"
FINAL = 23   # the last chord: "布完" lands here
# Am – F – C – G, one chord per bar (MIDI roots and arpeggio notes)
PROG = [(45, [69, 72, 76, 81]), (41, [65, 69, 72, 77]), (48, [67, 72, 76, 79]), (43, [67, 71, 74, 79])]


def blip(n: float, d: float, duty: float = 0.25):
    return lowpass(square(note(n), d, duty), 5000) * env(d, 0.002, d, 6) * 0.22


def snare(d: float = 0.16):
    return lowpass(noise(d, 7), 7000) * env(d, 0.001, d, 9) * 0.5


def score(ctx):
    grid = ctx.grid(BPM)
    ctx.write_beats(grid)
    bar = lambda b: grid.bar(b - 1)
    bed = ctx.track('bed', role='bed')
    t, b = 0.0, 0
    while t < bar(FINAL):
        root, arp = PROG[(b // 8) % len(PROG)]
        k = b % 8  # eighth within the bar
        bed.put(tri(note(root - 12), SPB / 2) * env(SPB / 2, 0.003, SPB / 2, 3) * 0.35, t, 0.9)
        for s in range(2):
            n = arp[(2 * k + s) % len(arp)] + (12 if t >= bar(STACK) and (2 * k + s) % 4 == 3 else 0)
            bed.put(blip(n, SPB / 4 * 0.9), t + s * SPB / 4, 0.8, 0.3 * math.sin(b + s))
        bed.put(hat(), t + SPB / 4, 0.35 if t < bar(SPLIT) else 0.5, 0.2)
        if t >= bar(SPLIT):
            if k % 4 == 0:
                bed.put(kick(), t, 0.8)
            if k % 4 == 2:
                bed.put(snare(), t, 0.55, -0.1)
        b += 1
        t += SPB / 2
    # The last chord rings out from the final bar.
    root, arp = PROG[0]
    for j, n in enumerate(arp + [arp[0] + 12]):
        bed.put(blip(n, 2.4, 0.5), bar(FINAL) + 0.06 * j, 0.5, -0.3 + 0.15 * j)
    bed.put(tri(note(root - 12), 2.6) * env(2.6, 0.01, 2.6, 2) * 0.4, bar(FINAL), 0.9)
