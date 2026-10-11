"""Prepares a music track for the MV: build/audio.wav (for mp4 export), build/audio.json with a
48-band spectrum at 30 fps, the duration and a beat grid (constant tempo fitted to onsets).

    python3 -I tools/audio.py path/to/track.(mp3|m4a|flac|wav)
"""
import base64, json, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]).resolve()
build = ROOT / 'build'
build.mkdir(exist_ok=True)

SR, FPS, BANDS = 22050, 30, 48
# export audio: two-pass EBU R128 normalisation to -14 LUFS / -1.5 dBTP (streaming target, no clipping after AAC)
probe = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(src), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], check=True, capture_output=True, text=True).stderr
m = json.loads(probe[probe.rindex('{'):probe.rindex('}') + 1])
ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-af', ln, '-ar', '48000', '-ac', '2', str(build / 'audio.wav')], check=True)
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], check=True, capture_output=True).stdout
x = np.frombuffer(pcm, dtype=np.float32)
dur = len(x) / SR

# spectrum: 2048-sample Hann windows centred on each video frame, log-spaced bands
N = 2048
win = np.hanning(N).astype(np.float32)
frames = int(np.ceil(dur * FPS))
freqs = np.fft.rfftfreq(N, 1 / SR)
edges = np.geomspace(40, 16000, BANDS + 1)
idx = [np.where((freqs >= edges[b]) & (freqs < edges[b + 1]))[0] for b in range(BANDS)]
idx = [i if len(i) else np.array([np.argmin(abs(freqs - edges[b]))]) for b, i in enumerate(idx)]
xp = np.pad(x, (N, N))
spec = np.zeros((frames, BANDS), dtype=np.float32)
for f in range(frames):
    c = int(f / FPS * SR) + N
    mag = np.abs(np.fft.rfft(xp[c - N // 2:c + N // 2] * win))
    spec[f] = [mag[i].mean() for i in idx]
db = 20 * np.log10(spec + 1e-6)
lo, hi = np.percentile(db, 5, axis=0), np.percentile(db, 99.5, axis=0)
norm = np.clip((db - lo) / (hi - lo + 1e-6), 0, 1) ** 1.4
# light temporal smoothing (attack fast, release slow)
for f in range(1, frames):
    norm[f] = np.maximum(norm[f], norm[f - 1] * 0.82)
u8 = (norm * 255).astype(np.uint8)

# beats: onset envelope (positive spectral flux), tempo by autocorrelation in 110–150 BPM, phase by comb fit
flux = np.maximum(np.diff(db, axis=0), 0).sum(axis=1)
flux = (flux - flux.mean()) / (flux.std() + 1e-6)
best = None
for bpm in np.arange(110, 150, 0.05):
    period = 60 / bpm * FPS
    for ph in np.arange(0, period, 0.5):
        k = np.arange(ph, len(flux), period).astype(int)
        s = flux[k].mean()
        if best is None or s > best[0]:
            best = (s, bpm, ph)
_, bpm, ph = best
beats = [round(float((ph + 1) / FPS + i * 60 / bpm), 4) for i in range(int(dur * bpm / 60) + 1) if (ph + 1) / FPS + i * 60 / bpm < dur]

(build / 'audio.json').write_text(json.dumps({
    'source': src.name, 'duration': round(dur, 3), 'fps': FPS, 'bands': BANDS,
    'spec': base64.b64encode(u8.tobytes()).decode(), 'beats': beats, 'bpm': round(float(bpm), 2),
}))
print(f'{src.name}: {dur:.2f}s  bpm≈{bpm:.2f}  beats={len(beats)}  spectrum {frames}x{BANDS}', file=sys.stderr)
