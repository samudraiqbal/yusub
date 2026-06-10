function formatSRTTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function splitSubtitleText(text, maxChars = 72) {
  const source = (text || '').trim();
  if (!source) return [''];
  const sentenceParts = source.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  for (const sentence of sentenceParts.length ? sentenceParts : [source]) {
    if (sentence.length <= maxChars) {
      chunks.push(sentence);
      continue;
    }
    const words = sentence.split(/\s+/);
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        if (current) chunks.push(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) chunks.push(current.trim());
  }
  return chunks.length ? chunks : [source];
}

function generateSRT(scenes) {
  let current = 0;
  let index = 1;
  const blocks = [];

  for (const scene of scenes) {
    const duration = Number(scene.duration_seconds || 5);
    const chunks = splitSubtitleText(scene.subtitle_text || scene.narration_text);
    const chunkDuration = duration / chunks.length;

    chunks.forEach((chunk, chunkIndex) => {
      const start = current + (chunkIndex * chunkDuration);
      const end = chunkIndex === chunks.length - 1 ? current + duration : current + ((chunkIndex + 1) * chunkDuration);
      blocks.push(`${index}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${chunk}\n`);
      index += 1;
    });

    current += duration;
  }

  return blocks.join('\n');
}

module.exports = { formatSRTTime, generateSRT, splitSubtitleText };
