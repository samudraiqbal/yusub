const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function execFilePromise(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
}

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

async function getAudioDuration(filePath) {
  const stdout = await execFilePromise('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return Number.parseFloat(stdout.trim());
}

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

async function generateVoicePreview(text, outputPath, options = {}) {
  await generateVoiceOver(text, outputPath, options);
  return outputPath;
}

async function concatAudio(files, outputPath) {
  const listPath = path.join(path.dirname(outputPath), 'voice_concat.txt');
  fs.writeFileSync(listPath, files.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
  try {
    await execFilePromise('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath]);
  } finally {
    try { fs.unlinkSync(listPath); } catch (_) {}
  }
}

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

module.exports = { generateVoiceOver, generateSceneVoiceOvers, generateVoicePreview, getAudioDuration, buildEdgeTtsArgs, normalizeVoiceOptions };
