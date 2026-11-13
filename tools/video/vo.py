"""Narration with ElevenLabs. The API key is read from the file named by $ELEVENLABS_KEY_FILE
(default: 11labskey.txt in the folder that contains the repo). It is never printed or copied into the repo.

Each line is cached by its text, so re-running only voices what changed.
usage: python vo.py
"""
import hashlib
import json
import os
import re
import subprocess
import urllib.request

import imageio_ffmpeg

D = os.path.dirname(os.path.abspath(__file__))
FF = imageio_ffmpeg.get_ffmpeg_exe()
KEY_FILE = os.environ.get("ELEVENLABS_KEY_FILE", os.path.join(D, "..", "..", "..", "11labskey.txt"))
KEY = open(KEY_FILE, encoding="utf-8").read().strip()
VOICE = "cgSgspJ2msm6clMCkdW9"  # Jessica: warm, conversational (premade; library voices need a paid plan)
OUT = os.path.join(D, "vo")
os.makedirs(OUT, exist_ok=True)

lines = json.load(open(os.path.join(D, "lines.json"), encoding="utf-8"))
durations = {}
spent = 0
for video, scenes in lines.items():
    ids = list(scenes)
    for n, (sid, text) in enumerate(scenes.items()):
        # The neighbouring lines are sent as context so the delivery flows like one take.
        prev_text = " ".join(scenes[i] for i in ids[max(0, n - 2):n])
        next_text = scenes[ids[n + 1]] if n + 1 < len(ids) else ""
        tag = hashlib.sha1(f"{VOICE}|{prev_text}|{text}|{next_text}".encode()).hexdigest()[:10]
        path = os.path.join(OUT, f"{sid}-{tag}.mp3")
        if not os.path.exists(path):
            body = {
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "previous_text": prev_text or None,
                "next_text": next_text or None,
                "voice_settings": {"stability": 0.38, "similarity_boost": 0.8, "style": 0.3, "use_speaker_boost": True},
            }
            req = urllib.request.Request(
                f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
                data=json.dumps(body).encode(),
                headers={"xi-api-key": KEY, "Content-Type": "application/json"},
            )
            open(path, "wb").write(urllib.request.urlopen(req, timeout=120).read())
            spent += len(text)
        probe = subprocess.run([FF, "-i", path], capture_output=True, text=True).stderr
        h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe).groups()
        durations[sid] = {"file": path, "dur": int(h) * 3600 + int(m) * 60 + float(s), "text": text}
        print(f"{sid}: {durations[sid]['dur']:.2f}s")

json.dump(durations, open(os.path.join(OUT, "durations.json"), "w", encoding="utf-8"), indent=1)
print(f"characters voiced this run: {spent}")
