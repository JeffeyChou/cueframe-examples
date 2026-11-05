# Pitfalls (symptom → cause → fix)

Gathered from two music films (one with 22 CC0 clips and an A/B of synthesized vs recorded foley), the scoring
section of `cueframe/docs/guide/timing-and-audio.md`, and the field note `cueframe/docs/feedback/sfx.md`. Add new entries at the end of the matching section.

## Taste (the owner's verdicts)

1. **The foley sounded synthetic.** Blocks, pops and whooshes came from `cueframe_py.audio`. Fix: recordings from
   Freesound for anything physical. The owner chose them in an A/B.
2. **The ending sounded abrupt and foreign.** A synthesized chord played after the song's last bar. Fix: let the
   song's own last hit ring out (a reverb bloom of that hit), or end the excerpt on a bar.
3. **A whoosh on every cut** is the CueFrame guide's first warning, not an owner verdict yet. Fix: a tonal cue
   in the song's key on some cuts, nothing on about half of them, never the same cue twice in a row.

## Finding sounds

4. **The top results were popular but off-topic.** Sorting purely by downloads ignores the query. `sfx search`
   re-ranks only the first `--pool` hits by relevance. Fix: a concrete query naming the material and the action;
   raise or lower `--pool` rather than sorting differently.
5. **One "stamp" placed five stamps.** The file held a sequence of hits. Fix: read the `hits` list in the profile
   `get` prints, and cut one with `ctx.sample(key, start=…, dur=…)`.
6. **A clip with a wind-up** (a breath or a swing before the main hit) will sound late if it is placed by its
   start, because `ctx.sample` trims only silence. Fix: place it by the hit (the profile's `hits`), or start the
   sample at the hit.
7. **Full-quality originals can't be downloaded.** They need OAuth2 per user, which the tool doesn't support. The
   HQ preview (MP3, ~128 kbps) is fine under music. For an exposed solo sound, ask the owner for the original.

## Score and mix

8. **The sound lands after a pause instead of at its start.** The event was at the exact instant a hold begins,
   and audio scheduled at a hold plays after it. Fix: put the event a frame before the hold.
9. **`synth` refuses to run** ("run `cueframe cues`"). `build/page-cues.json` is older than the timing code it was
   made from. Fix: `cf cues $P` first. It is in every `make.sh` before `synth`.
10. **A quiet clip disappears and a loud one jumps out** at the same gain. Freesound clips arrive at any level.
    Fix: peak-normalise each clip (the `S` helper in SKILL.md step 3) before setting gains.
11. **Clip MP3s don't go in git** (the repo rule for audio; `.gitignore` covers it). Commit only
    `data/sfx/sfx.json`, and run `sfx get` with no ids in `make.sh` to fetch the clips again.
