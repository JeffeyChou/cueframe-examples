# cueframe: footage → plate folders and feature tracks by hand (plates are made only by `cueframe-py blender`).
"""Each clip in clips.json → build/plates/<id>/: JPEG frames at the timeline fps (cover-cropped),
manifest.json, tracks.json (KLT feature points in the plate format) and points.json (per-point
schematic score per frame: block contrast × brightness deviation, as ComfyUI-Schematic scores).

usage: prep.py clips.json --project <dir>
"""
import argparse, json, os, subprocess, glob
import numpy as np
import cv2

ap = argparse.ArgumentParser()
ap.add_argument('clips')
ap.add_argument('--project', required=True)
ap.add_argument('--fps', type=int, default=30)
ap.add_argument('--w', type=int, default=1280)
ap.add_argument('--h', type=int, default=720)
ap.add_argument('--points', type=int, default=90)
a = ap.parse_args()

W, H = a.w, a.h
clips = json.load(open(a.clips))


def score_at(gray, x, y, r=10):
    x0, y0 = int(max(0, x - r)), int(max(0, y - r))
    p = gray[y0:int(y + r), x0:int(x + r)].astype(np.float32)
    if p.size == 0:
        return 0.0
    return float(p.std() * (1 + abs(p.mean() - 128) / 128))


for c in clips:
    out = os.path.join(a.project, 'build/plates', c['id'])
    fdir = os.path.join(out, 'final')
    stamp = json.dumps(c, sort_keys=True)
    if os.path.exists(os.path.join(out, 'manifest.json')) and open(os.path.join(out, '.stamp')).read() == stamp if os.path.exists(os.path.join(out, '.stamp')) else False:
        print('cached', c['id'])
        continue
    os.makedirs(fdir, exist_ok=True)
    for f in glob.glob(os.path.join(fdir, '*.jpg')):
        os.remove(f)
    src = os.path.join(a.project, c['src'])
    vf = f"fps={a.fps},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
    if c.get('hflip'):
        vf += ',hflip'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(c.get('in', 0)), '-i', src, '-t', str(c['dur']),
                    '-vf', vf, '-q:v', '3', '-start_number', '0', os.path.join(fdir, '%04d.jpg')], check=True)
    frames = sorted(glob.glob(os.path.join(fdir, '*.jpg')))
    n = len(frames)

    # KLT tracks, replenished when points are lost
    tracks = {}
    nid = 0
    prev = None
    live = []  # (id, x, y)
    for i, fp in enumerate(frames):
        g = cv2.cvtColor(cv2.imread(fp), cv2.COLOR_BGR2GRAY)
        if prev is not None and live:
            p0 = np.array([[x, y] for _, x, y in live], np.float32).reshape(-1, 1, 2)
            p1, st, err = cv2.calcOpticalFlowPyrLK(prev, g, p0, None, winSize=(21, 21), maxLevel=3)
            back, st2, _ = cv2.calcOpticalFlowPyrLK(g, prev, p1, None, winSize=(21, 21), maxLevel=3)
            fb = np.linalg.norm((p0 - back).reshape(-1, 2), axis=1)
            nl = []
            for (tid, _, _), q, ok, ok2, e in zip(live, p1.reshape(-1, 2), st.ravel(), st2.ravel(), fb):
                if ok and ok2 and e < 1.0 and 0 <= q[0] < W and 0 <= q[1] < H:
                    nl.append((tid, float(q[0]), float(q[1])))
            live = nl
        if len(live) < a.points:
            mask = np.full(g.shape, 255, np.uint8)
            for _, x, y in live:
                cv2.circle(mask, (int(x), int(y)), 40, 0, -1)
            pts = cv2.goodFeaturesToTrack(g, a.points - len(live), 0.02, 40, mask=mask, blockSize=9)
            for q in (pts.reshape(-1, 2) if pts is not None else []):
                live.append((f'p{nid}', float(q[0]), float(q[1])))
                nid += 1
        for tid, x, y in live:
            t = tracks.setdefault(tid, {'born': i, 'x': [], 'y': [], 's': []})
            t['x'].append(round(x, 1))
            t['y'].append(round(y, 1))
            t['s'].append(round(score_at(g, x, y), 1))
        prev = g

    pts = {}
    scores = {}
    for tid, t in tracks.items():
        b, m = t['born'], len(t['x'])
        if m < 4:
            continue
        pad = lambda arr, v: [v] * b + arr + [v] * (n - b - m)
        pts[tid] = {'x': pad(t['x'], t['x'][0] if b else 0), 'y': pad(t['y'], t['y'][0] if b else 0),
                    'z': [1.0] * n, 'inFrame': [0] * b + [1] * m + [0] * (n - b - m),
                    'occluded': [0] * n}
        scores[tid] = {'born': b, 'len': m, 's': t['s']}
    json.dump({'w': W, 'h': H, 'frames': n, 'points': pts}, open(os.path.join(out, 'tracks.json'), 'w'))
    json.dump({'frames': n, 'points': scores}, open(os.path.join(out, 'points.json'), 'w'))
    json.dump({'fps': a.fps, 'frames': n, 'w': W, 'h': H,
               'variants': {'final': {'dir': 'final', 'pattern': '%04d.jpg', 'w': W, 'h': H}},
               'tracks': 'tracks.json'}, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    open(os.path.join(out, '.stamp'), 'w').write(stamp)
    print(c['id'], n, 'frames', len(pts), 'tracks')
