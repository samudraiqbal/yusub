const assert = require('assert');
const { buildImageFilter, createRenderProgressMessage } = require('./src/render');

const movingEffects = ['slow zoom in', 'slow zoom out', 'pan left', 'pan right'];

for (const effect of movingEffects) {
  const filter = buildImageFilter(effect, 8);

  assert(
    !filter.includes('crop=') || !/crop=[^,]*n\//.test(filter),
    `${effect} should not animate crop dimensions or crop position with n/frame expressions because FFmpeg crop rounds them and causes jitter`
  );

  assert(
    filter.includes('zoompan='),
    `${effect} should use zoompan for frame-stable Ken Burns movement`
  );

  assert(
    filter.includes('s=3840x2160'),
    `${effect} should render motion at 4K before downscaling so integer motion steps become sub-pixel at 1080p`
  );

  assert(
    filter.includes('scale=1920:1080'),
    `${effect} should downscale final output to 1080p after high-resolution motion`
  );

  assert(
    filter.includes('fps=60'),
    `${effect} should keep 60fps output`
  );
}

console.log('render filter stability tests passed');

assert.deepStrictEqual(
  createRenderProgressMessage(2, 5),
  { message: 'Rendering clip 2 / 5', current: 2, total: 5 }
);

console.log('render progress tests passed');
