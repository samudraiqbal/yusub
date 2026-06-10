const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

const { generateText, generateImage } = require('./src/ai9router');
const store = require('./src/projectStore');
const { parseGeneratedScenes, formatPrompt, normalizeSceneVideoFlag } = require('./src/sceneUtils');
const { generateVoiceOver, generateSceneVoiceOvers } = require('./src/tts');
const { generateSRT } = require('./src/subtitles');
const { renderVideo } = require('./src/render');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/projects', express.static(path.join(__dirname, 'projects')));
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { slug } = req.params;
    const projectFolder = store.getProjectFolder(slug);
    if (file.fieldname === 'music') {
      cb(null, projectFolder);
    } else {
      cb(null, path.join(projectFolder, 'images'));
    }
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'music') {
      cb(null, 'music.mp3');
    } else {
      const { sceneId } = req.params;
      cb(null, `${sceneId}${path.extname(file.originalname)}`);
    }
  }
});

const upload = multer({ storage });

// API: List projects
app.get('/api/projects', (req, res) => {
  try {
    const list = store.listProjects();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete project
app.delete('/api/projects/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const deleted = store.deleteProject(slug);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true, slug });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get project details
app.get('/api/projects/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const folder = store.getProjectFolder(slug);

    const metaPath = path.join(folder, 'metadata.json');
    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const script = store.getScript(slug);
    const scenes = store.getScenes(slug);

    // Check asset presence
    const assets = {
      voice: fs.existsSync(path.join(folder, 'voice.mp3')),
      music: fs.existsSync(path.join(folder, 'music.mp3')),
      subtitles: fs.existsSync(path.join(folder, 'subtitles.srt')),
      video: fs.existsSync(path.join(folder, 'output', 'final_video.mp4')),
      scenes: []
    };

    scenes.forEach(scene => {
      let hasImage = fs.existsSync(path.join(folder, 'images', `${scene.scene_id}.png`)) ||
                     fs.existsSync(path.join(folder, 'images', `${scene.scene_id}.jpg`)) ||
                     fs.existsSync(path.join(folder, 'images', `${scene.scene_id}.jpeg`));

      let hasVideo = fs.existsSync(path.join(folder, 'videos', `${scene.scene_id}.mp4`));

      assets.scenes.push({
        scene_id: scene.scene_id,
        hasImage,
        hasVideo
      });
    });

    res.json({ metadata, script, scenes, assets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Create project
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

// API: Generate script
app.post('/api/projects/:slug/generate-script', async (req, res) => {
  try {
    const { slug } = req.params;
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

    res.json({ script });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Save script
app.post('/api/projects/:slug/save-script', (req, res) => {
  try {
    const { slug } = req.params;
    const { script } = req.body;
    store.saveScript(slug, script);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Generate scenes plan
app.post('/api/projects/:slug/generate-scenes', async (req, res) => {
  try {
    const { slug } = req.params;
    const script = store.getScript(slug);
    if (!script) return res.status(400).json({ error: 'Generate script first' });

    const scenes = await parseGeneratedScenes(slug, script);
    store.saveScenes(slug, scenes);

    res.json({ scenes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Save scenes
app.post('/api/projects/:slug/save-scenes', (req, res) => {
  try {
    const { slug } = req.params;
    const { scenes } = req.body;
    store.saveScenes(slug, (scenes || []).map(normalizeSceneVideoFlag));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Generate image for single scene
app.post('/api/projects/:slug/scenes/:sceneId/generate-image', async (req, res) => {
  try {
    const { slug, sceneId } = req.params;
    const scenes = store.getScenes(slug);
    const scene = scenes.find(s => s.scene_id === sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const folder = store.getProjectFolder(slug);
    const outputImagePath = path.join(folder, 'images', `${sceneId}.png`);

    const imageResult = await generateImage(scene.image_prompt);

    if (imageResult.url) {
      const imgRes = await fetch(imageResult.url);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(outputImagePath, buffer);
    } else if (imageResult.b64) {
      const buffer = Buffer.from(imageResult.b64, 'base64');
      fs.writeFileSync(outputImagePath, buffer);
    }

    res.json({ success: true, path: `/projects/${slug}/images/${sceneId}.png` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Generate voice-over
app.post('/api/projects/:slug/generate-voice', async (req, res) => {
  try {
    const { slug } = req.params;
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) {
      return res.status(400).json({ error: 'Generate scene plan first' });
    }

    const folder = store.getProjectFolder(slug);
    const updatedScenes = await generateSceneVoiceOvers(folder, scenes);
    store.saveScenes(slug, updatedScenes);

    res.json({ success: true, path: `/projects/${slug}/voice.mp3` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Generate subtitles
app.post('/api/projects/:slug/generate-subtitles', (req, res) => {
  try {
    const { slug } = req.params;
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) {
      return res.status(400).json({ error: 'Generate scene plan first' });
    }

    const folder = store.getProjectFolder(slug);
    const srtContent = generateSRT(scenes);
    fs.writeFileSync(path.join(folder, 'subtitles.srt'), srtContent, 'utf8');

    res.json({ success: true, path: `/projects/${slug}/subtitles.srt` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Upload music
app.post('/api/projects/:slug/upload-music', upload.single('music'), (req, res) => {
  try {
    const { slug } = req.params;
    res.json({ success: true, path: `/projects/${slug}/music.mp3` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Upload image
app.post('/api/projects/:slug/scenes/:sceneId/upload-image', upload.single('image'), (req, res) => {
  try {
    const { slug, sceneId } = req.params;
    res.json({ success: true, path: `/projects/${slug}/images/${sceneId}${path.extname(req.file.originalname)}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Render final video
app.post('/api/projects/:slug/render', async (req, res) => {
  try {
    const { slug } = req.params;
    const scenes = store.getScenes(slug);
    if (!scenes || scenes.length === 0) {
      return res.status(400).json({ error: 'Generate scene plan first' });
    }

    const folder = store.getProjectFolder(slug);
    const volume = Number(process.env.MUSIC_VOLUME) || 0.12;

    const finalPath = await renderVideo(folder, scenes, volume);
    res.json({ success: true, path: `/projects/${slug}/output/final_video.mp4` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Export project data
app.get('/api/projects/:slug/export', (req, res) => {
  try {
    const { slug } = req.params;
    const folder = store.getProjectFolder(slug);
    const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'metadata.json'), 'utf8'));
    const script = store.getScript(slug);
    const scenes = store.getScenes(slug);

    res.json({ metadata, script, scenes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`YouTube Faceless History pipeline running at http://localhost:${PORT}`);
});
