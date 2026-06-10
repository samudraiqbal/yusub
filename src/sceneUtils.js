const { generateText } = require('./ai9router');

const VIDEO_KEYWORDS = [
  'battle', 'war', 'army', 'march', 'soldier', 'fire', 'smoke', 'explode',
  'ocean', 'storm', 'sea', 'collapse', 'assassinate', 'panic', 'riot', 'crowd',
  'reveal', 'map', 'mystery', 'fog', 'supernatural', 'ghost'
];

function shouldGenerateVideo(narrationText, prompt) {
  const combined = `${narrationText} ${prompt}`.toLowerCase();
  return VIDEO_KEYWORDS.some(k => combined.includes(k));
}

function formatPrompt(prompt) {
  const style = 'cinematic historical documentary, realistic, dramatic lighting, high detail, 16:9, no text, no watermark';
  if (!prompt) return style;
  return prompt.toLowerCase().includes('cinematic') ? prompt : `${prompt}, ${style}`;
}

const EFFECTS = ['slow zoom in', 'slow zoom out', 'pan left', 'pan right', 'fade in', 'fade out'];

function getDynamicEffect(scene, index) {
  // If AI provided a valid effect, use it
  if (scene.visual_effect && EFFECTS.includes(scene.visual_effect.toLowerCase())) {
    return scene.visual_effect.toLowerCase();
  }
  // Otherwise, alternate dynamically based on index to ensure variety
  return EFFECTS[index % EFFECTS.length];
}

function normalizeSceneVideoFlag(scene) {
  const videoPrompt = String(scene.image_to_video_prompt || '').trim();
  return {
    ...scene,
    image_to_video_prompt: videoPrompt,
    should_generate_video: Boolean(videoPrompt && scene.should_generate_video)
  };
}

async function parseGeneratedScenes(slug, scriptText) {
  const system = `You are scene planner for YouTube history videos. Generate scene plan from script.
You MUST output ONLY a raw JSON array:
[
  {
    "scene_id": "scene_001",
    "narration_text": "Narration text here...",
    "subtitle_text": "Shortened subtitle text...",
    "image_prompt": "Descriptive image prompt...",
    "duration_seconds": 8,
    "visual_effect": "Choose dynamically from: slow zoom in, slow zoom out, pan left, pan right, fade in, fade out",
    "camera_motion": "slow push in",
    "transition": "cross dissolve",
    "should_generate_video": false,
    "image_to_video_prompt": "Image-to-video prompt...",
    "reason_why_video_needed": "Why video is needed..."
  }
]
No other text outside JSON array. Alternate visual_effect based on the scene context (e.g. use zoom in for dramatic reveals, zoom out for wide landscapes, pan left/right for action or panning shots).`;

  const raw = await generateText(scriptText, system);
  const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!match) throw new Error('Model response did not contain JSON array');
  const list = JSON.parse(match[0]);

  const validEffects = list.map(scene => (scene.visual_effect || '').toLowerCase()).filter(effect => EFFECTS.includes(effect));
  const uniqueEffectCount = new Set(validEffects).size;
  const forceVariety = uniqueEffectCount <= 1;

  return list.map((scene, i) => {
    const formatted = formatPrompt(scene.image_prompt);
    const video = scene.should_generate_video || shouldGenerateVideo(scene.narration_text || '', scene.image_prompt || '');
    const effect = forceVariety ? EFFECTS[i % EFFECTS.length] : getDynamicEffect(scene, i);
    return normalizeSceneVideoFlag({
      ...scene,
      scene_id: scene.scene_id || `scene_${String(i + 1).padStart(3, '0')}`,
      image_prompt: formatted,
      should_generate_video: video,
      visual_effect: effect,
      camera_motion: effect
    });
  });
}


module.exports = { shouldGenerateVideo, formatPrompt, parseGeneratedScenes, normalizeSceneVideoFlag };
