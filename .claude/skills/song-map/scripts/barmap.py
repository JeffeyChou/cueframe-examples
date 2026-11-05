"""The song map: one row per bar of a project's excerpt, from build/hits.json and (if present) build/lyrics.json.

    python3 -I .claude/skills/song-map/scripts/barmap.py <project> [--out build/song-map.md]

Columns: bar (0 = the pickup before the first downbeat), start time in the excerpt, section (index into
hits.json sections; a bar in which a new section starts shows `→k @t`), the drum hits in the bar by kind, the strongest hit, and the words sung
in the bar (a lyric line's id where it starts). Storyboards, cue sheets and scene timings are planned on this table,
so it is what you show the owner before any picture is made.
"""
import json
import re
import sys
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith('--')]
out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
if out in args:
    args.remove(out)
proj = Path(args[0])
hits = json.loads((proj / 'build/hits.json').read_text())
lyr = proj / 'build/lyrics.json'
lines = json.loads(lyr.read_text())['lines'] if lyr.exists() else []

down = hits['downbeats']
end = hits['dur']
edges = ([0.0] if down and down[0] > 0.05 else []) + down + [end]
first = 0 if down and down[0] > 0.05 else 1
sections = hits.get('sections') or []
CJK = re.compile(r'[　-鿿＀-￯]')


def section(t):
    return sum(1 for s in sections if s <= t + 1e-6)


def sung(t0, t1):
    parts = []
    for ln in lines:
        ws = [w for w in ln.get('words', []) if t0 <= w['t'] < t1]
        if not ws:
            continue
        text = ''
        for w in ws:
            text += w['w'] if (CJK.match(w['w']) or not text) else ' ' + w['w']
        start = ln.get('words') and ln['words'][0]['t']
        parts.append((f"[{ln['id']}] " if start is not None and t0 <= start < t1 else '') + text)
    return ' / '.join(parts)


rows = [f"# Song map: {proj.name}",
        '',
        f"{hits['tempo']} BPM, {hits['meter']}/{8 if hits['meter'] == 6 else 4} {hits.get('feel', '')}, tempo confidence {hits.get('tempoConfidence')}, "
        f"{len(down)} downbeats, excerpt {hits['start']}+{hits['dur']} s"
        + (f", lyrics: {len(lines)} lines" if lines else ', no lyrics.json'),
        '',
        '| bar | t (s) | sect | kick | snare | hat | strongest | sung |',
        '|---:|---:|:--:|---:|---:|---:|---|---|']
for i in range(len(edges) - 1):
    t0, t1 = edges[i], edges[i + 1]
    hs = [h for h in hits['hits'] if t0 <= h['t'] < t1]
    count = {k: sum(1 for h in hs if h['kind'] == k) for k in ('kick', 'snare', 'hat')}
    top = max(hs, key=lambda h: h['s'], default=None)
    new = [(k + 1, b) for k, b in enumerate(sections) if t0 - 1e-6 <= b < t1 - 1e-6]
    mark = ' '.join(f'→{k} @{b:.2f}' for k, b in new) or f'{section(t0)}'
    rows.append(f"| {i + first} | {t0:.2f} | {mark} | {count['kick']} | {count['snare']} | {count['hat']} | "
                + (f"{top['kind']} {top['s']:.2f} @{top['t']:.2f}" if top else '') + f" | {sung(t0, t1)} |")
text = '\n'.join(rows) + '\n'
if out:
    (proj / out).write_text(text)
    print(f'{proj / out}: {len(edges) - 1} bars')
else:
    print(text)
