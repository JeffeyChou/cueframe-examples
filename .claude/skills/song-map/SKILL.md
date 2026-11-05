---
name: song-map
description: >-
  Analyse a song before any picture is made for a CueFrame film: cut the excerpt on bar lines, get a tempo that
  isn't doubled or halved, separate the vocal, align the lyrics word by word, find the sections, and produce the
  bar-by-bar song map (time, section, drum hits, sung words) that storyboards, cue sheets and scene timings are
  planned on; then check the exported film against it. Use it whenever a CueFrame project has music: music videos
  (MV / 音乐视频 / 歌词视频 / lyric video), rhythm cuts (卡点 / 踩点 / cut to the beat), karaoke captions, scenes timed
  to lyrics or drops, a song excerpt for a promo, or when someone asks for the BPM, beats, downbeats, sections or
  lyric timing of a track, even if they only say "make a video for this song".
---

# Song map

Every timing decision in a music film (where a scene starts, which word a title lands on, where a cut goes)
should come from one table measured from the song, not from listening, because the agent can't listen. This skill
produces that table and the files behind it, with CueFrame's `cueframe-py` tools:

```
excerpt ─▶ hits (tempo, beats, sections) ─▶ stems (vocal) ─▶ lyrics --align ─▶ song map ─[GATE: owner checks]─▶ storyboard
                                                                                                  … export ─▶ sync check
```

Flags and file formats are in `cueframe/docs/guide/rhythm.md` and `cueframe/docs/guide/timing-and-audio.md`
("Lyric video", "Music first"); each tool's `--help` is the reference. This skill fixes the order, the judgement
calls and the gates. Run commands from the repository root with the helpers every `make.sh` defines:

```bash
P=<project dir, e.g. examples/my-mv>
py() { uv run -q --project cueframe/python "$@"; }
cf() { pnpm exec cueframe "$@"; }
```

## 1. The excerpt

```bash
py cueframe-py excerpt $P/data/song.mp3 --start S --dur D [--cut A:B …] --fade-out F --preset music-master --project $P
```

- Start and end on bar lines. Run `hits` once over the whole song first (no `--start/--dur`) to read the
  downbeats, then choose S, D and any cuts from them. A cut that removes whole bars keeps every downbeat after it
  on the grid; `hits` warns when a cut end is more than 20 ms off.
- To shorten a song, cut whole bars out (`--cut`) rather than speeding it up or padding it with silence.
- Stop before anything that isn't the song: AI-generated tracks (Suno) often end with a spoken platform tag.
- A master that already clips needs `--mode auto --peak -2.5` (leaves room for the AAC encoder's overs).
- Keep the source audio out of git (`.gitignore` covers audio; `make.sh` re-creates every derived file). A song
  the owner calls a local study copy never leaves the machine: don't commit it, publish it, or send it to another
  agent, and review renders go out without sound.

## 2. Tempo, beats and sections

```bash
py --group analysis cueframe-py hits $P/data/song.mp3 --start S --dur D [--cut A:B …] --explain --project $P
```

Use exactly the same `--start/--dur/--cut` as the excerpt, or every time is off by the difference.

- **Check the tempo against octave errors.** Read `--explain`'s candidate table. When the top two are a factor 2
  (or 3/2) apart with close scores (one pop song: 175.0 at 0.79 vs 87.5 at 0.78), the choice is a judgement:
  - count the snare backbeat: in 4/4 pop the snare lands on beats 2 and 4, so snares every other beat means the
    beat is right;
  - a bar should be 1.3–2.8 s in most pop (1.37 s at 175 BPM; 1.71 s at 140 BPM half-time);
  - lyric lines usually start on downbeats and last a whole number of bars (often two).
  Then pin it with `--bpm B [--meter N] [--offset S]` in `make.sh` and say why in a comment.
- **Feel** (straight, half-time, double-time) tells you where the big hits are: in half-time the snare is on 3,
  so the strong cut points are one per bar, not two.
- **Sections** are where the energy changes (verse, chorus, drop). They decide scene changes. Check them against
  the lyric text: a chorus boundary in the middle of a sung line is usually off by a bar.

## 3. Vocal stem and lyrics

```bash
py --group stems cueframe-py stems $P/data/song.mp3 --start S --dur D [--cut A:B …] --project $P   # build/sep/vocals.wav
py --group align cueframe-py lyrics $P/data/song.lrc --align $P/build/sep/vocals.wav --model large-v3-turbo \
   [--language zh] --grid $P/build/hits.json --project $P
```

- Get the text from the owner or an official source and write `data/song.lrc` with line times. Whisper's own
  transcription is a draft at best: it mishears sung words.
- Align on the **vocal stem**, not the mix, and with a large model. On one remix the small model on the mix
  matched only 18–71 % of the words; the medium model on the demucs vocal stem got 100 % of the lines.
- Read the per-line report: `matched` below ~80 % or `timing: estimated` means the words of that line are guessed.
  Fix the times by hand (enhanced LRC word tags `<mm:ss.xx>` beat any alignment), or don't animate that line word
  by word.
- **Never show a word the owner hasn't confirmed.** A misheard lyric on screen is worse than no lyric.

## 4. The song map

```bash
python3 -I .claude/skills/song-map/scripts/barmap.py $P --out build/song-map.md
```

One row per bar: start time, section (with `→k @t` in the bar where a new one begins), how many kicks, snares
and hats, the strongest hit, and the words sung. Give it to the owner together with the tempo decision, the
excerpt range and any lines whose timing is uncertain. That is the gate: planning on a wrong grid or a misheard
line wastes every frame built on it.

Plan on the map:
- Scene changes go on downbeats at section boundaries. Inside a section, change scenes every 2 or 4 bars, not on
  odd bars.
- A title or word animation lands on the sung word's onset (`f.words()` / `said()` in scenes, `saidIn()` in
  `timing.ts`), not on the nearest beat. Voices sit slightly off the grid, and viewers read text with the voice.
- Cut only on strong hits (`f.hit({ kind, min })`); cutting on every hit is noise. Leave room: long shots between
  a few strong cuts read as edited, constant cutting reads as a slideshow.
- In timeline code, derive times from the files (`ctx.data.hits`, `hits.json` downbeats, `lyrics.json` words)
  rather than typing seconds, so a re-cut excerpt moves everything with it.

## 5. After the export

```bash
cf sync $P/out/<format>.mp4 --hits $P/build/hits.json --min 0.5 --kinds kick,snare
cf sync $P/out/<format>.mp4 --cues <event names>      # frames + waveform at named events
cf measure $P/out/<format>.mp4
```

- `sync --hits` reports every strong hit as on time, early, late or missed against the picture's cuts. More than
  a frame late reads as sloppy. A cut a frame early reads as tight.
- `sync --cues` shows the frame and the waveform at each event. Look at the images: a title should be on screen
  when its word starts.
- You can't hear the result. Say so, give the numbers, and ask the owner to listen.

## Reference

- `references/pitfalls.md`: problems already hit once (symptom → cause → fix). Read it before step 1, and add an
  entry after each film.
- For sound effects and the mix after the picture is cut, use the `sound-design` skill.
