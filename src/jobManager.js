function createJobManager(options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const jobs = new Map();
  let nextId = 1;

  function stamp(job) {
    job.updated_at = now();
    return job;
  }

  function create(type, message = 'Starting...') {
    const id = `job_${Date.now()}_${nextId++}`;
    const time = now();
    const job = {
      id,
      type,
      status: 'running',
      message,
      current: 0,
      total: 0,
      result: null,
      error: null,
      created_at: time,
      updated_at: time
    };
    jobs.set(id, job);
    return { ...job };
  }

  function get(id) {
    const job = jobs.get(id);
    return job ? { ...job } : null;
  }

  function update(id, patch = {}) {
    const job = jobs.get(id);
    if (!job) return null;
    Object.assign(job, patch);
    stamp(job);
    return { ...job };
  }

  function succeed(id, result = null, message = 'Done') {
    return update(id, { status: 'success', message, result, error: null });
  }

  function fail(id, error) {
    const message = error && error.message ? error.message : String(error || 'Unknown error');
    return update(id, { status: 'failed', message, error: message });
  }

  function prune(maxAgeMs = 30 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, job] of jobs.entries()) {
      if (job.status !== 'running') {
        const updated = Date.parse(job.updated_at);
        if (!Number.isNaN(updated) && updated < cutoff) jobs.delete(id);
      }
    }
  }

  return { create, get, update, succeed, fail, prune };
}

module.exports = { createJobManager };
