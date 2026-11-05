---
name: sound-design
description: >-
  Design and mix the sound of a CueFrame film once its picture is timed: a cue sheet from the picture's events,
  recorded sound effects from Freesound (CC0 first, chosen by downloads and votes because the agent can't listen),
  tuned synth cues only where a sound must be in the song's key, a music bed when there is no song, ducking and
  loudness to the delivery target, licence credits, and checks for what can't be heard. Use it whenever a CueFrame
  project needs 音效 / 配音效 / 拟音 / foley / SFX / sound effects / 配乐 / background music / 混音 / mix / loudness / LUFS,
  when the user says a film "needs sound", "sounds synthetic", or asks to find a sound on Freesound, or before
  delivering any film whose audio hasn't been designed yet.
---

# Sound design

The film's sound is built in code like its picture: a `score.py` turns the picture's named events into stems,
`mix.json` mixes them with the music or voice, and checks measure the result. The agent can't hear any of it, so
every choice is made from evidence (other listeners' downloads and votes, measured onsets and loudness, spectra),
and the owner listens at the end.

```
picture timed ─▶ 1 cue sheet ─[GATE: owner agrees what sounds]─▶ 2 find sounds ─▶ 3 score.py ─▶ 4 mix ─▶ 5 checks ─▶ owner listens
```

Flags and APIs are in `cueframe/docs/guide/timing-and-audio.md` ("Events", "Scoring", "Loudness") and each
tool's `--help`. Run from the repository root with the helpers every `make.sh` defines:

```bash
P=<project dir>
py() { uv run -q --project cueframe/python "$@"; }
cf() { pnpm exec cueframe "$@"; }
```

## The owner's taste so far (apply unless told otherwise)

- **Recorded beats synthesized for real objects.** In an A/B of synthesized foley against CC0 recordings on the
  same film, the recordings won. Synthesis is for tuned, musical cues: chimes, pings,
  swells in the song's key.
- **Let the song end itself.** A synthesized chord after the song's last bar sounded abrupt and foreign. Let the
  song's own last hit ring out (a reverb bloom of it), or cut the excerpt to end on a bar.
- **Less is more.** Leave about half the cuts without a cue; the downbeat and the next shot's own sound carry them.
  Never the same cue twice in a row. A big impact for about five structural moments only.
- **No noise whooshes on transitions** in a music film. Use a tonal cue in the current key, or nothing.

## 1. Cue sheet

Write the cue sheet before searching: one row per sound, decided from the picture, not from what's available.

| event | time | what is seen | sound | source | level |
|---|---|---|---|---|---|
| `sfx.coins` | 3.42 | coins stack on the desk | three small metal clinks | recorded | under the music |
| `sfx.chime` | 7.10 | the sun lights up | one bell note in F minor | synth `ding(note(77))` (F5) | clear |

- Each picture moment that gets a sound is a named event in the project's `timing.ts`
  (`events('sfx', { coins: …, chime: … })`), with its time derived from the song map or the scene (`saidIn`, hit
  times), never typed in seconds. `cf cues $P` writes `build/page-cues.json`; the score reads it as
  `ctx.event1('sfx.coins')`, and `synth` refuses a stale one.
- An event exactly at the start of a hold sounds after the hold. Put it just before.
- Show the cue sheet to the owner with what you plan to leave silent. Adding sounds later is cheap; undoing a
  film full of sounds is not.

## 2. Find recorded sounds (Freesound)

```bash
py cueframe-py sfx search "coins drop desk" -n 8 --max-dur 3        # CC0 only by default
py cueframe-py sfx get fs:510731 fs:510732 --project $P             # cache + data/sfx/sfx.json + profile
```

- Search with what the microphone heard ("coins dropped on wooden desk close"), not what it means ("money").
- Choose by evidence, in this order: downloads; many votes over a high average (★4.4 from 380 votes beats ★4.9
  from 6); a description that names the microphone, the source and the processing.
- Then read the profile `get` prints before trusting it: `onset` (late onsets are trimmed by `ctx.sample`, but a
  long breath before the hit means the hit isn't where you think), `hits` (a file with five stamps when you want
  one: take `start`/`dur` around one), `tail`, `lufs` and `brightness` (dark < 1 kHz ≤ mid < 3 kHz ≤ bright; a
  bright sound cuts through the music, a dark one hides under it).
- Licences: CC0 by default. Attribution (`--license by`) is fine when the end card carries the `sfx credits`
  lines. NonCommercial or Sampling+ only with `--allow-nc` and the owner's OK.
- The MP3s stay out of git: `data/sfx/sfx.json` lists them, and `sfx get` with no ids in `make.sh` fetches them
  again. The API key is `$FREESOUND_API_KEY` or `~/.config/cueframe/freesound.key`.

## 3. The score

`score.py` defines `score(ctx)`. Copy the closest existing one (`examples/*/score.py`, the scoring section of the
guide for a synthesized bed) and adapt it. Recorded foley over a song looks like this:

```python
import numpy as np

STAMP, COIN = 'fs:470710', 'fs:510731'          # name every clip once, at the top

def score(ctx):
    sfx = ctx.track('sfx', role='sfx')
    def S(key, dur=None, peak_db=-6.0):
        """A clip, leading silence trimmed, faded out at `dur`, normalised to a peak so gains compare."""
        x = ctx.sample(key, dur=dur, trim=True)
        if dur is not None:
            n = min(len(x), int(0.04 * ctx.sr))
            x[-n:] *= np.linspace(1, 0, n)[:, None]
        return x * (10 ** (peak_db / 20) / (float(np.max(np.abs(x))) or 1.0))

    ctx.section('song', 0, ctx.event1('sfx.end'))  # sections make synth report RMS per part
    sfx.put(S(COIN), ctx.event1('sfx.coins') - 0.01, 0.5)
```

- Place each clip so its onset lands on the event. `ctx.sample` trims leading silence. For a clip with a
  wind-up, subtract the time to its main hit.
- Normalise clips to a common peak (the `S` helper) and set the balance with `put` gains, so a quiet recording
  and a loud one compare.
- Tuned cues use the song's key from the song map (`note(n)` takes a MIDI number: `ding(note(77))` is an F5 bell). A score with its own music: two buses, drums
  dry and music with a reverb send, sidechained to the kick (`music.sidechain`).
- **No song?** A bed from `ctx.grid` + `track.pattern` stays exactly on the picture's grid. An instrumental from
  a music model, rendered at a set tempo and length, is treated like a song (song-map skill).

## 4. Mix

```bash
cf cues $P
py cueframe-py sfx get --project $P
py cueframe-py synth $P/score.py --project $P        # build/stems/*.wav, RMS per section, spectrum.png
py cueframe-py mix $P/mix.json --project $P          # ducking + loudness → build/audio.wav
cf export $P && cf measure $P/out/<format>.mp4
```

`mix.json` lists the stems with roles and gains, the ducking under a voice, and the target (`-14` LUFS
integrated, true peak ≤ `-1.5` dBTP by default; a music film delivers with `timeline({ deliver: 'music-master' })`,
podcasts −16, broadcast −23). Each stem's role sets its default gain (bed 0.36, sfx 0.42, other 0.5); change a
stem's `gain` in mix.json, or one sound's `put` gain in the score, rather than the target.

## 5. Checks (what can't be heard)

- `synth` fails on a NaN or silent stem. Read its RMS per section: does the loud section match the plan? Is any
  stem silent where the cue sheet says it sounds?
- Look at `build/stems/spectrum.png` and the per-stem spectra with the Read tool: effects should show as short
  bright marks at their events, not a smear across the film. Nothing should sit above the music's level outside
  the big moments.
- `cf sync $P/out/<format>.mp4 --cues sfx.coins,sfx.chime` shows the frame and the waveform at each event. Look at
  them: the transient should start on the frame where the thing happens.
- `cf measure` passes: integrated loudness and true peak against the delivery preset, and for a narrated film
  the voice-over-bed margin.
- Report the numbers, the clips and their licences (`sfx credits`), and say plainly that you couldn't listen. The
  owner judges by ear. When unsure between two approaches, build both as separate scores and let the owner A/B
  them.

## Reference

- `references/pitfalls.md`: problems already hit once (symptom → cause → fix). Read it before step 2, and add an
  entry after each film.
- Song timing (beats, sections, lyric words) comes from the `song-map` skill.
