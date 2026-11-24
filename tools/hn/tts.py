# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro-onnx>=0.4", "soundfile", "numpy"]
# ///
"""Render a two-speaker HN digest episode with Kokoro-82M (ONNX).

usage: uv run tools/hn/tts.py EPISODE_JSON OUT_DIR [--title TITLE]

EPISODE_JSON: {"intro": [line], "stories": [{"title", "lines": [line]}], "outro": [line]}
line: {"speaker": "A" | "B", "text": "..."}

Writes OUT_DIR/episode.mp3 and OUT_DIR/chapters.json ([{"title", "start"}], seconds).
Model files live outside the repo in ~/.cache/janus-hn (see tools/hn/README.md).
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

CACHE = Path(os.environ.get("JANUS_HN_MODELS", Path.home() / ".cache/janus-hn"))
VOICES = {
    "A": os.environ.get("JANUS_HN_VOICE_A", "af_heart"),
    "B": os.environ.get("JANUS_HN_VOICE_B", "am_puck"),
}
SPEED = float(os.environ.get("JANUS_HN_SPEED", "1.15"))
LINE_GAP = 0.45  # pause between turns: a slight gap between speakers
STORY_GAP = 1.0


def main() -> None:
    args = sys.argv[1:]
    title = "HN digest"
    if "--title" in args:
        i = args.index("--title")
        title = args[i + 1]
        del args[i : i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    episode = json.loads(Path(args[0]).read_text())
    out = Path(args[1])
    out.mkdir(parents=True, exist_ok=True)

    kokoro = Kokoro(str(CACHE / "kokoro-v1.0.onnx"), str(CACHE / "voices-v1.0.bin"))
    rate = None
    pieces: list[np.ndarray] = []
    chapters = []
    total = 0

    def say(lines) -> None:
        nonlocal rate, total
        for line in lines:
            text = line["text"].strip()
            if not text:
                continue
            audio, sr = kokoro.create(text, voice=VOICES[line["speaker"]], speed=SPEED, lang="en-us")
            rate = rate or sr
            pieces.append(audio)
            pieces.append(np.zeros(int(sr * LINE_GAP), dtype=audio.dtype))
            total += len(audio) + int(sr * LINE_GAP)

    def gap() -> None:
        nonlocal total
        if rate:
            pieces.append(np.zeros(int(rate * STORY_GAP), dtype=np.float32))
            total += int(rate * STORY_GAP)

    say(episode.get("intro", []))
    for story in episode["stories"]:
        gap()
        chapters.append({"title": story["title"], "start": round(total / rate, 1) if rate else 0.0})
        say(story["lines"])
    gap()
    say(episode.get("outro", []))
    if not pieces:
        sys.exit("episode has no lines")

    wav = out / "episode.wav"
    sf.write(wav, np.concatenate(pieces), rate)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "96k",
         "-metadata", f"title={title}", "-metadata", "artist=Janus HN", "-metadata", "album=Janus HN digest",
         str(out / "episode.mp3")],
        check=True,
    )
    wav.unlink()
    (out / "chapters.json").write_text(json.dumps(chapters, indent=2))
    print(f"{out / 'episode.mp3'}  {total / rate / 60:.1f} min, {len(chapters)} stories")


if __name__ == "__main__":
    main()
