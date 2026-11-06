---
name: sourcing
description: >-
  Find real material for a CueFrame film in public archives and keep its paper trail: archival footage, photographs,
  paintings, newspapers, recordings, satellite and map data, from Wikimedia Commons, archive.org, the Library of
  Congress, NASA, the Met, NASA GIBS/Worldview, Landsat and Sentinel via the Planetary Computer, USGS lidar. Decides
  whether a file may be used (public domain, CC0, CC BY, what not to touch), fetches only the seconds the film needs
  without committing media, records title, author, date, licence, source page and the seconds used in
  data/sources.json, and checks it with `cueframe-py credits`. Use it whenever a film needs 素材 / 找素材 / 档案影像 /
  老照片 / 历史影像 / archival or stock footage / public-domain images / 卫星图 / satellite imagery / 证据片 /
  evidence or documentary material / 版权 / 许可 / licence / 出处 / provenance / credits / 片尾署名, or before
  delivering any film that contains a file somebody else made.
---

# Sourcing

A film that uses real material makes a promise: this is what it says it is, and we may show it. Both halves
are checked before the file reaches a scene, and both are written down so the credits, the end card and a
later question ("where is this from?") are answered from the record, not from memory.

```
brief ─▶ 1 needs list ─▶ 2 search ─▶ 3 rights ─[GATE: unclear → don't use]─▶ 4 fetch ─▶ 5 record ─▶ 6 credits check ─▶ end card
```

Run from the repository root with the helpers every `make.sh` defines:

```bash
P=<project dir>
py() { uv run -q --project cueframe/python "$@"; }
lookup() { python3 .claude/skills/sourcing/scripts/lookup.py "$@"; }   # draft an entry from an archive URL
```

## 1. Needs list

Before searching, list what must be real and what can be drawn. Real material is for what the audience
must believe happened (a place on a date, an event, a measurement); everything else is cheaper and
safer drawn in a kit. For each need: what it shows, how long on screen, the period, and whether it is
**evidence** (the film argues from it) or **illustration** (it sets a mood). Evidence has stricter rules
(below).

## 2. Search

Search the institutions that hold the original before aggregators; the holder's own page carries the
rights statement that counts. Endpoints, fields and quirks: [references/archives.md](references/archives.md).

| Need | Look first | Then |
|---|---|---|
| Film before ~1930, US cities, events | Library of Congress (film-and-videos) | archive.org (Prelinger, FedFlix), Commons |
| US government film (newsreels, training, NASA, USGS) | archive.org FedFlix / NARA, images.nasa.gov | Commons |
| Space, launches, Earth from orbit | images.nasa.gov | NASA GIBS/Worldview, Commons |
| Photographs, prints, newspapers | Library of Congress (photos, Chronicling America) | Commons, Flickr Commons, the Met |
| Paintings, prints, objects | the Met Open Access (CC0) | Commons, other museums' open-access sets |
| Satellite views of a place on a date | Worldview snapshot (daily MODIS/VIIRS) | Landsat / Sentinel-2 via Planetary Computer |
| Terrain, buildings in 3D | USGS 3DEP lidar (EPT) | NAIP aerials (US) |
| Recorded sound | archive.org (78 rpm, Great 78), LoC National Jukebox | Freesound via `sound-design` |

Search in the archive's language and the period's words ("moving picture", "aeroplane", place names as
they were). Keep candidates in a scratch list with their page URLs; pick by what the shot needs, then by
resolution and the cleanest transfer.

## 3. Rights

Classify every candidate with `credits`' own classes; a file that doesn't land in one is not used.

| Class | Examples | Use |
|---|---|---|
| free | CC0, Public Domain Mark, PD-US-expired, US federal work (NASA, USGS, NOAA), "no known restrictions" (LoC) | yes; credit the archive anyway |
| by | CC BY 2.0–4.0 | yes, with the exact credit line on the end card |
| by-sa | CC BY-SA | only as a separate, unmodified clip; ask the owner first (share-alike may reach the film) |
| nc / nd | CC BY-NC, BY-ND, "educational use" | no for a public channel; `credits --allow-nc` only for private work the owner approves |
| unknown | no statement, "all rights reserved", stock-site watermarks, YouTube re-uploads | no |

- **US public domain as of 2026**: works published in 1930 or earlier; sound recordings published in 1925 or
  earlier; US federal government works of any date; many 1931–1977 works published without a notice (prove
  it: look at the title and end cards, write what you saw in `note`). Each January adds one year.
- **Outside the US** the clock is usually the author's death + 70 years. For a European film, write the
  director's death year in `note`.
- **A licence field is a claim.** A Commons uploader or an archive.org user can be wrong. Trust in this
  order: the holding institution's statement, then a reasoned tag (PD-US-expired with a date), then a
  bare licence field. When they disagree, don't use it.
- **Inside a free file**, things can still be owned: logos, artworks in the frame, recognisable people in
  a modern photo (NASA: no implied endorsement), music on a newsreel soundtrack. Mute or crop, or pass.

## 4. Fetch

- Media is never committed (`AGENTS.md`): the project's `make.sh` fetches it into gitignored
  `data/clips/` (or `data/images/`, `data/audio/`) if missing, so a fresh clone rebuilds.
- Take only what the film uses. An HTTP-seekable MP4 gives an excerpt without the whole file:
  `ffmpeg -user_agent "$UA" -ss <in> -i <url> -t <dur> -an -c:v libx264 -crf 18 data/clips/x.mp4`
  (`-ss` before `-i`). Leave a second of margin on each side for retiming.
- One connection, a descriptive User-Agent, back off on 429 and retry later; prefer the holder's own server
  (tile.loc.gov, archive.org/download) over Wikimedia's transcodes.
- A whole file you keep goes to a cache by its hash, the way fonts and instruments do; pin the hash or
  byte size in `make.sh` so a changed upstream file is noticed.
- Footage then becomes plates with `py cueframe-py footage clips.json` (`cueframe/docs/guide/plates.md`),
  retimed with `speed` when the transfer runs slow (archives note "at about 15 fps").

## 5. Record

Every third-party file gets one entry in `$P/data/sources.json`; `lookup <url>` drafts it from a
Commons, archive.org, LoC or images.nasa.gov page (the archive's rights text lands in `note`; you still
decide the licence).

```json
{"sources": [{
  "id": "market-street", "kind": "footage", "file": "data/clips/market.mp4",
  "title": "A trip down Market Street before the fire", "author": "Miles Brothers", "date": "1906-04-14",
  "licence": "Public domain", "page": "https://www.loc.gov/item/00694408/",
  "url": "https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00015143/00015143.mp4",
  "retrieved": "2026-11-05", "spec": "h264 1440×1080, 24 fps transfer of a ~15 fps print",
  "credit": "Library of Congress, Motion Picture, Broadcasting, and Recorded Sound Division",
  "note": "LoC: collection in the public domain, free to use and reuse",
  "used": [{"src": [455, 461.9], "film": [3, 9]}, {"src": [470.6, 477.5], "film": [9, 15]}]
}]}
```

- `kind`: footage, image, audio, music, data, font, other. `used[].src` is seconds in the source file
  (footage plates fill it from their manifest); `film` is seconds, a cue, or `[cue, cue]`.
- `credit` overrides the generated line when the archive asks for its own wording (LoC credit lines,
  "Contains modified Copernicus Sentinel data 2024").
- Sound effects stay in `data/sfx/sfx.json`, instruments in `stems.json`, fonts in `fonts.json`;
  `credits` reads all of them.

## 6. Check and credit

```bash
py cueframe-py credits --project $P      # fails on a missing licence, page, author, an NC file, a plate with no entry
```

It writes `build/credits/SOURCES.md` (the table of everything used) and `CREDITS.txt` (required lines first).
Put the required lines on the end card or in the post's description, and the holding archive on the end card
even when the licence asks for nothing. Read the warnings: a file under `data/` with no entry means the
ledger is incomplete.

## Evidence films

Satellite briefings, lidar surveys, microscope films, archive light tables, briefing boards: the image is the
argument, so:

- **Show what it is.** Caption the date, place and instrument on screen (MODIS Terra 2024-08-01, Landsat 8
  OLI, USGS 3DEP). Never age, recolour or composite material in a way that changes what it shows; false
  colour and enhancement are said on screen.
- **Never pass a reconstruction off as a record.** A drawn or simulated shot is labelled, and new footage
  is never "aged" to look like archive.
- **Keep the query.** For data products record the request (layer, bbox, date, bands, rescale) in `spec`, so the
  frame can be fetched again and checked.
- **Use the provider's acknowledgement** in `credit`: NASA Worldview/GIBS ("We acknowledge the use of
  imagery from the NASA Worldview application, part of the NASA Earth Science Data and Information System
  (ESDIS)"), Landsat ("Landsat imagery courtesy of the U.S. Geological Survey"), Sentinel ("Contains modified
  Copernicus Sentinel data <year>").
- **Facts on screen have a source too**: dates, numbers and names go in the project's notes with the page
  they came from (Gemini or another model can help find it, but the page is what counts).

## Done when

Every third-party file under `data/` has an entry, `credits` passes with no problems, the end card or
description carries the required lines, and nothing in `data/clips/`, `data/images/` or `data/audio/` is
tracked by git.
