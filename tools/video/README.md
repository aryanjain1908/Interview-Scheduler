# Product videos

Records the four narrated videos on the landing page (`frontend/public/videos/`) by driving the real app.

| Script | What it does |
|---|---|
| `lines.json` | The narration, one line per scene |
| `vo.py` | Voices each line with ElevenLabs (cached by text) and measures its length |
| `record.mjs` | Drives the app in Edge at 1280×720 with a visible cursor; logs when each line should play |
| `mux.py` | Lays the narration (and a music bed for the overview) on the recording; writes `.mp4`, poster `.jpg` and `.vtt` captions |
| `music.py` | Generates the soft music bed |
| `sheet.py` | Contact sheet of frames, for a quick visual check |

## Re-record

The stack must be running (`docker compose up -d`). The ElevenLabs key is read from the file in
`ELEVENLABS_KEY_FILE` (default: `11labskey.txt` in the folder that contains the repo). It is never printed or copied.

```bash
cd tools/video
npm install && npx playwright-core install ffmpeg   # once
pip install imageio-ffmpeg numpy                    # once
python vo.py                                        # only voices lines that changed
docker compose exec backend python -m app.seed --reset
node record.mjs overview && python mux.py overview o4
node record.mjs student && python mux.py student
node record.mjs interviewer && python mux.py interviewer i3
node record.mjs team && python mux.py team
```

Each recording changes demo data (bookings, outcomes), so reseed before re-recording a video.
