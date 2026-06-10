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
