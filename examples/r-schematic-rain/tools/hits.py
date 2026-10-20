# cueframe: no classified drum hits in `cueframe-py analyze` (it gives beats + band envelopes only).
"""Drum hits of a music excerpt: onsets on the percussive part, classed kick / snare / hat by band energy.

usage: hits.py <audio> --start S --dur D --out build/hits.json [--wav build/music.wav]
"""
import argparse, json
import numpy as np
import librosa
import soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument('audio')
ap.add_argument('--start', type=float, default=0)
ap.add_argument('--dur', type=float, default=None)
ap.add_argument('--out', required=True)
ap.add_argument('--wav')
ap.add_argument('--fade', type=float, default=1.5)
a = ap.parse_args()

y, sr = librosa.load(a.audio, sr=44100, mono=False, offset=a.start, duration=a.dur)
if a.wav:
    st = y.T.copy()
    n = int(a.fade * sr)
    if n and len(st) > n:
        st[-n:] *= np.linspace(1, 0, n)[:, None]
    sf.write(a.wav, st, sr)
mono = librosa.to_mono(y)
hop = 256
_, perc = librosa.effects.hpss(mono)
S = np.abs(librosa.stft(perc, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
bands = {'low': (20, 150), 'mid': (150, 2500), 'snare': (1500, 6000), 'high': (6000, 16000)}
E = {k: S[(freqs >= lo) & (freqs < hi)].sum(0) for k, (lo, hi) in bands.items()}
flux = {k: np.maximum(0, np.diff(v, prepend=v[0])) for k, v in E.items()}
for k in flux:
    flux[k] /= np.percentile(flux[k], 99.5) + 1e-9

oenv = librosa.onset.onset_strength(y=perc, sr=sr, hop_length=hop)
on = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=hop, backtrack=False, delta=0.04, wait=3)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, units='time')
peak = np.percentile(oenv, 99.5) + 1e-9

hits = []
for i in on:
    w = slice(max(0, i - 1), i + 3)
    lo, sn, hi = (float(flux[k][w].max()) for k in ('low', 'snare', 'high'))
    s = float(min(1.0, oenv[i] / peak))
    if lo > 0.35 and lo >= sn * 0.8:
        kind = 'kick'
    elif sn > 0.3 and sn >= hi * 0.7:
        kind = 'snare'
    elif hi > 0.15:
        kind = 'hat'
    else:
        kind = 'other'
    hits.append({'t': round(float(librosa.frames_to_time(i, sr=sr, hop_length=hop)), 3), 'kind': kind,
                 's': round(s, 3), 'low': round(lo, 2), 'snare': round(sn, 2), 'high': round(hi, 2)})

out = {'source': a.audio, 'start': a.start, 'dur': a.dur, 'tempo': round(float(np.atleast_1d(tempo)[0]), 2),
       'beats': [round(float(b), 3) for b in beats], 'hits': hits}
with open(a.out, 'w') as fh:
    json.dump(out, fh, indent=1)
kinds = {k: sum(h['kind'] == k for h in hits) for k in ('kick', 'snare', 'hat', 'other')}
print(f"tempo {out['tempo']} beats {len(beats)} hits {kinds}")
