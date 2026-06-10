const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('public/app.js', 'utf8');

assert(
  app.includes('imageVersion'),
  'image previews should include an imageVersion cache buster after regeneration'
);

assert(
  app.includes('Regenerate Image'),
  'existing image assets should show Regenerate Image button text'
);

assert(
  app.includes('Image regenerated'),
  'regenerate success message should clearly say Image regenerated'
);

console.log('image regenerate UI tests passed');
