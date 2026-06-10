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

async function getAudioDuration(filePath) {
  const stdout = await execFilePromise('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return Number.parseFloat(stdout.trim());
}

async function generateVoiceOver(text, outputPath, voice = process.env.TTS_VOICE || 'en-US-GuyNeural') {
  const textPath = path.join(path.dirname(outputPath), 'tts_text.txt');
  fs.writeFileSync(textPath, text, 'utf8');
  try {
    await execFilePromise('python', ['-m', 'edge_tts', '--voice', voice, '--file', textPath, '--write-media', outputPath]);
    return outputPath;
  } finally {
    try { fs.unlinkSync(textPath); } catch (_) {}
  }
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

async function generateSceneVoiceOvers(projectFolder, scenes, voice = process.env.TTS_VOICE || 'en-US-GuyNeural') {
  const voiceDir = path.join(projectFolder, 'voice');
  fs.mkdirSync(voiceDir, { recursive: true });

  const audioFiles = [];
  const updatedScenes = [];

  for (const scene of scenes) {
    const audioPath = path.join(voiceDir, `${scene.scene_id}.mp3`);
    const narration = scene.narration_text || scene.subtitle_text || '';
    await generateVoiceOver(narration, audioPath, voice);
    const duration = await getAudioDuration(audioPath);
    audioFiles.push(audioPath);
    updatedScenes.push({
      ...scene,
      duration_seconds: Math.max(1, Number(duration.toFixed(2)))
    });
  }

  await concatAudio(audioFiles, path.join(projectFolder, 'voice.mp3'));
  return updatedScenes;
}

module.exports = { generateVoiceOver, generateSceneVoiceOvers, getAudioDuration };
