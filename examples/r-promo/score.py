"""Original comic-pop bed + SFX for r-promo, all placed on cues from build/cues.json."""

from cueframe_py.audio import (SFX, bass, boing, bonk, boom, clap, click, crash, ding, glitch, hat, kick, pad, pluck,
                               pop, powerup, riser, scratch, slurp, sparkle, stab, trombone, typing, whoosh)

BPM = 124
PROG = [([60, 64, 67], 36), ([55, 59, 62], 43), ([57, 60, 64], 45), ([53, 57, 60], 41)]  # C G Am F
RIFF = [0, 2, 1, 2, 3, 2, 1, 4]  # chord-tone index per 8th note (index 3/4 = octave up)


def score(ctx):
    bed = ctx.track('bed', role='bed')
    sfx = ctx.track('sfx', role='sfx')
    c = ctx.cue
    drop = c('stop.give')
    crash_t, back = c('fail.crash'), drop - 1.2
    g = ctx.grid(BPM, land=drop)
    end = ctx.duration - 0.3
    for t, k, b in g.steps(0, end, 4):
        if crash_t - 0.02 <= t < drop - 0.01:
            continue
        chord, root = PROG[b % 4]
        full = t >= drop
        busy = t >= c('fail.login') - 0.1
        if k % 16 == 0:
            bed.put(pad(chord, 4 * g.spb), t, 0.32 if full else 0.24)
            if full:
                bed.put(stab([n + 12 for n in chord]), t, 0.25)
        if k % 4 == 0:
            bed.put(kick(), t, 0.85 if full or k % 8 == 0 else 0.0)
        if busy and k % 8 == 4:
            bed.put(clap(), t, 0.5)
        if busy and k % 2 == 1:
            bed.put(hat(k % 4 == 3), t, 0.22 if full else 0.15, -0.3)
        if k % 4 in (0, 3) and (full or k % 8 == 0):
            bed.put(bass(root + (12 if k % 8 == 3 else 0), g.spb * 0.4), t, 0.5)
        if k % 2 == 0:
            i = RIFF[(k // 2) % 8]
            n = chord[i % 3] + 12 * (1 + i // 3)
            if (k // 2) % 8 != 7:
                bed.put(pluck(n, 0.35, seed=k % 7), t, 0.32 if full else 0.26, 0.25)
    ctx.write_beats(g)
    # the crash kills the music; tails are cut, the riser brings it back
    bed.fade(crash_t - 0.03, crash_t + 0.02, 1.0, 1e-4).gain(crash_t + 0.02, drop - 0.01, 0.0)
    bed.put(riser(1.2), back, 0.5)
    bed.fade(ctx.duration - 1.4, ctx.duration, 1.0, 0.0)

    hits = [
        (pop(500, 1300), 0.21, 0.5), (pop(600, 1500), 0.50, 0.5), (pop(700, 1700), 0.78, 0.5),
        (boom(0.6), c('hook.one'), 0.55), (whoosh(0.35), c('hook.one') - 0.25, 0.4),
        (bonk(0.25), c('hook.one') + 0.35, 0.35), (bonk(0.25), c('hook.one') + 0.55, 0.3), (bonk(0.25), c('hook.one') + 0.75, 0.35),
        (boing(), c('hook.what'), 0.6),
        (ding(1568, 0.6), c('fail.login'), 0.45), (slurp(), c('fail.steal'), 0.55),
        (click(), c('fail.pdf'), 0.7), (glitch(0.7), c('fail.garble'), 0.4),
        (glitch(0.3, seed=7), crash_t - 0.05, 0.4), (crash(1.2), crash_t, 0.6), (boom(), crash_t, 0.7),
        (trombone(), c('fail.black'), 0.55),
        (scratch(0.45), c('stop.stop') - 0.12, 0.5), (boom(0.7), c('stop.stop'), 0.8),
        (powerup(), drop, 0.4), (whoosh(0.3), drop - 0.2, 0.35), (whoosh(0.3, seed=2), c('stop.give') + 0.16 - 0.2, 0.35),
        (whoosh(0.3, seed=3), c('stop.give') + 0.33 - 0.2, 0.35),
        (pop(400, 1200), c('iso.addr'), 0.6), (whoosh(0.4), c('iso.own') - 0.3, 0.4),
        (bonk(), c('iso.cookie'), 0.55), (click(), c('iso.token'), 0.7), (boom(0.6), c('iso.revoke'), 0.75),
        (typing(14, 0.04), c('dep.server') + 0.05, 0.6), (ding(1760, 0.5), c('dep.cmd') + 0.3, 0.4),
        (typing(14, 0.04, seed=5), c('dep.join') + 0.05, 0.6), (ding(1976, 0.5), c('dep.join') + 1.0, 0.4),
        (pop(500, 1400), c('dep.claude'), 0.55), (pop(600, 1600), c('dep.codex'), 0.55), (pop(700, 1800), c('dep.pi'), 0.55),
        (sparkle(), c('dep.done'), 0.6),
        (glitch(0.25, seed=9), c('scene.perks.vo') + 0.1, 0.35), (powerup(), c('perk.revive'), 0.4),
        (whoosh(0.3), c('perk.pdf') - 0.2, 0.4), (typing(10, 0.04), c('perk.pdf') + 1.15, 0.5),
        (pluck(76, 0.3), c('perk.peek') - 0.45, 0.4), (pluck(79, 0.3), c('perk.peek') - 0.3, 0.4),
        (bonk(0.6), c('perk.nope'), 0.6), (boom(0.5), c('perk.nope'), 0.6),
        (sparkle(1.0, seed=4), c('cmp.fill'), 0.55),
        (typing(15, 0.05), c('cta.gh') + 0.35, 0.55), (ding(2093, 0.8), c('cta.star'), 0.5),
        (sparkle(1.4, seed=8), c('cta.star') + 0.05, 0.6), (crash(1.8), c('cta.star'), 0.25),
    ]
    for k in range(6):
        hits.append((click(seed=k), c('cmp.orig') + 0.15 + 0.13 * k, 0.8))
        hits.append((ding(1568 + 120 * k, 0.35), c('cmp.fill') + 0.1 + 0.12 * k, 0.32))
    for x, t, gain in hits:
        sfx.put(x, t, gain)
