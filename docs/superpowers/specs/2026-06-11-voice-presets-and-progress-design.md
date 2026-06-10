# Voice Presets and Progress UI Design

## Goal

Make the video pipeline feel less flat and less confusing during long operations.

Add:
- English-only multi voice presets with preview.
- Persistent progress tracking for script, scene plan, image, voice-over, subtitles, and render jobs.

## Voice presets

Use the current `edge-tts` backend first. Keep the design extensible for future premium TTS providers.

### Presets

Six English presets:

1. **Dark Documentary** — deep, serious, slow. Good for mystery/history dark stories.
2. **Epic Trailer** — dramatic, firm, energetic. Good for war, collapse, disaster.
3. **Mystery Storyteller** — suspenseful, intimate. Good for myths and unsolved history.
4. **Calm Historian** — neutral, clear, slower. Good for educational narration.
5. **News Documentary** — crisp, confident. Good for factual documentary pacing.
6. **Ancient Storyteller** — warm, narrative. Good for legends and ancient civilizations.

Each preset stores:
- id
- label
- description
- `edge-tts` voice name
- rate
- pitch
- volume
- preview sample text

### UI

In the sidebar Audio/SRT area:
- Add **Voice Preset** dropdown.
- Add **Preview Voice** button.
- Add audio player for generated preview.
- Keep **Generate Voice-Over** button, but make it use the selected preset.

Preview behavior:
- User selects preset.
- User clicks **Preview Voice**.
- Server generates short sample MP3.
- UI shows audio player.

Full voice behavior:
- User selects preset.
- User clicks **Generate Voice-Over**.
- Server generates per-scene voice files and concatenates to `voice.mp3`.
- Scene durations stay synced to generated audio duration.

## Progress tracking

Replace short-only toast feedback with persistent job progress.

### UI

Add **Active Progress** panel in sidebar/status area.

Each job row shows:
- job name
- status: Idle, Running, Success, Failed
- current message
- progress count when available
- last update time
- error detail on failure

Jobs covered:
- Generate Script
- Generate Scene Plan
- Generate Image
- Generate Voice-Over
- Generate SRT
- FFmpeg Render

Buttons for running jobs are disabled while their job is active.

Toast remains, but only as secondary feedback.

### Server progress model

Use simple server-side job tracking with polling.

Endpoints:
- `POST /api/projects/:slug/generate-script` returns `{ jobId }`
- `POST /api/projects/:slug/generate-scenes` returns `{ jobId }`
- `POST /api/projects/:slug/scenes/:sceneId/generate-image` returns `{ jobId }`
- `POST /api/projects/:slug/generate-voice` returns `{ jobId }`
- `POST /api/projects/:slug/generate-subtitles` returns `{ jobId }`
- `POST /api/projects/:slug/render` returns `{ jobId }`
- `GET /api/jobs/:jobId` returns job status and result/error

Job state:

```json
{
  "id": "job_...",
  "type": "generate-voice",
  "status": "running",
  "message": "Generating voice for scene_003",
  "current": 3,
  "total": 19,
  "result": null,
  "error": null,
  "created_at": "...",
  "updated_at": "..."
}
```

Finished jobs keep result data briefly in memory for UI polling.

### Progress details by job

**Generate Script**
- Running: `Writing documentary script...`
- Success: `Script generated`
- Failed: model/API error message

**Generate Scene Plan**
- Running: `Planning scenes...`
- Success: `Scene plan generated`
- Failed: model/API or JSON parse error

**Generate Image**
- Running: `Generating image for scene_XXX...`
- Success: `Image generated`
- Failed: image API/download error

**Generate Voice-Over**
- Running per scene: `Generating voice for scene X / N`
- Success: `Voice-over generated`
- Failed: TTS/ffprobe/concat error

**Generate SRT**
- Running: `Writing subtitles...`
- Success: `Subtitles generated`
- Failed: file write error

**FFmpeg Render**
- Running per clip: `Rendering clip X / N`
- Next: `Concatenating clips...`
- Next: `Mixing audio and subtitles...`
- Success: `Final video rendered`
- Failed: FFmpeg error

## Architecture

Add a small job manager module:
- create job
- update progress
- succeed job
- fail job
- get job
- prune old jobs

Long-running server handlers start async jobs and return immediately.

Functions that do multi-step work accept optional `onProgress` callback:
- `generateSceneVoiceOvers(projectFolder, scenes, voice, onProgress)`
- `renderVideo(projectFolder, scenes, musicVolume, onProgress)`

This keeps progress logic out of core render/TTS code.

## Error handling

- Every async job catches errors.
- Job status becomes `failed`.
- UI shows error detail in progress panel.
- Buttons re-enable after failure.
- Existing output files are not deleted automatically.

## Testing

Add lightweight Node assertion tests:
- voice preset list has six English presets and required fields.
- empty/unknown preset falls back safely.
- job manager transitions: pending/running/success/failed.
- TTS command args include selected voice/rate/pitch/volume.
- progress callback fires per voice scene.
- render progress callback fires per clip and final stages.

Manual verification:
- preview each voice preset creates playable MP3.
- generate voice-over uses selected preset.
- progress panel updates during script, scenes, voice, SRT, image, and render.
- failure shows readable error.

## Out of scope

- Premium TTS provider integration.
- Indonesian voices.
- Persistent job database across server restarts.
- Real-time WebSocket/SSE progress.
