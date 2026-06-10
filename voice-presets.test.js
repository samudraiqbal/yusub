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
