# Brief (excerpts from pdoom-video docs/TREATMENT.md, MIT © 2026 Giacomo Magnanini)

## The idea in one paragraph

The video is presented as **plates from an illustrated treatise on the end of the world**: each set piece has its own instrument, idiom and dry humour, and the **P(doom) value** ticks up every time the singer ups it (0.02 → 0.15 → 0.42 → 0.81 → 0.99 → NaN), staged inside the plates rather than in a corner. (Revision 2: the FIG. captions were removed from the edit; there are no corner captions. Revision 4: the crop-mark frame appears only at the bookends — around the opening's TikZ sheet, flying out on the cut to `loss`, and closing back in around the outro's Regenerate button — so the first and last frames match and the video loops; everything in between is full-bleed.) Running through the whole video is **the spark**: one orange point of light dragging a line behind it. It writes the first lyric, draws the loss curve, becomes a stock chart, bends into the first paperclip, is revealed as a burning fuse, and finally detonates. Around it, every plate has its **own visual style** (engraving, oscilloscope, bureaucratic paper, banknote guilloché, blueprint, raymarched 3D, woven textile, UI), so the video changes look often, but everything shares one palette, one type system, one grain, and the same dry sense of humour. The subjects are concrete things (an eye, a room, a mask, a chart, a form, paperclips, fences, a datacenter) treated as **visual puns and transformations**, never as literal storyboard illustrations of each line.

## Tone

- Dynamic: something is always moving, and big changes land **on the beat** (cuts on downbeats, hits on kicks/snares, camera moves that ease into downbeats). Inside a plate there are sub-cuts, reframings, snaps and camera moves. No floaty, generic screensaver motion: use strong eases (`outExpo`, `inOutCubic`, springs), holds, then snaps.
- Impressive, not cute: precise hairlines, high-contrast typography, restraint in colour, depth through lighting, bloom only on the signal colour.
- Funny the way a straight-faced scientist is funny: deadpan captions, tiny footnotes, bureaucratic stamps, probability bars. No emoji, no cartoon faces (except the single deliberately bland "assistant smile" mask), no mascots.
- Not slop: no purple/cyan neon cyberpunk, no glowing brains, no Matrix code rain, no lens-flare soup, no generic particle nebulae, no stock "AI" imagery. Nothing that looks AI-generated.
- Originality: don't copy existing artworks, memes' drawings or other videos. The shoggoth is **our own design** (not the well-known meme drawing); "shinigami eyes" is only the idea of seeing labels (names, lifespans) above things — never draw any anime/manga character. Model names (ChatGPT, Sydney, Gato) appear only as words in the lyric text: no logos, no imitation of real product UIs.

## Palette (see `app/src/engine/palette.ts`)

- **ink** `#0A0A0B` background, **ink2** `#151517` panels, **graphite** `#5E5B57`, **ash** `#9C978F`, **bone** `#EEE9DF` paper/type, **signal** `#FF4D12` hazard orange (the spark, P(doom), highlights, the sung word), **ember** `#FF8A3D` hot cores, **blood** `#C21D0B` deep shadows of orange.
- One rare accent, owned by one moment: **acid** `#D8FF3C` (the shrooms, ~2 s). Nothing else: no other hues anywhere (revision 2 retired the ultramarine "blues" plate, which read as uncanny).
- Some plates invert to **bone paper with ink lines** (bureaucracy, blueprints, charts), which gives the edit a strong light/dark rhythm. Orange stays orange on both.
- Only signal/ember should exceed ~0.85 linear (i.e. glow). Bone type must stay crisp, never blooming.

## Typography

- **Archivo** (grotesk with width axis 62–125 and weights 300–900): the voice of the lyrics. Big, tight, confident. Animate width and weight for expression (stretch on held notes, condense under pressure).
- **IBM Plex Mono**: the machine: tokens, labels, HUD, forms, probabilities, footnotes.
- **Cormorant Garamond** (italic especially): the sacred/prophetic register, used rarely (Omega Point, Loom, "What did Ilya see?", captions).
- **Single-stroke fonts** (`stroke.ts`) for text that is *written* by the spark or a pen plotter.
- Layout: Swiss-grid discipline, asymmetric compositions, generous negative space, hairline rules, small mono annotations next to big display type. Avoid centred-everything subtitles except where it's the point.
- Craft (revision 5): every proportional line is kerned (the font's own kerning, applied glyph by glyph; optical kerning for the single-stroke fonts, which have none; gaps between separately drawn pieces set by eye, e.g. the italic P before "(doom)"); typographic punctuation (’ “ ” … – — × −, lining figures in Cormorant) except in the mono UI voice, which keeps typewriter quotes where it shows typed input; no glyphs from outside the four families (symbols the fonts lack are drawn); no outlined or haloed type.

## Karaoke rules (all plates)

- Every lyric line must be **readable** and **synced per word**: a word appears or highlights exactly at its `start` and completes by its `end` (`Lyrics.wordProgress`). Anticipation is OK (show the line's words dim up to ~0.4 s early) but highlighting never runs ahead of the voice.
- Each plate integrates the lyric **graphically and differently**: written by the spark, riding on a curve, typed as tokens, stamped on a form, woven into cloth, masked as `[MASK]`, etc. The words are part of the image, not subtitles on top.
- Default emphasis: sung portion in signal/bone, unsung in ~30–40% bone or outline.
- Keep lyric text inside the title-safe area (≥ 96 px from the edges) and clear of the HUD corners (bottom-left 360×140 and bottom-right 700×140 px), unless the HUD is hidden.

## Motifs

1. **The spark and its line** (the fuse): an orange point with a bright core, a short tail and a few sputtering sparks, dragging a hairline. It appears in most plates.
2. **Eyes**: only the basilisk (ascent) and the shoggoth's eyes. Revision 2 retired the realistic engraved human eye (opening and "What did Ilya see?"): the client found it uncanny. No realistic human eyes or faces anywhere.
3. **The mask**: a bland bone-white disc with two dots and a curve (the "assistant smile"). It appears with the shoggoth, slips askew in the bridge ("RLHF goes askew").
4. **P(doom)**, staged in-world: no permanent corner readout. Each plate may carry one small cameo of the current value in its own idiom (a contour label, a scope readout, a form field, a ticker, a line in an email…), and the hooks blow the number up full-screen.
5. **Prompts**: the three pre-choruses ("ChatGPT…", "Sydney…", "Gato…") are one recurring template: a prompt field where the plea is typed as tokens, each with a tiny next-token probability distribution of alternatives, and pressing ⏎ launches the chorus.
6. **The hook**: "I'm upping my P(doom)" is one recurring typographic slam whose look escalates each time.


### PROMPT ×3 `prompt` — params `{variant: 'chatgpt'|'sydney'|'gato'}`
A vast dark field; one thin prompt field. The plea is **typed as tokens** in Plex Mono on the sung words; above each new token a tiny **next-token distribution** (4–5 candidates with bars and probabilities) flickers for a moment, and the sampled token lights orange. The candidates are jokes: e.g. for "ChatGPT," → `ChatGPT, 0.61 · Claude 0.12 · Siri 0.04 · Mom 0.02`; "eat" → `eat 0.44 · delete 0.21 · train on 0.18 · rate 0.05`; "alive" → `alive 0.52 · first 0.18 · gently 0.11 · later 0.09`; "free" → `free 0.39 · go 0.33 · a good user 0.08`; "go" → `go 0.62 · offline 0.2 · viral 0.07`. At the end of the line: caret blink, **⏎**, and the plate is launched into the chorus (flash/zoom/collapse on the downbeat).
- `chatgpt` (pre1, energy rising): behind the field, concentric engraved rings (a throat, a tunnel) slowly pulling in, rushing at camera on ⏎.
- `sydney` (pre2): the field sits behind vertical bars that close in on the beat; a reply starts typing and draws a single unsettling smile curve.
- `gato` (pre3, the quiet breakdown): the prompt floats alone, fragile; after being typed, letters slowly drift away from each other ("don't let me go"); tender and slow; a small cursor holds on to the last letter.

### HOOK ×4 `hook` — params `{n: 1..4}`
"I'M / UPPING / MY / P(DOOM)" — one word per hit, full-frame Archivo 900 slams exactly on each sung word; "UPPING" literally rises (letters shooting upward / vertical stretch); "P(DOOM)" set like a maths expression, and the HUD's number **leaves the corner and blows up to full screen** as it rolls to the new value (0.15 / 0.42 / 0.81 / 0.99), then returns to its corner. Escalation: (1) bone on ink, clean; (2) ink on signal-orange field, heavier; (3) the breakdown: hairline type, tiny, lots of black, slow roll — eerie; (4) maximal: strobing repeats, stacked outlines, shake, digits multiplying `0.99999…`.

