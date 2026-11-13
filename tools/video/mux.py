"""Lay narration (and a music bed for the overview) on a recording; write mp4, poster and captions.

usage: python mux.py <name> [poster_scene]
"""
import json
import os
import re
import subprocess
import sys

import imageio_ffmpeg

D = os.path.dirname(os.path.abspath(__file__))
FF = imageio_ffmpeg.get_ffmpeg_exe()
OUT = os.path.join(D, "..", "..", "frontend", "public", "videos")
os.makedirs(OUT, exist_ok=True)

name = sys.argv[1]
tl = json.load(open(os.path.join(D, f"{name}.timeline.json"), encoding="utf-8"))
length = tl["length"]
scenes = tl["timeline"]

inputs = ["-i", tl["webm"]]
filters = []
labels = []
for i, s in enumerate(scenes, start=1):
    inputs += ["-i", s["file"]]
    ms = int(s["at"] * 1000)
    filters.append(f"[{i}:a]aresample=44100,adelay={ms}|{ms},volume=1.0[v{i}]")
    labels.append(f"[v{i}]")

if name == "overview":
    subprocess.run([sys.executable, os.path.join(D, "music.py"), f"{length + 1:.1f}"], check=True, capture_output=True)
    inputs += ["-i", os.path.join(D, "music.wav")]
    m = len(scenes) + 1
    filters.append(f"[{m}:a]volume=0.13[mus]")
    labels.append("[mus]")

filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,alimiter=limit=0.95[aout]")
mp4 = os.path.join(OUT, f"{name}.mp4")
cmd = [
    FF, "-y", *inputs,
    "-filter_complex", ";".join(filters),
    "-map", "0:v", "-map", "[aout]",
    "-t", f"{length:.2f}",
    "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
    mp4,
]
subprocess.run(cmd, check=True, capture_output=True)

pick = sys.argv[2] if len(sys.argv) > 2 else scenes[1]["id"]
at = next(s["at"] for s in scenes if s["id"] == pick) + 2.2
subprocess.run([FF, "-y", "-ss", f"{at:.2f}", "-i", mp4, "-frames:v", "1", "-q:v", "3", os.path.join(OUT, f"{name}.jpg")], check=True, capture_output=True)


def ts(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


cues = ["WEBVTT", ""]
for s in scenes:
    parts = [p.strip() for p in re.split(r"(?<=[.!?:])\s+", s["text"]) if p.strip()]
    total = sum(len(p) for p in parts)
    t = s["at"]
    for p in parts:
        d = s["dur"] * len(p) / total
        cues += [f"{ts(t)} --> {ts(t + d)}", p, ""]
        t += d
open(os.path.join(OUT, f"{name}.vtt"), "w", encoding="utf-8").write("\n".join(cues))

size = os.path.getsize(mp4) / 1e6
print(f"{name}.mp4 {length:.1f}s {size:.1f} MB")
