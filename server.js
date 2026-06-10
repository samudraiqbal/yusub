const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

const { generateText, generateImage } = require('./src/ai9router');
const store = require('./src/projectStore');
const { parseGeneratedScenes, normalizeSceneVideoFlag } = require('./src/sceneUtils');
const { generateSceneVoiceOvers, generateVoicePreview } = require('./src/tts');
const { generateSRT } = require('./src/subtitles');
const { renderVideo } = require('./src/render');
const { VOICE_PRESETS, getVoicePreset } = require('./src/voicePresets');
const { createJobManager } = require('./src/jobManager');

const app = express();
const PORT = process.env.PORT || 3000;
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

app.use(cors());
app.use(express.json());
app.use('/projects', express.static(path.join(__dirname, 'projects')));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { slug } = req.params;
    const projectFolder = store.getProjectFolder(slug);
    cb(null, file.fieldname === 'music' ? projectFolder : path.join(projectFolder, 'images'));
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'music') cb(null, 'music.mp3');
    else cb(null, `${req.params.sceneId}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

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
    const preset = getVoicePreset((req.body || {}).presetId);
    const previewsDir = path.join(__dirname, 'projects', '_previews');
    fs.mkdirSync(previewsDir, { recursive: true });
    const outputPath = path.join(previewsDir, `${preset.id}.mp3`);
    await generateVoicePreview(preset.previewText, outputPath, preset);
    res.json({ success: true, path: `/projects/_previews/${preset.id}.mp3`, preset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects', (req, res) => {
  try {
    res.json(store.listProjects());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:slug', (req, res) => {
  try {
    const deleted = store.deleteProject(req.params.slug);
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, slug: req.params.slug });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const folder = store.getProjectFolder(slug);
    const metaPath = path.join(folder, 'metadata.json');
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'Project not found' });

    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const script = store.getScript(slug);
    const scenes = store.getScenes(slug);
    const assets = {
      voice: fs.existsSync(path.join(folder, 'voice.mp3')),
      music: fs.existsSync(path.join(folder, 'music.mp3')),
      subtitles: fs.existsSync(path.join(folder, 'subtitles.srt')),
      video: fs.existsSync(path.join(folder, 'output', 'final_video.mp4')),
      scenes: []
    };

    scenes.forEach(scene => {
      assets.scenes.push({
        scene_id: scene.scene_id,
        hasImage: fs.existsSync(path.join(folder, 'images', `${scene.scene_id}.png`)) ||
          fs.existsSync(path.join(folder, 'images', `${scene.scene_id}.jpg`)) ||
          fs.existsSync(path.join(folder, 'images', `${scene.scene_id}.jpeg`)),
        hasVideo: fs.existsSync(path.join(folder, 'videos', `${scene.scene_id}.mp4`))
      });
    });

    res.json({ metadata, script, scenes, assets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const { title, target_duration_minutes, style, tone } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const metadata = {
      title,
      slug,
      target_duration_minutes: Number(target_duration_minutes) || 10,
      style: style || 'dark history documentary',
      tone: tone || 'cinematic',
      created_at: new Date().toISOString(),
      ai_base_url: process.env.AI_BASE_URL,
      ai_text_model: process.env.AI_TEXT_MODEL,
      ai_image_model: process.env.AI_IMAGE_MODEL
    };
    store.saveMetadata(slug, metadata);
    store.saveScript(slug, '');
    store.saveScenes(slug, []);
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:slug/generate-script', (req, res) => {
  const { slug } = req.params;
  const job = runJob('generate-script', 'Writing documentary script...', async job => {
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

app.post('/api/projects/:slug/save-script', (req, res) => {
  try {
    store.saveScript(req.params.slug, req.body.script);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:slug/generate-scenes', (req, res) => {
  const { slug } = req.params;
  const job = runJob('generate-scenes', 'Planning scenes...', async job => {
    const script = store.getScript(slug);
    if (!script) throw new Error('Generate script first');
    const scenes = await parseGeneratedScenes(slug, script);
    store.saveScenes(slug, scenes);
    jobs.succeed(job.id, { scenes }, 'Scene plan generated');
  });
  res.json({ jobId: job.id });
});

app.post('/api/projects/:slug/save-scenes', (req, res) => {
  try {
    store.saveScenes(req.params.slug, (req.body.scenes || []).map(normalizeSceneVideoFlag));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:slug/scenes/:sceneId/generate-image', (req, res) => {
  const { slug, sceneId } = req.params;
  const job = runJob('generate-image', `Generating image for ${sceneId}...`, async job => {
    const scenes = store.getScenes(slug);
    const scene = scenes.find(s => s.scene_id === sceneId);
    if (!scene) throw new Error('Scene not found');
    const folder = store.getProjectFolder(slug);
    const outputImagePath = path.join(folder, 'images', `${sceneId}.png`);
    const imageResult = await generateImage(scene.image_prompt);
    if (imageResult.url) {
      const imgRes = await fetch(imageResult.url);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(outputImagePath, buffer);
    } else if (imageResult.b64) {
      fs.writeFileSync(outputImagePath, Buffer.from(imageResult.b64, 'base64'));
    } else {
      throw new Error('Image API did not return url or b64 data');
    }
    jobs.succeed(job.id, { path: `/projects/${slug}/images/${sceneId}.png` }, `Image generated for ${sceneId}`);
  });
  res.json({ jobId: job.id });
});

app.post('/api/projects/:slug/generate-voice', (req, res) => {
  const { slug } = req.params;
  const preset = getVoicePreset((req.body || {}).presetId);
  const job = runJob('generate-voice', 'Generating voice-over...', async job => {
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) throw new Error('Generate scene plan first');
    const folder = store.getProjectFolder(slug);
    const updatedScenes = await generateSceneVoiceOvers(folder, scenes, preset, progress => updateJob(job, progress));
    store.saveScenes(slug, updatedScenes);
    jobs.succeed(job.id, { path: `/projects/${slug}/voice.mp3`, preset }, 'Voice-over generated');
  });
  res.json({ jobId: job.id });
});

app.post('/api/projects/:slug/generate-subtitles', (req, res) => {
  const { slug } = req.params;
  const job = runJob('generate-subtitles', 'Writing subtitles...', async job => {
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) throw new Error('Generate scene plan first');
    const folder = store.getProjectFolder(slug);
    const srtContent = generateSRT(scenes);
    fs.writeFileSync(path.join(folder, 'subtitles.srt'), srtContent, 'utf8');
    jobs.succeed(job.id, { path: `/projects/${slug}/subtitles.srt` }, 'Subtitles generated');
  });
  res.json({ jobId: job.id });
});

app.post('/api/projects/:slug/upload-music', upload.single('music'), (req, res) => {
  res.json({ success: true, path: `/projects/${req.params.slug}/music.mp3` });
});

app.post('/api/projects/:slug/scenes/:sceneId/upload-image', upload.single('image'), (req, res) => {
  res.json({ success: true, path: `/projects/${req.params.slug}/images/${req.params.sceneId}${path.extname(req.file.originalname)}` });
});

app.post('/api/projects/:slug/render', (req, res) => {
  const { slug } = req.params;
  const job = runJob('render', 'Starting FFmpeg render...', async job => {
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) throw new Error('Generate scene plan first');
    const folder = store.getProjectFolder(slug);
    const volume = Number(process.env.MUSIC_VOLUME) || 0.12;
    await renderVideo(folder, scenes, volume, progress => updateJob(job, progress));
    jobs.succeed(job.id, { path: `/projects/${slug}/output/final_video.mp4` }, 'Final video rendered');
  });
  res.json({ jobId: job.id });
});

app.get('/api/projects/:slug/export', (req, res) => {
  try {
    const { slug } = req.params;
    const folder = store.getProjectFolder(slug);
    res.json({
      metadata: JSON.parse(fs.readFileSync(path.join(folder, 'metadata.json'), 'utf8')),
      script: store.getScript(slug),
      scenes: store.getScenes(slug)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`YouTube Faceless History pipeline running at http://localhost:${PORT}`);
});
