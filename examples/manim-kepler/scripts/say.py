"""Narration with IndexTTS and the user's voice library, aligned to the audio it produced.

Run in the index-tts environment (cueframe-py tts calls it through script.json "command"):
  uv run --project ../index-tts python examples/manim-kepler/scripts/say.py jobs.json

jobs.json: [{"text": "...", "out": "/abs/x.wav"}, ...]. Synthesizes each missing wav (an existing
wav is only re-aligned) and writes x.words.json: [{"t", "d", "w"}], one entry per CJK character or
Latin token of `text`.

Alignment, from the finished audio:
1. Whisper word timestamps (no initial prompt: with the script as prompt Whisper skips or
   invents parts of a line); the recognised characters are matched to the script's characters
   (difflib), so homophone errors and extra or missing characters do not shift later ones.
2. Pauses in the waveform (RMS 24 dB below the line's speech level for >= 60 ms). Each punctuation boundary of
   the script snaps to the pause nearest to its Whisper estimate; characters inside a phrase are
   spread over the phrase's Whisper span. Subtitle phrases then start where their sound starts.
"""
import difflib
import json
import os
import re
import sys
from pathlib import Path

import numpy as np

VNEXT = Path(__file__).resolve().parents[4]
VOICES = VNEXT / "voices"
REPO = VNEXT / "index-tts"
VOICE = os.environ.get("KEPLER_VOICE", "me")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("HF_HUB_CACHE", str(REPO / "checkpoints" / "hf_cache"))

TOKEN = re.compile(r"[㐀-鿿豈-﫿]|[A-Za-z0-9'’]+")
BREAK = re.compile(r"[，。；？！,;?!：:、]")
HOP = 0.01
# A generic prompt (not the script) that keeps Whisper in simplified Chinese.
SIMPLIFIED = "以下是普通话的句子，使用简体中文。"


def tokens_with_breaks(text):
    """Script tokens and, for each token, whether a punctuation mark precedes it."""
    toks, breaks = [], []
    pending = False
    for m in re.finditer(TOKEN.pattern + "|" + BREAK.pattern, text):
        if BREAK.fullmatch(m.group()):
            pending = True
            continue
        toks.append(m.group())
        breaks.append(pending and bool(toks[:-1]))
        pending = False
    return toks, breaks


def recognised(segments):
    """Whisper tokens with times: each word's span is split evenly over its characters/tokens."""
    out = []
    for seg in segments:
        for w in seg.get("words", []):
            parts = TOKEN.findall(w["word"])
            if not parts:
                continue
            step = (w["end"] - w["start"]) / len(parts)
            for k, p in enumerate(parts):
                out.append((p.lower(), w["start"] + k * step, w["start"] + (k + 1) * step))
    return out


def pauses(wav, sr):
    """(start, end) of silent stretches >= 90 ms, relative to the line's speech level."""
    hop = int(sr * HOP)
    n = len(wav) // hop
    rms = np.sqrt(np.mean(wav[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    quiet = db < np.percentile(db, 90) - 24
    out, start = [], None
    for i, q in enumerate(quiet):
        if q and start is None:
            start = i
        if not q and start is not None:
            if i - start >= 6:
                out.append((start * HOP, i * HOP))
            start = None
    return out


def align(text, segments, wav, sr):
    toks, breaks = tokens_with_breaks(text)
    dur = len(wav) / sr
    rec = recognised(segments)
    t0 = [None] * len(toks)
    t1 = [None] * len(toks)
    sm = difflib.SequenceMatcher(a=[t.lower() for t in toks], b=[r[0] for r in rec], autojunk=False)
    for a, b, size in sm.get_matching_blocks():
        for k in range(size):
            t0[a + k], t1[a + k] = rec[b + k][1], rec[b + k][2]
    matched = sum(t is not None for t in t0) / max(1, len(toks))
    # Unmatched tokens: spread between the neighbouring matched ones.
    known = [i for i in range(len(toks)) if t0[i] is not None]
    if not known:
        span = (dur - 0.1) / max(1, len(toks))
        t0 = [0.05 + i * span for i in range(len(toks))]
        t1 = [0.05 + (i + 1) * span for i in range(len(toks))]
    else:
        i = 0
        while i < len(toks):
            if t0[i] is not None:
                i += 1
                continue
            j = i
            while j < len(toks) and t0[j] is None:
                j += 1
            lo = t1[i - 1] if i > 0 else max(0.0, t0[j] - 0.2 * (j - i)) if j < len(toks) else 0.05
            hi = t0[j] if j < len(toks) else min(dur, lo + 0.2 * (j - i))
            for k in range(i, j):
                t0[k] = lo + (hi - lo) * (k - i) / (j - i)
                t1[k] = lo + (hi - lo) * (k - i + 1) / (j - i)
            i = j
    # Snap phrase boundaries to pauses, then re-spread each phrase over its anchors.
    gaps = pauses(wav, sr)
    starts = [0] + [i for i, b in enumerate(breaks) if b]
    anchors = {}
    for i in starts[1:]:
        est = (t1[i - 1] + t0[i]) / 2
        near = [g for g in gaps if g[0] - 0.45 <= est <= g[1] + 0.45]
        if near:
            g = min(near, key=lambda g: abs((g[0] + g[1]) / 2 - est))
            anchors[i] = (g[0], g[1])
    # The first phrase starts where the leading silence ends.
    if gaps and gaps[0][0] <= HOP and gaps[0][1] < t1[0] + 0.5:
        anchors[0] = (0.0, gaps[0][1])
    edges = starts + [len(toks)]
    for a, b in zip(edges, edges[1:]):
        s = anchors[a][1] if a in anchors else t0[a]
        e = anchors[b][0] if b in anchors else t1[b - 1]
        w0, w1 = t0[a], t1[b - 1]
        for k in range(a, b):
            f0 = (t0[k] - w0) / (w1 - w0) if w1 > w0 else (k - a) / (b - a)
            f1 = (t1[k] - w0) / (w1 - w0) if w1 > w0 else (k - a + 1) / (b - a)
            t0[k], t1[k] = s + (e - s) * f0, s + (e - s) * f1
    return [{"t": round(t0[k], 3), "d": round(max(0.03, t1[k] - t0[k]), 3), "w": toks[k]} for k in range(len(toks))], len(anchors), len(starts) - 1, matched


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    ref = str(VOICES / VOICE / "reference.wav")
    cwd = os.getcwd()
    os.chdir(REPO)
    import torchaudio
    import whisper

    tts = None
    asr = whisper.load_model("small", device="cpu")
    for job in jobs:
        out = Path(cwd, job["out"]).resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        if not out.exists():
            if tts is None:
                from indextts.infer_v2_5 import IndexTTS2
                tts = IndexTTS2(cfg_path="checkpoints/config.yaml", model_dir="checkpoints")
            tts.infer(text=job["text"], output_path=str(out), spk_audio_prompt=ref, lang="ZH",
                      num_beams=1, diffusion_steps=12)
        wav, sr = torchaudio.load(str(out))
        mono = wav.mean(0).numpy()
        r = asr.transcribe(str(out), language="zh", word_timestamps=True, condition_on_previous_text=False, initial_prompt=SIMPLIFIED, fp16=False)
        ws, snapped, total, matched = align(job["text"], r["segments"], mono, sr)
        out.with_suffix(".words.json").write_text(json.dumps(ws, ensure_ascii=False), encoding="utf-8")
        print(f"{out.name} {len(mono) / sr:.2f}s  matched {matched:.0%}  pauses {snapped}/{total}  {r['text']}", flush=True)


if __name__ == "__main__":
    main()
