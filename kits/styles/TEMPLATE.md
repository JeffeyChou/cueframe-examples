# <Style name> (<中文名>)

<!-- A bible holds only what stays true for every film in this look. The demo's story, shots,
timings, palette picks, props and score belong in examples/style-<name>/README.md. A number you
measured in the demo becomes a rule here ("cards hold 2.5–4 s"), not a record ("the card held
3.2 s"). Keep the section order: agents and people look things up by heading. -->

One or two sentences: the medium and what the frame looks like. Kit: [`kits/<kit>.ts`](../<kit>.ts).
Demo: [`examples/style-<name>`](../../examples/style-<name>) (<title>, <n> s).

Source: where the look comes from (a reference, a style catalogue, our own film); ideas only, no
characters, layouts, typefaces or music copied, none named in a film.

**Use it for** three or four kinds of story. **Not for** what it can't carry, and what to use
instead.

## The three-second read

What someone recognises in a single frame, before reading anything: medium, palette, type,
texture, the one signature mark.

## What it is not

The three to five styles it gets confused with, and the line between each and this one.

- **Not <neighbour>**: the difference you can see in a frame.

## Colour

The logic, not one palette: how many colours, what each role means, what is never used, how
colours mix. One example palette at most (tokens with hex).

## Type

Licence-free faces (OFL / Apache) that cover the film's language; roles (title, label, card,
subtitle) with weights and sizes at 1080p; how long text holds.

## Composition

Frame and grid, where the subject sits, how much is left empty, what never touches the edge.

## Motion

Frame rate or stepping (ones, twos, a crank), easing, weight, what boils, what never moves; the
signature moves (one bullet each: what it is, how long, when it fits).

## Camera grammar

A vocabulary, not a route: no row names *the* opening or ending move.

| Move | Expresses | Can serve |
|---|---|---|
| <move> | <feeling or meaning> | <kinds of moment, not the demo's> |

Allowed and forbidden transitions.

## Story shape

The shapes the look serves well (two or three), not the demo's story.

## Sound

Instruments and how they are played (`cueframe-py instruments list`), foley materials, ambience,
where the silence goes; no key, tempo or arc (those belong to a film).

## Pitfalls

What goes wrong in this medium and the fix (too much texture, unreadable type, flashing, damage
everywhere).

## Kit

| Function | Gives |
|---|---|
| `<fn>(…)` | what it draws or returns |
