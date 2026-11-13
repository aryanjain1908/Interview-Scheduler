import sys, subprocess, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
name, times = sys.argv[1], [float(t) for t in sys.argv[2].split(",")]
import os
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend", "public", "videos", f"{name}.mp4")
sel = "+".join(f"eq(n\,{round(t*30)})" for t in times)
subprocess.run([FF, "-y", "-i", src, "-vf", f"select='{sel}',scale=640:-1,tile=2x{(len(times)+1)//2}", "-frames:v", "1", "-vsync", "vfr", f"sheet-{name}.jpg"], check=True, capture_output=True)
print("ok")
