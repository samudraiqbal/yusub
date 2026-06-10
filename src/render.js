const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

function run(command) {
  return new Promise((resolve, reject) => {
    command.on('end', resolve).on('error', reject).run();
  });
}

function createPlaceholderImage(outputPath) {
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  fs.writeFileSync(outputPath, Buffer.from(base64Png, 'base64'));
}

// Stable Ken Burns effects. Avoid animated crop dimensions/positions; crop rounds per frame and jitters.
function buildImageFilter(effect, duration) {
  const frames = Math.max(60, Math.round(duration * 60));
  const scaleInput = 'scale=5120:2880:force_original_aspect_ratio=increase,crop=5120:2880';
  const output = 'scale=1920:1080:flags=lanczos,fps=60,format=yuv420p';
  const progress = `on/${frames}`;

  if (effect === 'slow zoom out') {
    return `${scaleInput},zoompan=z='1.12-0.08*${progress}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=3840x2160:fps=60,${output}`;
  }

  if (effect === 'pan left') {
    return `${scaleInput},zoompan=z='1.08':x='(iw-iw/zoom)*(1-${progress})':y='ih/2-(ih/zoom/2)':d=${frames}:s=3840x2160:fps=60,${output}`;
  }

  if (effect === 'pan right') {
    return `${scaleInput},zoompan=z='1.08':x='(iw-iw/zoom)*${progress}':y='ih/2-(ih/zoom/2)':d=${frames}:s=3840x2160:fps=60,${output}`;
  }

  if (effect === 'fade in') {
    return `${scaleInput},zoompan=z='1.04+0.04*${progress}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=3840x2160:fps=60,fade=t=in:st=0:d=1,${output}`;
  }

  if (effect === 'fade out') {
    const fadeStart = Math.max(0, Number(duration) - 1);
    return `${scaleInput},zoompan=z='1.08-0.04*${progress}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=3840x2160:fps=60,fade=t=out:st=${fadeStart}:d=1,${output}`;
  }

  return `${scaleInput},zoompan=z='1+0.08*${progress}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=3840x2160:fps=60,${output}`;
}

async function createSceneClip(source, output, duration, effect, isVideo) {
  const command = ffmpeg(source);
  if (isVideo) {
    command.outputOptions([
      '-t', String(duration),
      '-r', '60',
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-crf', '18'
    ]);
  } else {
    command.loop(duration).outputOptions([
      '-t', String(duration),
      '-r', '60',
      '-vf', buildImageFilter(effect, duration),
      '-an',
      '-c:v', 'libx264',
      '-preset', 'superfast',
      '-crf', '18'
    ]);
  }
  command.output(output);
  return run(command);
}

async function concatClips(listPath, output) {
  return run(
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(output)
  );
}

async function mixAudioAndSubtitles(videoIn, voiceIn, musicIn, srtIn, videoOut, musicVolume) {
  const command = ffmpeg().input(videoIn).input(voiceIn);
  let filter = '[1:a]volume=1.0[a]';
  const options = [
    '-map', '0:v',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-preset', 'superfast',
    '-crf', '18',
    '-shortest'
  ];
  if (musicIn) {
    command.input(musicIn);
    filter = `[1:a]volume=1.0[v];[2:a]volume=${musicVolume}[m];[v][m]amix=inputs=2:duration=first[a]`;
  }
  if (fs.existsSync(srtIn)) {
    const escaped = srtIn.replace(/\\/g, '/').replace(/:/g, '\\:');
    options.push('-vf', `subtitles='${escaped}'`);
  }
  command.complexFilter(filter).outputOptions(options).output(videoOut);
  return run(command);
}

function createRenderProgressMessage(current, total) {
  return { message: `Rendering clip ${current} / ${total}`, current, total };
}

async function renderVideo(projectFolder, scenes, musicVolume = 0.12, onProgress = null) {
  const images = path.join(projectFolder, 'images');
  const videos = path.join(projectFolder, 'videos');
  const temp = path.join(projectFolder, 'temp');
  const output = path.join(projectFolder, 'output');
  fs.mkdirSync(temp, { recursive: true });
  fs.mkdirSync(output, { recursive: true });

  const voice = path.join(projectFolder, 'voice.mp3');
  const music = path.join(projectFolder, 'music.mp3');
  const srt = path.join(projectFolder, 'subtitles.srt');
  const finalPath = path.join(output, 'final_video.mp4');
  if (!fs.existsSync(voice)) throw new Error('Missing voice.mp3. Generate voice first.');

  const clips = [];
  for (const scene of scenes) {
    const sceneIndex = clips.length + 1;
    const clip = path.join(temp, `${scene.scene_id}.mp4`);
    const videoFile = path.join(videos, `${scene.scene_id}.mp4`);
    let source = videoFile;
    let isVideo = fs.existsSync(videoFile);
    if (!isVideo) {
      const png = path.join(images, `${scene.scene_id}.png`);
      const jpg = path.join(images, `${scene.scene_id}.jpg`);
      const jpeg = path.join(images, `${scene.scene_id}.jpeg`);
      source = fs.existsSync(png) ? png : fs.existsSync(jpg) ? jpg : jpeg;
      if (!fs.existsSync(source)) {
        source = path.join(temp, `${scene.scene_id}_placeholder.png`);
        createPlaceholderImage(source);
      }
    }
    if (onProgress) onProgress(createRenderProgressMessage(sceneIndex, scenes.length));
    await createSceneClip(source, clip, Number(scene.duration_seconds || 5), scene.visual_effect || 'slow zoom in', isVideo);
    clips.push(clip);
  }

  const listPath = path.join(temp, 'clips.txt');
  fs.writeFileSync(listPath, clips.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
  const concatPath = path.join(temp, 'concat.mp4');
  if (onProgress) onProgress({ message: 'Concatenating clips...', current: scenes.length, total: scenes.length });
  await concatClips(listPath, concatPath);
  if (onProgress) onProgress({ message: 'Mixing audio and subtitles...', current: scenes.length, total: scenes.length });
  await mixAudioAndSubtitles(concatPath, voice, fs.existsSync(music) ? music : null, srt, finalPath, musicVolume);
  return finalPath;
}

module.exports = { renderVideo, buildImageFilter, createRenderProgressMessage };
