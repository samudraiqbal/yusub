const assert = require('assert');
const { createJobManager } = require('./src/jobManager');

const jobs = createJobManager({ now: () => '2026-06-11T00:00:00.000Z' });
const job = jobs.create('generate-voice', 'Generating voice-over');

assert.ok(job.id.startsWith('job_'), 'job id should use job_ prefix');
assert.strictEqual(job.type, 'generate-voice');
assert.strictEqual(job.status, 'running');
assert.strictEqual(job.message, 'Generating voice-over');
assert.strictEqual(job.current, 0);
assert.strictEqual(job.total, 0);

jobs.update(job.id, { message: 'Generating voice for scene 1 / 2', current: 1, total: 2 });
let updated = jobs.get(job.id);
assert.strictEqual(updated.message, 'Generating voice for scene 1 / 2');
assert.strictEqual(updated.current, 1);
assert.strictEqual(updated.total, 2);

jobs.succeed(job.id, { path: '/projects/demo/voice.mp3' }, 'Voice-over generated');
updated = jobs.get(job.id);
assert.strictEqual(updated.status, 'success');
assert.deepStrictEqual(updated.result, { path: '/projects/demo/voice.mp3' });
assert.strictEqual(updated.error, null);

const failed = jobs.create('render', 'Rendering');
jobs.fail(failed.id, new Error('ffmpeg failed'));
updated = jobs.get(failed.id);
assert.strictEqual(updated.status, 'failed');
assert.strictEqual(updated.error, 'ffmpeg failed');

assert.strictEqual(jobs.get('missing'), null);

console.log('job manager tests passed');
