# YouTube History Video Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a local Node.js Express web app for generating faceless YouTube history scripts, scene planner, image prompts, subtitles, voice-over, and final video rendering using FFmpeg.

**Architecture:** Express backend, simple single-page frontend. Calls local 9Router API (`http://localhost:20128/v1`) for text completions and image generations. edge-tts Python package generates voice-over. FFmpeg merges images, audio, and subtitles into a 1080p video.

**Tech Stack:** Node.js Express, edge-tts CLI, fluent-ffmpeg, dotenv.

---

### Task 1: Project Scaffolding and Dependencies
**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `.env.example`

- [ ] **Step 1: Write package.json**
Run package initialization and install dependencies: `cors`, `dotenv`, `express`, `fluent-ffmpeg`, `multer`.
- [ ] **Step 2: Create .env and .env.example**
Configure `PORT=3000`, `AI_BASE_URL=http://localhost:20128/v1`, `AI_API_KEY`, `AI_TEXT_MODEL`, `AI_IMAGE_MODEL=cx/gpt-5.5-image`, `TTS_VOICE=en-US-GuyNeural`, `MUSIC_VOLUME=0.12`.
- [ ] **Step 3: Run npm install**
Verify all packages download successfully.

---

### Task 2: 9Router AI Integration Helper
**Files:**
- Create: `src/ai9router.js`

- [ ] **Step 1: Write text completions fetch wrapper**
Add `generateText(prompt, systemInstruction)` sending message payloads to `chat/completions`.
- [ ] **Step 2: Write image generation wrapper**
Add `generateImage(prompt)` sending to `images/generations` with `Accept: text/event-stream` and parse standard/SSE response format.

---

### Task 3: Local File Store & Scene Planner Utilities
**Files:**
- Create: `src/projectStore.js`
- Create: `src/sceneUtils.js`

- [ ] **Step 1: Write projectStore.js**
Add directory ensuring helper, project listing, and metadata/script/scene get and save methods to `projects/` subfolders.
- [ ] **Step 2: Write sceneUtils.js**
Add automatic scene parser parsing text response to strict JSON, formatting image prompts, and flagging `should_generate_video` via historical keyword matching (e.g. "battle", "war", "fire").

---

### Task 4: Voice-over (TTS) and Subtitles Generator
**Files:**
- Create: `src/tts.js`
- Create: `src/subtitles.js`

- [ ] **Step 1: Write tts.js**
Call python `edge-tts` package via CLI with a temporary text file to output `voice.mp3`.
- [ ] **Step 2: Write subtitles.js**
Calculate cumulative scene timing and write standard SRT subtitle format.

---

### Task 5: FFmpeg Video Renderer
**Files:**
- Create: `src/render.js`

- [ ] **Step 1: Write render.js**
Add video rendering queue. Generate temporary scene clips with zoompan filters, join via concat file, overlay subtitles with escaped paths, mix voice and music audio, and write final `output/final_video.mp4`.

---

### Task 6: Backend server
**Files:**
- Create: `server.js`

- [ ] **Step 1: Write server.js**
Assemble Express server. Set up routes for CRUD projects, triggering AI script/scene planning, generating assets, uploading music/images, and triggering video rendering.

---

### Task 7: Frontend UI
**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] **Step 1: Write HTML template**
Create layout including Project Selector, Config Sidebar, Script Editor, Scene Table, and Video Preview.
- [ ] **Step 2: Write styles.css**
Design a dark historical documentary aesthetic layout using dark gray and gold colors.
- [ ] **Step 3: Write app.js**
Hook button listeners for project creation, script editing, scene table manipulation, image generation, voice generation, and rendering.

---

### Task 8: Sample Project Setup
**Files:**
- Create: `projects/the-fall-of-the-roman-empire/metadata.json`
- Create: `projects/the-fall-of-the-roman-empire/script.txt`
- Create: `projects/the-fall-of-the-roman-empire/scenes.json`
- Create: `projects/the-fall-of-the-roman-empire/subtitles.srt`

- [ ] **Step 1: Seed Roman Empire files**
Provide mock configurations so the app immediately shows working items on start.
