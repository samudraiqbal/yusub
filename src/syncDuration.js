const fs = require('fs');
const path = require('path');
const store = require('./projectStore');
const { generateSceneVoiceOvers } = require('./tts');
const { generateSRT } = require('./subtitles');

async function syncProjectDuration(slug) {
  const folder = store.getProjectFolder(slug);
  const scenes = store.getScenes(slug);
  if (!scenes || scenes.length === 0) {
    throw new Error('Scene plan is empty.');
  }

  console.log(`Syncing durations for project: ${slug}`);

  // 1. Generate per-scene voice overs & get accurate durations
  const updatedScenes = await generateSceneVoiceOvers(folder, scenes);

  // Set subtitles to match narration text exactly as requested
  const matchedScenes = updatedScenes.map(scene => ({
    ...scene,
    subtitle_text: scene.narration_text
  }));

  // 2. Save back to scenes.json
  store.saveScenes(slug, matchedScenes);
  console.log(`Updated scenes.json with accurate durations and subtitle matching.`);

  // 3. Re-generate subtitles.srt
  const srtContent = generateSRT(matchedScenes);
  fs.writeFileSync(path.join(folder, 'subtitles.srt'), srtContent, 'utf8');
  console.log(`Updated subtitles.srt.`);

  return matchedScenes;
}

// Support CLI run: node src/syncDuration.js <slug>
if (require.main === module) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Please specify project slug.');
    process.exit(1);
  }
  syncProjectDuration(slug)
    .then(() => console.log('Sync completed.'))
    .catch(err => console.error('Sync failed:', err));
}

module.exports = { syncProjectDuration };
