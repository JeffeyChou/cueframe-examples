# Pitfalls (symptom → cause → fix)

Gathered from two music films (a 140 BPM half-time Suno remix in Chinese, a 175 BPM 4/4 pop song in English)
and the footage examples (locomotion, survey-of-rain). Add new entries at the end of the matching section.

## Excerpt and grid

1. **Everything drifts by a fraction of a second.** `hits` and `excerpt` ran with different `--start/--dur/--cut`,
   so their times were measured on different clips. Fix: one set of numbers, written once in `make.sh` and passed
   to both (and to `stems` and `lyrics`).
2. **A spoken voice at the end of the track** ("made with …"). AI-music platforms append a tag. Fix: end the
   excerpt before it, with a short fade (`--fade-out 0.35`).
3. **The beat after a cut is off the grid.** The cut didn't remove whole bars. Fix: take A and B from the downbeat
   list of a whole-song `hits` run. `hits` warns when a cut end is more than 20 ms off.
4. **Tempo at half or double speed.** The two candidates scored almost the same (175.0 at 0.79 vs
   87.5 at 0.78). Fix: decide with the backbeat, the bar length and the lyric phrasing (SKILL.md step 2), then pin
   it with `--bpm`. With `--bpm`, `tempoConfidence` is null in hits.json, which is expected.
5. **Half-time songs cut twice as often as they feel.** The snare is on beat 3, so beats 2 and 4 are weak. Fix:
   read `feel` and cut on the snare, not on every beat.

## Lyrics

6. **Only 18–71 % of the words matched** (the Chinese remix). The default small Whisper model ran on the full mix. Fix: align
   on the demucs vocal stem with `--model medium` or larger (then 100 % of the lines matched; the worst line
   matched 90 %).
7. **Whisper heard different words** (after a drop; puns on homophones). Sung words, wordplay
   and mixed languages defeat it. Fix: the owner supplies the text; Whisper only times it. Never put an
   unconfirmed word on screen.
8. **A whole line's words animate wrongly.** Its timing was `estimated` (nothing was heard in that window), so the
   fill doesn't follow the voice. Fix: hand-written word tags in the LRC (`<00:12.34>word`), or animate the line as
   one block.
9. **A title lands early or late although it is on the beat.** Singers phrase off the grid. Fix: time text to the
   word's aligned onset, not to the nearest beat.

## Sync and delivery

10. **The sync check lists hits nobody meant to cut on.** By default it counts every hit, hats included. Fix: run
    it as the footage examples do (`--min 0.5 --kinds kick,snare`), and judge only the cuts that are meant to land
    on a hit.
