# r-ascii — world.execute(me); as a terminal ASCII MV

A full-length ASCII-character music video for Mili's *world.execute(me);*. It is set inside one program UI: menu and tab bars, docked panels, a viewport, a bilingual caption band, a one-row spectrum and a status bar. The panels slide, orbit, swap and close, and the viewport expands to full screen. CRT tearing, ghost rows, colour fringes, phosphor halo, scanlines, a rolling band and power-on/off are all done in cell space.

The same engine renders two targets:

| Target | Command (from the repo root) |
|---|---|
| Terminal (truecolor ANSI, 30 fps) | `node examples/r-ascii/term/play.ts` |
| mp4 (1920×1080, canvas CRT + glow) | `pnpm exec cueframe export examples/r-ascii --gpu hardware` |

## Music

Lyric timing comes from `data/lyrics.json`. The track itself is not in the repo. Put your copy at `data/music.mp3` (`.m4a`, `.flac`, `.wav`, `.ogg` also work), then run:

```sh
uv run --project cueframe/python python -I examples/r-ascii/tools/audio.py examples/r-ascii/data/music.mp3
```

This writes three things:
- `build/audio.wav`: the mp4 export picks it up automatically.
- `build/audio.json`: the real 48-band spectrum for the bottom band.
- A beat grid: the panels and glitches pulse on the real beats.

Without a track, the player runs silent and the spectrum and beats are procedural (130 BPM, phase-fitted to the lyric onsets).

## Terminal player

```
node examples/r-ascii/term/play.ts [--audio file] [--start seconds] [--fps 30] [--256] [--mute]
```

- **Keys:** `space` pauses, `←/→` seek 5 s, `↑/↓` seek 30 s, `q` quits.
- **Audio:** played by `ffplay` (seeking follows the picture). Falls back to `afplay`, which can only start from 0.
- **Terminal size:** 160×45 or larger looks best. Zoom out with Cmd/Ctrl −.
- **Recommended terminals:** Ghostty, iTerm2, kitty or WezTerm (truecolor + synchronized output).
- **Terminal.app:** has no truecolor, so the player switches to 256 colours there automatically.
- **Output:** only changed cells are written, inside synchronized-update brackets. That is about 1.5–3 MB/s at 180×50.

## Layout of the code

- **`engine/`** — pure functions of `(t, frame, size)`. There is no DOM, so they run under Node and in the browser.
  - `cells.ts`: a truecolor cell buffer, wide-glyph aware.
  - `song.ts`: lines, acts, beats and spectrum.
  - `font.ts`: block-letter banners from a glyph atlas.
  - `gfx.ts`: 3D projection, fields, raymarching and warp.
  - `ui.ts`: the program chrome and captions.
  - `post.ts`: cell-space CRT.
  - `frame.ts`: the compositor.
  - `scenes/*`: one `Scene` per act (17 acts, derived from lyric indices).
- **`term/`** — `play.ts` is the player. `dump.ts` writes cell dumps for `tools/snap.py`, which gives quick terminal-look stills without a browser.
- **`scenes/`** — the cueframe adapter:
  - `screen.ts` draws the cells to canvas, then runs the CRT and glow.
  - `captions.ts` sets the large EN/ZH captions as DOM.
- **`tools/`**:
  - `glyphs.py` builds `build/glyphs.json`.
  - `audio.py` analyses the music.
  - `snap.py` rasterises cell dumps.

The build steps, from the repository root: `uv run --project cueframe/python python -I examples/r-ascii/tools/glyphs.py`, `bash scripts/fetch-fonts.sh` (NotoSansSC is not committed), `jq -r 'map(.zh) | join("")' examples/r-ascii/data/lyrics.json > examples/r-ascii/build/zh.txt` (the caption characters), and `uv run --project cueframe/python cueframe-py fonts examples/r-ascii/build/zh.txt examples/r-ascii/data/fonts/NotoSansSC.ttf --project examples/r-ascii` for the caption font subset.
