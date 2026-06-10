const assert = require('assert');
const { normalizeSceneVideoFlag } = require('./src/sceneUtils');

assert.strictEqual(
  normalizeSceneVideoFlag({ should_generate_video: true, image_to_video_prompt: '' }).should_generate_video,
  false,
  'empty video prompt should uncheck AI video'
);

assert.strictEqual(
  normalizeSceneVideoFlag({ should_generate_video: true, image_to_video_prompt: '   ' }).should_generate_video,
  false,
  'whitespace-only video prompt should uncheck AI video'
);

assert.strictEqual(
  normalizeSceneVideoFlag({ should_generate_video: true, image_to_video_prompt: 'slow camera movement through ruins' }).should_generate_video,
  true,
  'non-empty video prompt should keep AI video checked'
);

console.log('scene video flag tests passed');
