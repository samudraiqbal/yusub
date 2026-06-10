# YouTube History Video Pipeline Local Web App

A local web application to automatically build, plan, narrate, and render faceless YouTube history videos for international audiences.

## Features
- **Project Creator**: Select Topic, Duration, Tone, and Style.
- **English Script Generator**: Automated Hook, Intro, Main Story, Conflict, and Conclusion.
- **Scene Planner**: Detailed scene list with customizable duration, transition, image prompts, visual effects, and image-to-video recommendations.
- **AI Image Generator**: Integrates with local 9Router API (`http://localhost:20128/v1/images/generations`) to generate cinematic 16:9 history graphics.
- **Voice-Over Generator**: Leverages the free `edge-tts` Python package (no API key needed).
- **Subtitle Generator**: Auto-splits scene narration and outputs standard `.srt` format.
- **FFmpeg Video Renderer**: Combines static images (with Ken Burns slow pan/zoom effects) or video files, matches voice-over, burns subtitles, mixes background music, and outputs a 1920x1080 30FPS H.264 video.

---

## Folder Structure
```txt
projects/                   # All project folders stored locally
  {slug}/
    metadata.json           # Title, duration, style settings
    script.txt              # Script plain text
    scenes.json             # Structured scene timeline
    subtitles.srt           # Generated SRT subtitles
    voice.mp3               # edge-tts voiceover
    music.mp3               # Background music (optional upload)
    images/                 # Scene images
    videos/                 # Scene videos (optional upload)
    output/
      final_video.mp4       # Rendered video
```

---

## Installation & Setup

### Prerequisites
1. **Node.js** (v18+)
2. **Python** (v3.9+) with `pip`
3. **FFmpeg** installed and accessible in the system path (`ffmpeg` command)

### 1. Install edge-tts
Open a command prompt/terminal and install:
```bash
pip install edge-tts
```
Ensure Python is added to your environment `PATH` variables.

### 2. Install Project Dependencies
In the root directory of this project:
```bash
npm install
```

### 3. Environment Config
Create a `.env` file in the root folder (or copy `.env.example`):
```env
PORT=3000
AI_BASE_URL=http://localhost:20128/v1
AI_API_KEY=your-9router-api-key
AI_TEXT_MODEL=meta-llama/llama-3-70b-instruct
AI_IMAGE_MODEL=cx/gpt-5.5-image
TTS_VOICE=en-US-GuyNeural
MUSIC_VOLUME=0.12
```

---

## Running the Web App

Start the server:
```bash
npm start
```

Open your browser at:
```
http://localhost:3000
```

### How to use the Pipeline:
1. **Create or Choose Project**: Select the preloaded `"The Fall of the Roman Empire"` sample or click "New Project" to start fresh.
2. **Generate Script**: Input topic details and generate the script. Feel free to edit the generated text.
3. **Generate Scene Plan**: Divides your script into dynamic visual scenes, generating specialized image prompts, durations, camera motions, and recommendation badges.
4. **Acquire Assets**:
   - Click **Generate Image** for a scene to call 9Router's image model.
   - Or, upload your own images/videos using the **Upload** buttons in the table.
   - Click **Generate Voice-Over** to trigger `edge-tts` narration.
   - Click **Generate SRT Subtitles** to sync timings.
   - Upload background music by clicking **Upload music.mp3** (optional).
5. **Render Video**: Click **Start FFmpeg Render**. It generates temporary scene clips, applies pans/zooms to static pictures, overlays subtitles, mixes the audio tracks, and outputs `projects/{slug}/output/final_video.mp4`. Preview it directly inside the app when done.
