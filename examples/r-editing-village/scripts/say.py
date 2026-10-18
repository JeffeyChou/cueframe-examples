"""Narration with IndexTTS and the user's voice library: the `tts` engine "command" for this example.

Run in the index-tts environment (cueframe-py tts calls it through script.json "command"):
  uv run --project ../index-tts python examples/r-editing-village/scripts/say.py jobs.json

jobs.json: [{"text", "out", "take", "seed", "tts"?}, ...]. Synthesizes each missing wav. `seed` makes a take
repeatable (sampling seed); `tts` directs the read: emo_text (+ emo_alpha), emo_vector (8 floats),
duration_factor, temperature. Word timings come afterwards from the audio (script.json "align").
"""
import json
import os
import sys
from pathlib import Path

VNEXT = Path(__file__).resolve().parents[4]
VOICES = VNEXT / "voices"
REPO = VNEXT / "index-tts"
VOICE = os.environ.get("VILLAGE_VOICE", "me")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("HF_HUB_CACHE", str(REPO / "checkpoints" / "hf_cache"))


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    ref = str(VOICES / VOICE / "reference.wav")
    cwd = os.getcwd()
    todo = [(Path(cwd, j["out"]).resolve(), j["text"]) for j in jobs]
    todo = [(out, text) for out, text in todo if not out.exists()]
    if not todo:
        return
    os.chdir(REPO)
    import random

    import numpy as np
    import torch
    from indextts.infer_v2_5 import IndexTTS2

    # QwenEmotion is loaded only when some line is directed by text.
    emo = any((j.get("tts") or {}).get("emo_text") for j in jobs)
    tts = IndexTTS2(cfg_path="checkpoints/config.yaml", model_dir="checkpoints", use_qwen_emo=emo)
    by_out = {str(Path(cwd, j["out"]).resolve()): j for j in jobs}
    for out, text in todo:
        j = by_out[str(out)]
        d = j.get("tts") or {}
        seed = int(j.get("seed", 0))
        random.seed(seed)
        np.random.seed(seed % (2 ** 32))
        torch.manual_seed(seed)
        kw = {k: d[k] for k in ("emo_alpha", "emo_vector", "duration_factor", "temperature") if k in d}
        if d.get("emo_text"):
            kw.update(use_emo_text=True, emo_text=d["emo_text"])
        out.parent.mkdir(parents=True, exist_ok=True)
        tts.infer(text=text, output_path=str(out), spk_audio_prompt=ref, lang="ZH", num_beams=1, diffusion_steps=12, **kw)
        print(out.name, flush=True)


if __name__ == "__main__":
    main()
