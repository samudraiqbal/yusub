# YouTube Faceless History Pipeline Local Web App Design

## Goal

Build a local web app for faceless YouTube history video production aimed at international audiences. User enters a history topic, target duration, video style, and narration tone. App generates and manages English long-form script, scene plan, image prompts, subtitles, voice-over, local assets, JSON export, and FFmpeg render.

## Chosen approach

Use Node.js Express backend, simple HTML/CSS/JavaScript frontend, local folder storage, 9Router-compatible local API for text and image generation, edge-tts for free voice-over, and FFmpeg for final video rendering.

Why:

- Node.js matches simple browser frontend and filesystem/FFmpeg orchestration well.
- 9Router runs locally at `http://localhost:20128/v1` and can provide both chat completions and image generation.
- edge-tts is free, needs no API key, and can output MP3 voice-over.
- FFmpeg already exists on machine and supports image/video composition, subtitles, audio mix, and 1080p output.

## Configuration

`.env` controls local AI and render defaults:

```env
PORT=3000
AI_BASE_URL=http://localhost:20128/v1
AI_API_KEY=replace-with-your-9router-key
AI_TEXT_MODEL=replace-with-your-text-model
AI_IMAGE_MODEL=cx/gpt-5.5-image
TTS_VOICE=en-US-GuyNeural
MUSIC_VOLUME=0.12
```

API key stays local. No login. No cloud storage.

## Folder structure

```txt
youtube-history-pipeline/
  package.json
  .env.example
  server.js
  src/
    ai9router.js
    projectStore.js
    sceneUtils.js
    subtitles.js
    tts.js
    render.js
  public/
    index.html
    styles.css
    app.js
  projects/
    the-fall-of-the-roman-empire/
      metadata.json
      script.txt
      scenes.json
      subtitles.srt
      voice.mp3
      music.mp3
      images/
      videos/
      output/
  docs/
    superpowers/specs/2026-06-10-youtube-history-pipeline-design.md
  README.md
```

## Frontend

Single-page local dashboard with dark cinematic visual style.

Sections:

1. Project Setup
   - Topic/title
   - Target duration: 8, 10, 12 minutes
   - Style: dark history, mystery history, war documentary, ancient empire
   - Tone: cinematic, dramatic, serious, documentary
   - Text model override
   - Image model override

2. Script Editor
   - Generate script
   - Edit script manually
   - Save to `script.txt`
   - Structure: hook, intro, main story, conflict/twist, ending/conclusion

3. Scene Planner
   - Generate scenes from script
   - Edit every field per scene
   - Save to `scenes.json`
   - Badges for video needed and missing image

4. Asset Manager
   - Generate image prompts per scene
   - Generate images via 9Router `/images/generations`
   - Upload or replace images manually
   - Generate voice via edge-tts
   - Upload music
   - Show asset readiness

5. Render
   - Generate subtitles
   - Render final video with FFmpeg
   - Show output path and render log
   - Export project JSON

## Backend API

Routes:

- `POST /api/projects` create project folder and seed metadata.
- `GET /api/projects` list projects.
- `GET /api/projects/:slug` load metadata, script, scenes, subtitles, assets.
- `POST /api/projects/:slug/generate-script` call 9Router chat to generate English script.
- `POST /api/projects/:slug/save-script` save edited script.
- `POST /api/projects/:slug/generate-scenes` call 9Router chat to produce structured scenes JSON.
- `POST /api/projects/:slug/save-scenes` save edited scenes JSON.
- `POST /api/projects/:slug/generate-images` call 9Router image endpoint for selected/all scenes.
- `POST /api/projects/:slug/generate-voice` generate `voice.mp3` with edge-tts.
- `POST /api/projects/:slug/upload-music` upload `music.mp3`.
- `POST /api/projects/:slug/upload-image/:sceneId` upload manual scene image.
- `POST /api/projects/:slug/generate-subtitles` generate `subtitles.srt` from scene durations.
- `POST /api/projects/:slug/render` run FFmpeg render.
- `GET /api/projects/:slug/export` return full project JSON.

Static project files exposed under `/projects/:slug/...` for preview.

## Data model

`metadata.json`:

```json
{
  "title": "The Fall of the Roman Empire",
  "slug": "the-fall-of-the-roman-empire",
  "target_duration_minutes": 10,
  "style": "dark history documentary",
  "tone": "cinematic",
  "created_at": "2026-06-10T00:00:00.000Z",
  "ai_base_url": "http://localhost:20128/v1",
  "ai_text_model": "replace-with-your-text-model",
  "ai_image_model": "cx/gpt-5.5-image"
}
```

`scenes.json` is array of objects:

```json
{
  "scene_id": "scene_001",
  "narration_text": "In the final centuries of Rome, the empire did not fall in a single night.",
  "subtitle_text": "Rome did not fall in a single night.",
  "image_prompt": "A ruined Roman forum at dusk, broken marble columns, distant storm clouds, cinematic historical documentary, realistic, dramatic lighting, high detail, 16:9, no text, no watermark",
  "duration_seconds": 8,
  "visual_effect": "slow zoom in",
  "camera_motion": "slow push toward the ruined columns",
  "transition": "cross dissolve",
  "should_generate_video": false,
  "image_to_video_prompt": "Slow cinematic push through ruined Roman columns as dust moves through cold sunset light.",
  "reason_why_video_needed": "Atmospheric movement would improve immersion, but still image with zoom is acceptable."
}
```

Scene fields required:

- `scene_id`
- `narration_text`
- `subtitle_text`
- `image_prompt`
- `duration_seconds`
- `visual_effect`
- `camera_motion`
- `transition`
- `should_generate_video`
- `image_to_video_prompt`
- `reason_why_video_needed`

## Generation logic

### Script generation

Prompt asks 9Router chat model to write long-form English documentary script for selected duration, style, and tone.

Required sections:

- Hook 0–20 seconds
- Short intro
- Main story
- Conflict/twist
- Ending/conclusion

Output saved as editable plain text.

### Scene generation

Prompt asks 9Router chat model for strict JSON array. App extracts JSON from response and validates required fields. If model returns text around JSON, app attempts to parse first JSON block.

Visual style appended to every image prompt:

`cinematic historical documentary, realistic, dramatic lighting, high detail, 16:9, no text, no watermark`

AI video recommendation rules mark `should_generate_video=true` when scene contains:

- battle scene
- fire/smoke scene
- marching army
- ocean storm
- collapsing city
- assassination
- crowd panic
- dramatic reveal
- moving map
- supernatural/mystery atmosphere

Since 9Router has no video endpoint now, this is planning metadata only. Render falls back to images.

### Image generation

Call:

```http
POST http://localhost:20128/v1/images/generations
Content-Type: application/json
Authorization: Bearer <AI_API_KEY>
Accept: text/event-stream
```

Body:

```json
{
  "model": "cx/gpt-5.5-image",
  "prompt": "...",
  "n": 1,
  "size": "auto",
  "quality": "auto",
  "background": "auto",
  "image_detail": "high",
  "output_format": "png"
}
```

Response parser supports:

- JSON with `data[0].url`
- JSON with `data[0].b64_json`
- SSE chunks containing JSON data

Generated images saved to `images/{scene_id}.png`.

### Subtitle generation

Use scene order and duration. Split subtitle text into short sentence chunks. Output SRT with cumulative timestamps.

### TTS

Use `edge-tts` through Python:

```bash
python -m edge_tts --voice en-US-GuyNeural --text "..." --write-media voice.mp3
```

For long scripts, app writes temp text file and calls edge-tts with file content to avoid command length issues.

## FFmpeg render

For each scene:

- Prefer `videos/{scene_id}.mp4` if exists.
- Else use `images/{scene_id}.png`, `.jpg`, or `.jpeg`.
- If no asset found, use generated placeholder image/color clip.

Render creates temporary per-scene clips in `output/temp/`.

Image clip filters:

- 1920x1080 scale/crop pad
- 30 FPS
- duration from `duration_seconds`
- simple Ken Burns variants from `visual_effect`

Then concatenate clips, burn subtitles, mix voice and music:

- Voice full volume
- Music low volume from `MUSIC_VOLUME`
- Output: `output/final_video.mp4`
- Codec: H.264 + AAC
- Resolution: 1920x1080
- FPS: 30

If `music.mp3` missing, render voice-only. If `voice.mp3` missing, render silent/music-only with warning.

## Error handling

- Missing 9Router: show readable error, do not crash server.
- Missing text model: show setup warning and allow manual script/scenes editing.
- Invalid scenes JSON: show validation errors and keep previous file unchanged.
- Missing FFmpeg: show install command in README.
- Missing edge-tts: show install command `pip install edge-tts`.
- Missing assets: render placeholders or skip with warning depending scene count.

## Sample project

Create `projects/the-fall-of-the-roman-empire/` with:

- `metadata.json`
- `script.txt`
- `scenes.json`
- `subtitles.srt`
- empty `images/`, `videos/`, `output/`
- sample prompts covering image and image-to-video fields

## Success criteria

- User can run `npm install` then `npm start`.
- Local web opens at `http://localhost:3000`.
- User can create/edit project without login.
- App saves files in local `projects/{slug}`.
- App can call local 9Router for text and image generation when configured.
- App can generate `voice.mp3` using edge-tts.
- App can generate valid `subtitles.srt`.
- App can render `output/final_video.mp4` with FFmpeg from images/video + voice + subtitles + optional music.
- Sample project exists and loads.
