"""Narration with IndexTTS and the user's voice library: the `tts` engine "command" for this example.

Run in the index-tts environment (cueframe-py tts calls it through script.json "command"):
  uv run --project ../index-tts python examples/r-editing-village/scripts/say.py jobs.json

jobs.json: [{"text": "...", "out": "/abs/x.wav"}, ...]. Synthesizes each missing wav. Word timings
come afterwards from the audio: script.json "align" makes `tts` run `cueframe-py align` on each wav.
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
    from indextts.infer_v2_5 import IndexTTS2

    tts = IndexTTS2(cfg_path="checkpoints/config.yaml", model_dir="checkpoints")
    for out, text in todo:
        out.parent.mkdir(parents=True, exist_ok=True)
        tts.infer(text=text, output_path=str(out), spk_audio_prompt=ref, lang="ZH", num_beams=1, diffusion_steps=12)
        print(out.name, flush=True)


if __name__ == "__main__":
    main()
