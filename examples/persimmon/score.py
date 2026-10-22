"""Score for The last persimmon: a plucked 96 BPM bed in C, and SFX on the picture's events.

Tonal cues only (no whooshes on the cuts; the wind is the one noise and it is in the picture). The sulk is
thinner and about 5 dB lower; the bonk is followed by a beat of silence; the music comes back on the joy.
"""

from cueframe_py.audio import Track, blip, bloom, bonk, glide, harp, lowpass, pad, pluck, pop, reverb, soft_impact, sparkle, whoosh

BPM = 96
PROG = [(60, 64, 67), (57, 60, 64), (53, 57, 60), (55, 59, 62)]   # C Am F G
SAD = [(57, 60, 64), (50, 53, 57)]                                # Am Dm


def score(ctx):
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    music = Track(ctx.duration)
    g = ctx.grid(BPM)
    bar = 4 * g.spb
    sulk, wind, bonk_t, joy, close = (ctx.event1(f'sfx.{n}') for n in ('sulk', 'wind', 'bonk', 'joy', 'close'))
    end = close - 0.8
    ctx.section('arrive', 0, sulk)
    ctx.section('sulk', sulk, bonk_t)
    ctx.section('joy', bonk_t, ctx.duration)

    def arp(k, b, prog=PROG, octave=12, d=0.45):
        chord = prog[b % len(prog)]
        return pluck(chord[k % 3] + octave, d)

    # arrive: pad and a quarter-note arpeggio, eighths once Dou wants the fruit
    want = ctx.event1('sfx.want')
    music.pattern(g, lambda k, b: pad(PROG[b % 4], bar * 1.02, cutoff=900), 'x' + '.' * 15, 0, sulk, 0.45)
    music.pattern(g, lambda k, b: arp(k, b), 'x...x...x...x...', 0.0, want, 0.5)
    music.pattern(g, lambda k, b: arp(k, b, d=0.3), 'x.x.x.x.x.x.x.x.', want, sulk, 0.42)
    # sulk: a minor pad, a slow arpeggio an octave down, held through the gust
    music.pattern(g, lambda k, b: pad(SAD[b % 2], bar * 1.02, cutoff=600), 'x' + '.' * 15, sulk, bonk_t - 0.1, 0.2)
    music.pattern(g, lambda k, b: arp(k, b, SAD, 0, 0.8), 'x.......x.......', sulk, wind, 0.2)
    # joy: the arpeggio returns brighter; it stops for the last chord as the iris closes
    music.pattern(g, lambda k, b: pad(PROG[b % 4], bar * 1.02, cutoff=1400), 'x' + '.' * 15, joy, end, 0.42)
    music.pattern(g, lambda k, b: arp(k, b, octave=24, d=0.3), 'x.x.x.x.x.x.x.x.', joy, end, 0.36)
    music.put(bloom((60, 64, 67, 71), 2.4), end, 0.5)
    music.put(reverb(music.data, 2.0, seed=3), 0, 0.22)
    bed.put(music.data, 0)
    ctx.write_beats(g)

    e1 = ctx.event1
    sfx.put(bloom((72, 76, 79, 83), 1.6), e1('sfx.iris'), 0.3)
    for i, t in enumerate(ctx.event('sfx.steps')):
        sfx.put(pop(260, 180, 0.05), t, 0.35, -0.4 + 0.25 * (i % 2))
    sfx.put(blip(84), e1('sfx.seen'), 0.5)
    sfx.put(harp((67, 72, 76, 79, 84), step=0.05), e1('sfx.want'), 0.35, 0.2)
    sfx.put(glide(67, 79, 0.5), e1('sfx.jump'), 0.35)
    sfx.put(soft_impact(40, 0.6), e1('sfx.land'), 0.6)
    sfx.put(harp((69, 65, 62, 57), step=0.14, d=1.0, up=False), sulk, 0.3, -0.2)
    sfx.put(lowpass(whoosh(2.2, up=False), 900), wind, 0.35, 0.5)
    sfx.put(glide(79, 62, 0.6), e1('sfx.drop'), 0.3)
    sfx.put(bonk(), bonk_t, 0.7)
    sfx.put(sparkle(1.0), bonk_t + 0.06, 0.25, 0.3)
    sfx.put(pop(), e1('sfx.catch'), 0.45)
    sfx.put(blip(88), e1('sfx.realise'), 0.45)
    sfx.put(harp((72, 76, 79, 84, 88), step=0.04), joy, 0.3, -0.2)
