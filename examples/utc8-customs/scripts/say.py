"""Narration and character lines with MOSS-TTS on mlx-audio: the `tts` engine "command" for this example.

Run in the mlx-audio environment (cueframe-py tts calls it through script.json "command"):
  ../../../mlx-audio/.venv/bin/python scripts/say.py jobs.json

jobs.json: [{"text", "out", "take", "seed", "tts"?}, ...]. Synthesizes each missing wav as 24 kHz mono PCM16.
`tts`: {"voice": a MOSS official voice (voices/official/ref/<Name>.wav) or a voices/<name>/ folder,
"lang": zh | en | ja (text normalisation; ja is left as written)}. `seed` makes a take repeatable.
SAY_DRAFT=1 uses the Nano model (fast) instead of MOSS-TTS-Local 1.7B 8-bit.
"""
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

VNEXT = Path(__file__).resolve().parents[4]
VOICES = VNEXT / "voices"
FINAL_MODEL = VNEXT / "mlx-audio" / "models" / "moss-tts-local-1.7b-8bit"
DRAFT_MODEL = "mlx-community/MOSS-TTS-Nano-100M"
SAMPLING = dict(audio_temperature=1.0, audio_top_p=0.95, audio_top_k=50, audio_repetition_penalty=1.1)
SR = 24000
CJK = re.compile(r"[一-鿿]")


def ref_of(voice: str) -> str:
    for p in (VOICES / "official" / "ref" / f"{voice}.wav", VOICES / voice / "reference.wav"):
        if p.exists():
            return str(p)
    sys.exit(f"say.py: voice not found: {voice}")


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    todo = [j for j in jobs if not Path(j["out"]).exists()]
    if not todo:
        return
    import mlx.core as mx
    from mlx_audio.tts import load

    draft = os.environ.get("SAY_DRAFT") == "1"
    model = load(DRAFT_MODEL if draft else str(FINAL_MODEL))
    kw = dict(max_tokens=1000) if draft else dict(SAMPLING, max_tokens=4096)
    tn = {}

    def normalize(text: str, lang: str) -> str:
        if lang == "ja":
            return text
        lang = lang if lang in ("zh", "en") else ("zh" if CJK.search(text) else "en")
        if lang not in tn:
            if lang == "zh":
                from tn.chinese.normalizer import Normalizer as Zh
                tn[lang] = Zh(remove_interjections=False, remove_erhua=False, full_to_half=False)
            else:
                from tn.english.normalizer import Normalizer as En
                tn[lang] = En()
        return tn[lang].normalize(text)

    for j in todo:
        d = j.get("tts") or {}
        mx.random.seed(int(j.get("seed", 0)) % (2 ** 31))
        text = normalize(j["text"], d.get("lang", "auto"))
        parts, sr = [], SR
        for r in model.generate(text=text, ref_audio=ref_of(d.get("voice", "Lingyu")), **kw):
            parts.append(np.asarray(r.audio, dtype=np.float32))
            sr = r.sample_rate
        audio = np.concatenate(parts, axis=-1)
        if audio.ndim == 2:
            audio = audio.mean(axis=0 if audio.shape[0] <= 2 else 1)
        if sr != SR:
            g = np.gcd(sr, SR)
            audio = resample_poly(audio, SR // g, sr // g)
        out = Path(j["out"])
        out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(out, np.clip(audio, -1, 1).astype(np.float32), SR, subtype="PCM_16")
        print(out.name, flush=True)


if __name__ == "__main__":
    main()
