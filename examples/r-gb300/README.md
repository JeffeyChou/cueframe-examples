# r-gb300: rendered 3D plates under an information-design overlay

A 26.5-second replica slice of a Bilibili explainer ("拆一台 GB300 NVL72", made with Blender and
Claude Opus 5.5): three shots of a GB300 NVL72 rack, rendered in Blender, with labels that follow
the parts as the camera moves, source badges, a chapter bar, lower thirds and a log-axis chart.
It is the acceptance piece for CueFrame's plates (`ctx.plate`, `cueframe-py blender`), the
`annotate` recipe and the `audit` legibility checks.

| Shot | Plate | Overlay |
|---|---|---|
| `rack` (8 s) | camera arcs around the rack | title, four callouts on the tray groups (tracked anchors) |
| `tray` (12.5 s) | a compute tray slides out, the camera rises over it; the last frame holds | intro, callouts on a GPU, a CPU and the front panel, liquid cooling |
| `scale` (7 s) | slow push on the rack | FP8 compute of five products on a log axis |

## Build

From the repository root (Blender 5.x on `PATH` or in `/Applications`):

```
bash examples/r-gb300/make.sh draft     # EEVEE drafts and fonts: about a minute
pnpm exec cueframe dev examples/r-gb300
pnpm exec cueframe stills examples/r-gb300 --fast --times 6,13,22
bash examples/r-gb300/make.sh           # Cycles finals (about an hour on an M-series GPU), mp4, checks
```

The model is code (`blender/model.py`, one script per shot), so the plates are build output and
never committed. Changing a script or `model.py` starts a new generation of that shot: its old
frames are deleted, and the shot cannot be shown until it renders again.

## What is not real

- The rack and tray are stylised from public descriptions (proportions, tray counts and order,
  two boards with two GPUs and one CPU each, a coolant manifold), not from CAD.
- The figures (counts, 33 kW shelves, 480 GB LPDDR5X, FP8 numbers) and their source badges are
  taken from the reference video, which cites NVIDIA, Lenovo and OCP documents; they were not
  checked again here. Grade H in the badges follows the reference.
- The look (dark stage, warm key, gold trays) imitates the reference; nothing of it is copied.
