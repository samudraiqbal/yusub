# Voice Presets and Progress UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English voice preset selection with preview audio and persistent polling-based progress for long-running pipeline jobs.

**Architecture:** Add focused modules for voice presets and in-memory jobs, then wire existing server handlers to return job IDs and update progress asynchronously. Keep core TTS/render functions reusable by passing optional progress callbacks. Update the browser UI to poll jobs, show progress rows, disable active buttons, and refresh project data when jobs finish.

**Tech Stack:** Node.js, Express, browser fetch API, `edge-tts`, FFmpeg/ffprobe, lightweight Node `assert` tests.

---

## File structure

- Create `src/voicePresets.js` — source of truth for six English voice presets and fallback lookup.
- Create `src/jobManager.js` — in-memory job creation, update, success, failure, lookup, and pruning.
- Modify `src/tts.js` — accept preset/options, pass `--rate`, `--pitch`, `--volume`, generate previews, emit per-scene progress.
- Modify `src/render.js` — accept optional progress callback and emit clip/concat/mix stages.
- Modify `server.js` — expose presets/jobs endpoints, convert long-running handlers to async jobs, pass progress callbacks.
- Modify `public/index.html` — add voice preset controls and Active Progress panel.
- Modify `public/app.js` — load presets, preview selected voice, start jobs, poll job status, update progress UI, refresh project data after success.
- Modify `public/styles.css` — style voice controls, preview player, progress rows, running/success/failed states.
- Create `voice-presets.test.js` — verify preset list and fallback.
- Create `job-manager.test.js` — verify job transitions.
- Create `tts-options.test.js` — verify `edge-tts` command args include selected voice/rate/pitch/volume.

Project is not a git repository. Replace commit steps with checkpoint notes and do not run git commands.

---

### Task 1: Add voice preset module

**Files:**
- Create: `D:\Project\Yusub\src\voicePresets.js`
- Create: `D:\Project\Yusub\voice-presets.test.js`

- [ ] **Step 1: Write failing preset test**

Create `D:\Project\Yusub\voice-presets.test.js`:

```js
const assert = require('assert');
const { VOICE_PRESETS, getVoicePreset } = require('./src/voicePresets');

assert.strictEqual(VOICE_PRESETS.length, 6, 'should expose exactly six English presets');

for (const preset of VOICE_PRESETS) {
  assert.ok(preset.id, 'preset should have id');
  assert.ok(preset.label, `${preset.id} should have label`);
  assert.ok(preset.description, `${preset.id} should have description`);
  assert.ok(preset.voice, `${preset.id} should have edge-tts voice`);
  assert.ok(preset.rate, `${preset.id} should have rate`);
  assert.ok(preset.pitch, `${preset.id} should have pitch`);
  assert.ok(preset.volume, `${preset.id} should have volume`);
  assert.ok(preset.previewText, `${preset.id} should have preview text`);
  assert.strictEqual(preset.language, 'en', `${preset.id} should be English`);
}

assert.strictEqual(getVoicePreset('dark-documentary').id, 'dark-documentary');
assert.strictEqual(getVoicePreset('').id, 'dark-documentary', 'empty preset falls back to default');
assert.strictEqual(getVoicePreset('missing').id, 'dark-documentary', 'unknown preset falls back to default');

console.log('voice preset tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node voice-presets.test.js
```

Expected: FAIL with `Cannot find module './src/voicePresets'`.

- [ ] **Step 3: Create minimal preset module**

Create `D:\Project\Yusub\src\voicePresets.js`:

```js
const VOICE_PRESETS = [
  {
    id: 'dark-documentary',
    label: 'Dark Documentary',
    description: 'Deep, serious, slow narration for mystery and dark history.',
    language: 'en',
    voice: 'en-US-GuyNeural',
    rate: '-12%',
    pitch: '-8Hz',
    volume: '+0%',
    previewText: 'Beneath the silence of history, an empire waits to reveal its final secret.'
  },
  {
    id: 'epic-trailer',
    label: 'Epic Trailer',
    description: 'Dramatic and firm narration for war, collapse, and disaster scenes.',
    language: 'en',
    voice: 'en-US-GuyNeural',
    rate: '-4%',
    pitch: '-4Hz',
    volume: '+8%',
    previewText: 'When the sky turned black, the greatest civilization on Earth faced its final hour.'
  },
  {
    id: 'mystery-storyteller',
    label: 'Mystery Storyteller',
    description: 'Suspenseful, intimate narration for myths and unsolved history.',
    language: 'en',
    voice: 'en-US-DavisNeural',
    rate: '-10%',
    pitch: '-3Hz',
    volume: '+0%',
    previewText: 'Somewhere beyond the maps, a forgotten city slipped beneath the waves.'
  },
  {
    id: 'calm-historian',
    label: 'Calm Historian',
    description: 'Neutral, clear, slower educational narration.',
    language: 'en',
    voice: 'en-US-AriaNeural',
    rate: '-8%',
    pitch: '-2Hz',
    volume: '+0%',
    previewText: 'To understand this mystery, we must return to the earliest written account.'
  },
  {
    id: 'news-documentary',
    label: 'News Documentary',
    description: 'Crisp, confident narration for factual documentary pacing.',
    language: 'en',
    voice: 'en-US-JennyNeural',
    rate: '+0%',
    pitch: '+0Hz',
    volume: '+0%',
    previewText: 'New evidence has reopened one of history’s most debated questions.'
  },
  {
    id: 'ancient-storyteller',
    label: 'Ancient Storyteller',
    description: 'Warm narrative voice for legends and ancient civilizations.',
    language: 'en',
    voice: 'en-GB-RyanNeural',
    rate: '-10%',
    pitch: '-5Hz',
    volume: '+0%',
    previewText: 'Long before our age, sailors spoke of a kingdom blessed by the gods.'
  }
];

const DEFAULT_PRESET_ID = 'dark-documentary';

function getVoicePreset(id) {
  return VOICE_PRESETS.find(preset => preset.id === id) || VOICE_PRESETS.find(preset => preset.id === DEFAULT_PRESET_ID);
}

module.exports = { VOICE_PRESETS, DEFAULT_PRESET_ID, getVoicePreset };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node voice-presets.test.js
```

Expected: `voice preset tests passed`.

- [ ] **Checkpoint**

Note in session: `Checkpoint: voice preset module complete. No git commit because project is not a git repository.`

---

### Task 2: Add job manager module

**Files:**
- Create: `D:\Project\Yusub\src\jobManager.js`
- Create: `D:\Project\Yusub\job-manager.test.js`

- [ ] **Step 1: Write failing job manager test**

Create `D:\Project\Yusub\job-manager.test.js`:

```js
const assert = require('assert');
const { createJobManager } = require('./src/jobManager');

const jobs = createJobManager({ now: () => '2026-06-11T00:00:00.000Z' });
const job = jobs.create('generate-voice', 'Generating voice-over');

assert.ok(job.id.startsWith('job_'), 'job id should use job_ prefix');
assert.strictEqual(job.type, 'generate-voice');
assert.strictEqual(job.status, 'running');
assert.strictEqual(job.message, 'Generating voice-over');
assert.strictEqual(job.current, 0);
assert.strictEqual(job.total, 0);

jobs.update(job.id, { message: 'Generating voice for scene 1 / 2', current: 1, total: 2 });
let updated = jobs.get(job.id);
assert.strictEqual(updated.message, 'Generating voice for scene 1 / 2');
assert.strictEqual(updated.current, 1);
assert.strictEqual(updated.total, 2);

jobs.succeed(job.id, { path: '/projects/demo/voice.mp3' }, 'Voice-over generated');
updated = jobs.get(job.id);
assert.strictEqual(updated.status, 'success');
assert.deepStrictEqual(updated.result, { path: '/projects/demo/voice.mp3' });
assert.strictEqual(updated.error, null);

const failed = jobs.create('render', 'Rendering');
jobs.fail(failed.id, new Error('ffmpeg failed'));
updated = jobs.get(failed.id);
assert.strictEqual(updated.status, 'failed');
assert.strictEqual(updated.error, 'ffmpeg failed');

assert.strictEqual(jobs.get('missing'), null);

console.log('job manager tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node job-manager.test.js
```

Expected: FAIL with `Cannot find module './src/jobManager'`.

- [ ] **Step 3: Create job manager**

Create `D:\Project\Yusub\src\jobManager.js`:

```js
function createJobManager(options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const jobs = new Map();
  let nextId = 1;

  function stamp(job) {
    job.updated_at = now();
    return job;
  }

  function create(type, message = 'Starting...') {
    const id = `job_${Date.now()}_${nextId++}`;
    const time = now();
    const job = {
      id,
      type,
      status: 'running',
      message,
      current: 0,
      total: 0,
      result: null,
      error: null,
      created_at: time,
      updated_at: time
    };
    jobs.set(id, job);
    return { ...job };
  }

  function get(id) {
    const job = jobs.get(id);
    return job ? { ...job } : null;
  }

  function update(id, patch = {}) {
    const job = jobs.get(id);
    if (!job) return null;
    Object.assign(job, patch);
    stamp(job);
    return { ...job };
  }

  function succeed(id, result = null, message = 'Done') {
    return update(id, { status: 'success', message, result, error: null });
  }

  function fail(id, error) {
    const message = error && error.message ? error.message : String(error || 'Unknown error');
    return update(id, { status: 'failed', message, error: message });
  }

  function prune(maxAgeMs = 30 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, job] of jobs.entries()) {
      if (job.status !== 'running') {
        const updated = Date.parse(job.updated_at);
        if (!Number.isNaN(updated) && updated < cutoff) jobs.delete(id);
      }
    }
  }

  return { create, get, update, succeed, fail, prune };
}

module.exports = { createJobManager };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node job-manager.test.js
```

Expected: `job manager tests passed`.

- [ ] **Checkpoint**

Note in session: `Checkpoint: job manager complete. No git commit because project is not a git repository.`

---

### Task 3: Extend TTS for presets, preview, and progress

**Files:**
- Modify: `D:\Project\Yusub\src\tts.js`
- Create: `D:\Project\Yusub\tts-options.test.js`

- [ ] **Step 1: Write failing TTS options test**

Create `D:\Project\Yusub\tts-options.test.js`:

```js
const assert = require('assert');
const { buildEdgeTtsArgs } = require('./src/tts');

const args = buildEdgeTtsArgs({
  voice: 'en-US-DavisNeural',
  rate: '-10%',
  pitch: '-3Hz',
  volume: '+0%',
  filePath: 'D:/tmp/input.txt',
  outputPath: 'D:/tmp/output.mp3'
});

assert.deepStrictEqual(args, [
  '-m', 'edge_tts',
  '--voice', 'en-US-DavisNeural',
  '--rate', '-10%',
  '--pitch', '-3Hz',
  '--volume', '+0%',
  '--file', 'D:/tmp/input.txt',
  '--write-media', 'D:/tmp/output.mp3'
]);

console.log('tts option tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node tts-options.test.js
```

Expected: FAIL with `buildEdgeTtsArgs is not a function`.

- [ ] **Step 3: Update `src/tts.js`**

Modify `D:\Project\Yusub\src\tts.js` to include these functions and exports while keeping existing behavior:

```js
function buildEdgeTtsArgs({ voice, rate, pitch, volume, filePath, outputPath }) {
  return [
    '-m', 'edge_tts',
    '--voice', voice,
    '--rate', rate,
    '--pitch', pitch,
    '--volume', volume,
    '--file', filePath,
    '--write-media', outputPath
  ];
}

function normalizeVoiceOptions(options = {}) {
  return {
    voice: options.voice || process.env.TTS_VOICE || 'en-US-GuyNeural',
    rate: options.rate || '+0%',
    pitch: options.pitch || '+0Hz',
    volume: options.volume || '+0%'
  };
}
```

Change `generateVoiceOver` signature and body to:

```js
async function generateVoiceOver(text, outputPath, options = {}) {
  const voiceOptions = normalizeVoiceOptions(typeof options === 'string' ? { voice: options } : options);
  const textPath = path.join(path.dirname(outputPath), 'tts_text.txt');
  fs.writeFileSync(textPath, text, 'utf8');
  try {
    const args = buildEdgeTtsArgs({ ...voiceOptions, filePath: textPath, outputPath });
    await execFilePromise('python', args);
    return outputPath;
  } finally {
    try { fs.unlinkSync(textPath); } catch (_) {}
  }
}
```

Change `generateSceneVoiceOvers` signature and loop to:

```js
async function generateSceneVoiceOvers(projectFolder, scenes, options = {}, onProgress = null) {
  const voiceDir = path.join(projectFolder, 'voice');
  fs.mkdirSync(voiceDir, { recursive: true });

  const audioFiles = [];
  const updatedScenes = [];

  for (const [index, scene] of scenes.entries()) {
    if (onProgress) {
      onProgress({
        message: `Generating voice for scene ${index + 1} / ${scenes.length}`,
        current: index + 1,
        total: scenes.length
      });
    }
    const audioPath = path.join(voiceDir, `${scene.scene_id}.mp3`);
    const narration = scene.narration_text || scene.subtitle_text || '';
    await generateVoiceOver(narration, audioPath, options);
    const duration = await getAudioDuration(audioPath);
    audioFiles.push(audioPath);
    updatedScenes.push({
      ...scene,
      duration_seconds: Math.max(1, Number(duration.toFixed(2)))
    });
  }

  if (onProgress) onProgress({ message: 'Combining voice-over files...', current: scenes.length, total: scenes.length });
  await concatAudio(audioFiles, path.join(projectFolder, 'voice.mp3'));
  return updatedScenes;
}
```

Add preview helper:

```js
async function generateVoicePreview(text, outputPath, options = {}) {
  await generateVoiceOver(text, outputPath, options);
  return outputPath;
}
```

Export:

```js
module.exports = { generateVoiceOver, generateSceneVoiceOvers, generateVoicePreview, getAudioDuration, buildEdgeTtsArgs, normalizeVoiceOptions };
```

- [ ] **Step 4: Run TTS tests**

Run:

```powershell
node tts-options.test.js
node voice-presets.test.js
```

Expected:

```text
tts option tests passed
voice preset tests passed
```

- [ ] **Checkpoint**

Note in session: `Checkpoint: TTS preset plumbing complete. No git commit because project is not a git repository.`

---

### Task 4: Add render progress callbacks

**Files:**
- Modify: `D:\Project\Yusub\src\render.js`
- Modify: `D:\Project\Yusub\render-filter.test.js`

- [ ] **Step 1: Add failing render progress assertions**

Append to `D:\Project\Yusub\render-filter.test.js`:

```js
const { createRenderProgressMessage } = require('./src/render');

assert.deepStrictEqual(
  createRenderProgressMessage(2, 5),
  { message: 'Rendering clip 2 / 5', current: 2, total: 5 }
);

console.log('render progress tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node render-filter.test.js
```

Expected: FAIL with `createRenderProgressMessage is not a function`.

- [ ] **Step 3: Implement render progress**

Add helper in `D:\Project\Yusub\src\render.js`:

```js
function createRenderProgressMessage(current, total) {
  return { message: `Rendering clip ${current} / ${total}`, current, total };
}
```

Change `renderVideo` signature:

```js
async function renderVideo(projectFolder, scenes, musicVolume = 0.12, onProgress = null) {
```

Inside clip loop, before `createSceneClip`:

```js
const sceneIndex = clips.length + 1;
if (onProgress) onProgress(createRenderProgressMessage(sceneIndex, scenes.length));
await createSceneClip(source, clip, Number(scene.duration_seconds || 5), scene.visual_effect || 'slow zoom in', isVideo);
```

Before concat:

```js
if (onProgress) onProgress({ message: 'Concatenating clips...', current: scenes.length, total: scenes.length });
```

Before mix:

```js
if (onProgress) onProgress({ message: 'Mixing audio and subtitles...', current: scenes.length, total: scenes.length });
```

Export:

```js
module.exports = { renderVideo, buildImageFilter, createRenderProgressMessage };
```

- [ ] **Step 4: Run render tests**

Run:

```powershell
node render-filter.test.js
```

Expected includes:

```text
render filter stability tests passed
render progress tests passed
```

- [ ] **Checkpoint**

Note in session: `Checkpoint: render progress callbacks complete. No git commit because project is not a git repository.`

---

### Task 5: Convert server operations to jobs and add preset endpoints

**Files:**
- Modify: `D:\Project\Yusub\server.js`

- [ ] **Step 1: Add imports and job manager**

Modify imports in `server.js`:

```js
const { VOICE_PRESETS, getVoicePreset } = require('./src/voicePresets');
const { createJobManager } = require('./src/jobManager');
```

Change TTS import:

```js
const { generateVoiceOver, generateSceneVoiceOvers, generateVoicePreview } = require('./src/tts');
```

After `const PORT = process.env.PORT || 3000;` add:

```js
const jobs = createJobManager();

function runJob(type, initialMessage, work) {
  const job = jobs.create(type, initialMessage);
  Promise.resolve()
    .then(() => work(job))
    .catch(error => jobs.fail(job.id, error));
  return job;
}

function updateJob(job, patch) {
  jobs.update(job.id, patch);
}
```

- [ ] **Step 2: Add endpoints**

Add near API routes:

```js
app.get('/api/voice-presets', (req, res) => {
  res.json(VOICE_PRESETS);
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.post('/api/voice-preview', async (req, res) => {
  try {
    const { presetId } = req.body || {};
    const preset = getVoicePreset(presetId);
    const previewsDir = path.join(__dirname, 'projects', '_previews');
    fs.mkdirSync(previewsDir, { recursive: true });
    const outputPath = path.join(previewsDir, `${preset.id}.mp3`);
    await generateVoicePreview(preset.previewText, outputPath, preset);
    res.json({ success: true, path: `/projects/_previews/${preset.id}.mp3`, preset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 3: Convert generate script route**

Replace body of `app.post('/api/projects/:slug/generate-script', async (req, res) => { ... })` with job start:

```js
app.post('/api/projects/:slug/generate-script', (req, res) => {
  const { slug } = req.params;
  const job = runJob('generate-script', 'Writing documentary script...', async (job) => {
    const folder = store.getProjectFolder(slug);
    const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'metadata.json'), 'utf8'));
    const prompt = `Write an engaging English documentary video script about: "${metadata.title}".
Target Video Duration: ${metadata.target_duration_minutes} minutes.
Historical Style: ${metadata.style}.
Narration Tone: ${metadata.tone}.

Provide the script structured clearly with tags like [HOOK], [INTRO], [MAIN STORY], [CONFLICT/TWIST], and [ENDING/CONCLUSION].
Write only the script text. Do not output meta dialogue or introduction text.`;
    const script = await generateText(prompt, 'You are an expert history script writer for popular YouTube channels.');
    store.saveScript(slug, script);
    jobs.succeed(job.id, { script }, 'Script generated');
  });
  res.json({ jobId: job.id });
});
```

- [ ] **Step 4: Convert generate scenes route**

Replace `generate-scenes` route with:

```js
app.post('/api/projects/:slug/generate-scenes', (req, res) => {
  const { slug } = req.params;
  const job = runJob('generate-scenes', 'Planning scenes...', async (job) => {
    const script = store.getScript(slug);
    if (!script) throw new Error('Generate script first');
    const scenes = await parseGeneratedScenes(slug, script);
    store.saveScenes(slug, scenes);
    jobs.succeed(job.id, { scenes }, 'Scene plan generated');
  });
  res.json({ jobId: job.id });
});
```

- [ ] **Step 5: Convert generate image route**

Replace `generate-image` route with a job version that keeps the existing image logic and ends with:

```js
jobs.succeed(job.id, { path: `/projects/${slug}/images/${sceneId}.png` }, `Image generated for ${sceneId}`);
```

Initial message:

```js
`Generating image for ${sceneId}...`
```

- [ ] **Step 6: Convert generate voice route**

Replace `generate-voice` route with:

```js
app.post('/api/projects/:slug/generate-voice', (req, res) => {
  const { slug } = req.params;
  const { presetId } = req.body || {};
  const preset = getVoicePreset(presetId);
  const job = runJob('generate-voice', 'Generating voice-over...', async (job) => {
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) throw new Error('Generate scene plan first');
    const folder = store.getProjectFolder(slug);
    const updatedScenes = await generateSceneVoiceOvers(folder, scenes, preset, progress => updateJob(job, progress));
    store.saveScenes(slug, updatedScenes);
    jobs.succeed(job.id, { path: `/projects/${slug}/voice.mp3`, preset }, 'Voice-over generated');
  });
  res.json({ jobId: job.id });
});
```

- [ ] **Step 7: Convert subtitles route**

Replace `generate-subtitles` route with a job version:

```js
app.post('/api/projects/:slug/generate-subtitles', (req, res) => {
  const { slug } = req.params;
  const job = runJob('generate-subtitles', 'Writing subtitles...', async (job) => {
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) throw new Error('Generate scene plan first');
    const folder = store.getProjectFolder(slug);
    const srtContent = generateSRT(scenes);
    fs.writeFileSync(path.join(folder, 'subtitles.srt'), srtContent, 'utf8');
    jobs.succeed(job.id, { path: `/projects/${slug}/subtitles.srt` }, 'Subtitles generated');
  });
  res.json({ jobId: job.id });
});
```

- [ ] **Step 8: Convert render route**

Replace render route with:

```js
app.post('/api/projects/:slug/render', (req, res) => {
  const { slug } = req.params;
  const job = runJob('render', 'Starting FFmpeg render...', async (job) => {
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) throw new Error('Generate scene plan first');
    const folder = store.getProjectFolder(slug);
    const volume = Number(process.env.MUSIC_VOLUME) || 0.12;
    await renderVideo(folder, scenes, volume, progress => updateJob(job, progress));
    jobs.succeed(job.id, { path: `/projects/${slug}/output/final_video.mp4` }, 'Final video rendered');
  });
  res.json({ jobId: job.id });
});
```

- [ ] **Step 9: Run server smoke test**

Run:

```powershell
node -e "require('./server')"
```

Expected: server starts with `YouTube Faceless History pipeline running at http://localhost:3000`. Stop it with Ctrl+C if run foreground. If port busy, stop existing `node server.js` process first.

- [ ] **Checkpoint**

Note in session: `Checkpoint: server jobs and voice endpoints complete. No git commit because project is not a git repository.`

---

### Task 6: Add voice controls and progress panel HTML/CSS

**Files:**
- Modify: `D:\Project\Yusub\public\index.html`
- Modify: `D:\Project\Yusub\public\styles.css`

- [ ] **Step 1: Add sidebar HTML**

In `index.html`, under Audio/SRT buttons, add:

```html
<div class="voice-controls">
  <h3>Voice Preset</h3>
  <select id="voice-preset-list"></select>
  <p id="voice-preset-description" class="helper-text"></p>
  <button id="btn-preview-voice" class="btn btn-secondary btn-block">Preview Voice</button>
  <audio id="voice-preview-player" controls class="hidden"></audio>
</div>

<div id="progress-panel" class="progress-panel">
  <h3>Active Progress</h3>
  <div id="progress-list" class="progress-list">
    <div class="progress-empty">No active jobs</div>
  </div>
</div>
```

- [ ] **Step 2: Add CSS**

Append to `styles.css`:

```css
.voice-controls {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.voice-controls select,
.voice-controls audio {
  width: 100%;
}

.helper-text {
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 0.5rem 0;
}

.progress-panel {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.progress-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-empty {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.progress-job {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem;
  background: rgba(255, 255, 255, 0.03);
}

.progress-job-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.progress-job-message,
.progress-job-time,
.progress-job-error {
  margin-top: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.progress-job-error {
  color: var(--error);
  white-space: pre-wrap;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.progress-bar-fill {
  height: 100%;
  width: 0%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.progress-running .progress-job-status { color: var(--accent); }
.progress-success .progress-job-status { color: var(--success); }
.progress-failed .progress-job-status { color: var(--error); }
```

- [ ] **Step 3: Browser visual check**

Start server and open `http://localhost:3000`. Expected: sidebar shows Voice Preset controls and Active Progress panel.

- [ ] **Checkpoint**

Note in session: `Checkpoint: voice/progress UI shell complete. No git commit because project is not a git repository.`

---

### Task 7: Wire browser JavaScript to jobs and voice presets

**Files:**
- Modify: `D:\Project\Yusub\public\app.js`

- [ ] **Step 1: Add state**

At top of `app.js` add:

```js
let voicePresets = [];
let activeJobs = new Map();
let selectedVoicePresetId = 'dark-documentary';
```

Change DOMContentLoaded to:

```js
document.addEventListener('DOMContentLoaded', async () => {
  await loadVoicePresets();
  loadProjects();
  setupEventListeners();
});
```

- [ ] **Step 2: Add event listeners**

In `setupEventListeners()` add:

```js
document.getElementById('voice-preset-list').addEventListener('change', (e) => {
  selectedVoicePresetId = e.target.value;
  updateVoicePresetDescription();
});
document.getElementById('btn-preview-voice').addEventListener('click', previewVoice);
```

- [ ] **Step 3: Add voice preset functions**

Add:

```js
async function loadVoicePresets() {
  voicePresets = await apiJson('/api/voice-presets');
  const select = document.getElementById('voice-preset-list');
  select.innerHTML = '';
  voicePresets.forEach(preset => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    select.appendChild(option);
  });
  selectedVoicePresetId = voicePresets[0]?.id || 'dark-documentary';
  select.value = selectedVoicePresetId;
  updateVoicePresetDescription();
}

function getSelectedVoicePreset() {
  return voicePresets.find(preset => preset.id === selectedVoicePresetId) || voicePresets[0];
}

function updateVoicePresetDescription() {
  const preset = getSelectedVoicePreset();
  document.getElementById('voice-preset-description').textContent = preset ? preset.description : '';
}

async function previewVoice() {
  setButtonBusy('btn-preview-voice', true);
  try {
    const data = await apiJson('/api/voice-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: selectedVoicePresetId })
    });
    const player = document.getElementById('voice-preview-player');
    player.src = `${data.path}?t=${Date.now()}`;
    player.classList.remove('hidden');
    showToast('Voice preview ready');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonBusy('btn-preview-voice', false);
  }
}
```

- [ ] **Step 4: Add job polling functions**

Add:

```js
function setButtonBusy(id, busy) {
  const button = document.getElementById(id);
  if (button) button.disabled = busy;
}

function jobLabel(type) {
  return {
    'generate-script': 'Generate Script',
    'generate-scenes': 'Generate Scene Plan',
    'generate-image': 'Generate Image',
    'generate-voice': 'Generate Voice-Over',
    'generate-subtitles': 'Generate SRT',
    render: 'FFmpeg Render'
  }[type] || type;
}

function renderProgressPanel() {
  const list = document.getElementById('progress-list');
  const jobs = Array.from(activeJobs.values());
  if (jobs.length === 0) {
    list.innerHTML = '<div class="progress-empty">No active jobs</div>';
    return;
  }
  list.innerHTML = jobs.map(job => {
    const percent = job.total ? Math.round((job.current / job.total) * 100) : (job.status === 'success' ? 100 : 0);
    const statusClass = `progress-${job.status}`;
    return `
      <div class="progress-job ${statusClass}">
        <div class="progress-job-header">
          <span>${jobLabel(job.type)}</span>
          <span class="progress-job-status">${job.status}</span>
        </div>
        <div class="progress-job-message">${job.message || ''}</div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
        <div class="progress-job-time">Updated: ${new Date(job.updated_at).toLocaleTimeString()}</div>
        ${job.error ? `<div class="progress-job-error">${job.error}</div>` : ''}
      </div>
    `;
  }).join('');
}

async function startJob(request, buttonId, onSuccess) {
  setButtonBusy(buttonId, true);
  try {
    const start = await request();
    const jobId = start.jobId;
    if (!jobId) throw new Error('Server did not return jobId');
    await pollJob(jobId, buttonId, onSuccess);
  } catch (error) {
    showToast(error.message, 'error');
    setButtonBusy(buttonId, false);
  }
}

async function pollJob(jobId, buttonId, onSuccess) {
  const timer = setInterval(async () => {
    try {
      const job = await apiJson(`/api/jobs/${jobId}`);
      activeJobs.set(jobId, job);
      renderProgressPanel();
      if (job.status === 'success') {
        clearInterval(timer);
        setButtonBusy(buttonId, false);
        showToast(job.message || 'Job complete');
        if (onSuccess) await onSuccess(job);
      }
      if (job.status === 'failed') {
        clearInterval(timer);
        setButtonBusy(buttonId, false);
        showToast(job.error || job.message || 'Job failed', 'error');
      }
    } catch (error) {
      clearInterval(timer);
      setButtonBusy(buttonId, false);
      showToast(error.message, 'error');
    }
  }, 1000);
}
```

- [ ] **Step 5: Update existing button handlers to jobs**

Replace `generateScript`, `generateScenes`, `generateSceneImage`, `generateVoice`, `generateSubtitles`, and `renderVideo` bodies so each uses `startJob`.

Example for voice:

```js
async function generateVoice() {
  if (!currentProject) return;
  await startJob(
    () => apiJson(`/api/projects/${currentProject.metadata.slug}/generate-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: selectedVoicePresetId })
    }),
    'btn-gen-voice',
    () => loadProjectDetails(currentProject.metadata.slug)
  );
}
```

Use same pattern:
- `generateScript` button `btn-generate-script`, POST `/generate-script`, on success set script editor from `job.result.script` and reload details.
- `generateScenes` button `btn-generate-scenes`, POST `/generate-scenes`, on success reload details.
- `generateSceneImage(sceneId)` button selector cannot use fixed id; pass `null` and skip button disabling, or disable clicked button in a later small enhancement.
- `generateSubtitles` button `btn-gen-subs`, POST `/generate-subtitles`, reload details.
- `renderVideo` button `btn-render-video`, POST `/render`, reload details.

- [ ] **Step 6: Browser smoke check**

Start server, refresh browser with Ctrl+F5, select project. Expected:
- presets load in dropdown
- description changes when preset changes
- Preview Voice creates playable audio
- Generate Voice-Over shows progress row and updates per scene

- [ ] **Checkpoint**

Note in session: `Checkpoint: browser job polling and voice preset UI wired. No git commit because project is not a git repository.`

---

### Task 8: End-to-end verification

**Files:**
- No new files

- [ ] **Step 1: Run all Node tests**

Run:

```powershell
node voice-presets.test.js
node job-manager.test.js
node tts-options.test.js
node scene-video-flag.test.js
node render-filter.test.js
```

Expected all pass:

```text
voice preset tests passed
job manager tests passed
tts option tests passed
scene video flag tests passed
render filter stability tests passed
render progress tests passed
```

- [ ] **Step 2: Start fresh server**

Run:

```powershell
$existing = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($null -ne $existing) { Stop-Process -Id $existing.OwningProcess -Confirm:$false }
node server.js
```

Expected: `YouTube Faceless History pipeline running at http://localhost:3000`.

- [ ] **Step 3: Verify API endpoints**

In another terminal/session, run:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/voice-presets" | ConvertTo-Json -Depth 4
```

Expected: six preset objects.

Run:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/voice-preview" -ContentType "application/json" -Body '{"presetId":"dark-documentary"}' | ConvertTo-Json -Depth 4
```

Expected: JSON with `success: true` and preview `path`.

- [ ] **Step 4: Verify UI manually**

Open `http://localhost:3000`, Ctrl+F5, select Atlantis project.

Check:
- Voice Preset dropdown visible.
- Description visible.
- Preview Voice creates audio player and playable sample.
- Generate Voice-Over starts progress row.
- Generate SRT starts progress row and completes.
- Render starts progress row and shows clip/concat/mix messages.
- Failed job shows error detail if service fails.

- [ ] **Step 5: Final report**

Report exact commands run, outputs, and any gaps. Do not claim visual/audio quality is perfect; say what was verified and ask user to listen to preset previews/full voice.
