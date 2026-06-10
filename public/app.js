let currentProject = null;
let voicePresets = [];
let activeJobs = new Map();
let selectedVoicePresetId = 'dark-documentary';

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadVoicePresets();
  await loadProjects();
});

function setupEventListeners() {
  document.getElementById('project-list').addEventListener('change', (e) => {
    const slug = e.target.value;
    if (slug) loadProjectDetails(slug);
    else closeProject();
  });

  document.getElementById('btn-new-project').addEventListener('click', () => {
    document.getElementById('new-project-form').classList.remove('hidden');
    document.getElementById('workspace-placeholder').classList.remove('hidden');
    document.getElementById('workspace-active').classList.add('hidden');
  });

  document.getElementById('btn-create-project').addEventListener('click', createProject);
  document.getElementById('btn-delete-project').addEventListener('click', deleteCurrentProject);
  document.getElementById('btn-generate-script').addEventListener('click', generateScript);
  document.getElementById('btn-save-script').addEventListener('click', saveScript);
  document.getElementById('btn-generate-scenes').addEventListener('click', generateScenes);
  document.getElementById('btn-save-scenes').addEventListener('click', saveScenes);
  document.getElementById('btn-preview-voice').addEventListener('click', previewVoice);
  document.getElementById('btn-gen-voice').addEventListener('click', generateVoice);
  document.getElementById('btn-gen-subs').addEventListener('click', generateSubtitles);
  document.getElementById('btn-render-video').addEventListener('click', renderVideo);
  document.getElementById('btn-export-json').addEventListener('click', exportProjectJson);
  document.getElementById('voice-preset-list').addEventListener('change', (e) => {
    selectedVoicePresetId = e.target.value;
    updateVoicePresetDescription();
  });

  const musicFile = document.getElementById('music-file');
  document.getElementById('btn-upload-music').addEventListener('click', () => musicFile.click());
  musicFile.addEventListener('change', uploadMusic);
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('status-toast');
  toast.innerText = message;
  toast.className = `toast toast-${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 6000);
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function setButtonBusy(id, busy) {
  if (!id) return;
  const button = document.getElementById(id);
  if (button) button.disabled = busy;
}

function jobLabel(type) {
  return {
    'generate-script': 'Generate Script',
    'generate-scenes': 'Generate Scene Plan',
    'generate-image': 'Generate Image',
    'generate-voice': 'Generate Voice-Over',
    'generate-subtitles': 'Generate SRT',
    render: 'FFmpeg Render'
  }[type] || type;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderProgressPanel() {
  const list = document.getElementById('progress-list');
  const jobs = Array.from(activeJobs.values()).slice(-8).reverse();
  if (jobs.length === 0) {
    list.innerHTML = '<div class="progress-empty">No active jobs</div>';
    return;
  }
  list.innerHTML = jobs.map(job => {
    const percent = job.total ? Math.round((job.current / job.total) * 100) : (job.status === 'success' ? 100 : 0);
    return `
      <div class="progress-job progress-${job.status}">
        <div class="progress-job-header">
          <span>${escapeHtml(jobLabel(job.type))}</span>
          <span class="progress-job-status">${escapeHtml(job.status)}</span>
        </div>
        <div class="progress-job-message">${escapeHtml(job.message)}</div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
        <div class="progress-job-time">Updated: ${new Date(job.updated_at).toLocaleTimeString()}</div>
        ${job.error ? `<div class="progress-job-error">${escapeHtml(job.error)}</div>` : ''}
      </div>`;
  }).join('');
}

async function startJob(request, buttonId, onSuccess) {
  setButtonBusy(buttonId, true);
  try {
    const start = await request();
    if (!start.jobId) throw new Error('Server did not return jobId');
    pollJob(start.jobId, buttonId, onSuccess);
  } catch (error) {
    showToast(error.message, 'error');
    setButtonBusy(buttonId, false);
  }
}

function pollJob(jobId, buttonId, onSuccess) {
  const timer = setInterval(async () => {
    try {
      const job = await apiJson(`/api/jobs/${jobId}`);
      activeJobs.set(jobId, job);
      renderProgressPanel();
      if (job.status === 'success') {
        clearInterval(timer);
        setButtonBusy(buttonId, false);
        showToast(job.message || 'Job complete');
        if (onSuccess) await onSuccess(job);
      } else if (job.status === 'failed') {
        clearInterval(timer);
        setButtonBusy(buttonId, false);
        showToast(job.error || job.message || 'Job failed', 'error');
      }
    } catch (error) {
      clearInterval(timer);
      setButtonBusy(buttonId, false);
      showToast(error.message, 'error');
    }
  }, 1000);
}

async function loadVoicePresets() {
  try {
    voicePresets = await apiJson('/api/voice-presets');
    const select = document.getElementById('voice-preset-list');
    select.innerHTML = '';
    voicePresets.forEach(preset => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      select.appendChild(option);
    });
    selectedVoicePresetId = voicePresets[0]?.id || 'dark-documentary';
    select.value = selectedVoicePresetId;
    updateVoicePresetDescription();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function getSelectedVoicePreset() {
  return voicePresets.find(preset => preset.id === selectedVoicePresetId) || voicePresets[0];
}

function updateVoicePresetDescription() {
  const preset = getSelectedVoicePreset();
  document.getElementById('voice-preset-description').textContent = preset ? preset.description : '';
}

async function previewVoice() {
  setButtonBusy('btn-preview-voice', true);
  try {
    const data = await apiJson('/api/voice-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: selectedVoicePresetId })
    });
    const player = document.getElementById('voice-preview-player');
    player.src = `${data.path}?t=${Date.now()}`;
    player.classList.remove('hidden');
    showToast('Voice preview ready');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonBusy('btn-preview-voice', false);
  }
}

async function loadProjects() {
  try {
    const projects = await apiJson('/api/projects');
    const select = document.getElementById('project-list');
    select.innerHTML = '<option value="">-- Choose or Create --</option>';
    projects.forEach(p => { select.innerHTML += `<option value="${p.slug}">${p.title}</option>`; });
    if (currentProject) select.value = currentProject.metadata.slug;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function createProject() {
  const title = document.getElementById('p-title').value;
  if (!title) return showToast('Please provide a title', 'error');
  try {
    const metadata = await apiJson('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        target_duration_minutes: document.getElementById('p-duration').value,
        style: document.getElementById('p-style').value,
        tone: document.getElementById('p-tone').value
      })
    });
    showToast(`Project "${metadata.title}" created!`);
    document.getElementById('new-project-form').classList.add('hidden');
    await loadProjects();
    document.getElementById('project-list').value = metadata.slug;
    loadProjectDetails(metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadProjectDetails(slug) {
  try {
    const data = await apiJson(`/api/projects/${slug}`);
    currentProject = data;
    document.getElementById('script-editor').value = data.script || '';
    renderScenesTable(data.scenes, data.assets);
    updateBadge('status-voice', data.assets.voice);
    updateBadge('status-music', data.assets.music);
    updateBadge('status-subtitles', data.assets.subtitles);
    updateBadge('status-video', data.assets.video);
    document.getElementById('video-preview-container').innerHTML = data.assets.video
      ? `<video controls><source src="/projects/${slug}/output/final_video.mp4?t=${Date.now()}" type="video/mp4">Your browser does not support the video tag.</video>`
      : '<p class="placeholder-text">Video not rendered yet</p>';
    document.getElementById('workspace-placeholder').classList.add('hidden');
    document.getElementById('workspace-active').classList.remove('hidden');
    document.getElementById('project-status').classList.remove('hidden');
    document.getElementById('btn-delete-project').classList.remove('hidden');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function updateBadge(id, present) {
  const badge = document.getElementById(id);
  badge.innerText = present ? 'Ready' : 'Missing';
  badge.className = present ? 'badge badge-success' : 'badge badge-error';
}

function closeProject() {
  currentProject = null;
  document.getElementById('workspace-placeholder').classList.remove('hidden');
  document.getElementById('workspace-active').classList.add('hidden');
  document.getElementById('project-status').classList.add('hidden');
  document.getElementById('btn-delete-project').classList.add('hidden');
}

async function deleteCurrentProject() {
  if (!currentProject) return;
  const slug = currentProject.metadata.slug;
  if (!confirm(`Are you sure you want to delete project "${currentProject.metadata.title}"? This will delete all scripts, scenes, and generated assets.`)) return;
  try {
    await apiJson(`/api/projects/${slug}`, { method: 'DELETE' });
    showToast('Project deleted successfully.');
    closeProject();
    await loadProjects();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderScenesTable(scenes, assets) {
  const tbody = document.getElementById('scenes-list');
  tbody.innerHTML = '';
  if (!scenes || scenes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No scenes generated yet. Click "Generate Scene Plan" to start.</td></tr>';
    return;
  }
  scenes.forEach(scene => {
    const asset = assets.scenes.find(a => a.scene_id === scene.scene_id) || { hasImage: false, hasVideo: false };
    const videoPrompt = (scene.image_to_video_prompt || '').trim();
    const shouldGenerateVideo = Boolean(videoPrompt && scene.should_generate_video);
    let previewHtml = '<div class="scene-preview-empty">No Image</div>';
    if (asset.hasVideo) previewHtml = `<video src="/projects/${currentProject.metadata.slug}/videos/${scene.scene_id}.mp4" class="scene-preview-img" muted playsinline onclick="this.play()"></video>`;
    else if (asset.hasImage) previewHtml = `<img src="/projects/${currentProject.metadata.slug}/images/${scene.scene_id}.png" class="scene-preview-img" alt="Scene Asset">`;
    const row = document.createElement('tr');
    row.dataset.sceneId = scene.scene_id;
    row.innerHTML = `
      <td><strong>${scene.scene_id}</strong></td>
      <td><div class="form-group"><label>Narration Text:</label><textarea class="scene-narration">${scene.narration_text || ''}</textarea></div><div class="form-group"><label>Subtitle / Caption:</label><input type="text" class="scene-subtitle" value="${scene.subtitle_text || ''}"></div></td>
      <td><textarea class="scene-prompt">${scene.image_prompt || ''}</textarea><button class="btn btn-secondary btn-block btn-gen-img" onclick="generateSceneImage('${scene.scene_id}')" style="margin-top: 0.5rem; font-size: 0.75rem; padding: 0.25rem;">Generate Image</button></td>
      <td><div class="form-group"><label>Duration (Seconds):</label><input type="number" class="scene-duration" value="${scene.duration_seconds || 5}" min="1" max="60" style="width: 70px;"></div><div class="form-group"><label>Visual Effect:</label><select class="scene-effect"><option value="slow zoom in" ${scene.visual_effect === 'slow zoom in' ? 'selected' : ''}>Zoom In</option><option value="slow zoom out" ${scene.visual_effect === 'slow zoom out' ? 'selected' : ''}>Zoom Out</option><option value="pan left" ${scene.visual_effect === 'pan left' ? 'selected' : ''}>Pan Left</option><option value="pan right" ${scene.visual_effect === 'pan right' ? 'selected' : ''}>Pan Right</option><option value="parallax effect" ${scene.visual_effect === 'parallax effect' ? 'selected' : ''}>Parallax</option><option value="slight camera shake" ${scene.visual_effect === 'slight camera shake' ? 'selected' : ''}>Shake</option><option value="fade in" ${scene.visual_effect === 'fade in' ? 'selected' : ''}>Fade In</option><option value="fade out" ${scene.visual_effect === 'fade out' ? 'selected' : ''}>Fade Out</option></select></div></td>
      <td><input type="checkbox" class="scene-should-video" ${shouldGenerateVideo ? 'checked' : ''}><div class="form-group" style="margin-top: 0.5rem;"><textarea class="scene-video-prompt" placeholder="Video prompt..." style="font-size: 0.7rem; height: 40px;">${videoPrompt}</textarea></div></td>
      <td><div class="asset-preview-box">${previewHtml}<input type="file" class="scene-img-file" accept="image/*" style="display: none;" onchange="uploadSceneImage('${scene.scene_id}', this)"><button class="btn btn-secondary" onclick="this.previousElementSibling.click()" style="margin-top: 0.5rem; font-size: 0.7rem; padding: 0.25rem; width: 100%;">Upload</button></div></td>`;
    tbody.appendChild(row);
  });
}

function getScenesTableData() {
  return Array.from(document.querySelectorAll('#scenes-list tr')).map(row => {
    const scene_id = row.dataset.sceneId;
    if (!scene_id) return null;
    const videoPrompt = row.querySelector('.scene-video-prompt').value.trim();
    return {
      scene_id,
      narration_text: row.querySelector('.scene-narration').value,
      subtitle_text: row.querySelector('.scene-subtitle').value,
      image_prompt: row.querySelector('.scene-prompt').value,
      duration_seconds: Number(row.querySelector('.scene-duration').value),
      visual_effect: row.querySelector('.scene-effect').value,
      should_generate_video: Boolean(videoPrompt && row.querySelector('.scene-should-video').checked),
      image_to_video_prompt: videoPrompt,
      camera_motion: row.querySelector('.scene-effect').value,
      transition: 'cross dissolve'
    };
  }).filter(Boolean);
}

async function generateScript() {
  if (!currentProject) return;
  await startJob(() => apiJson(`/api/projects/${currentProject.metadata.slug}/generate-script`, { method: 'POST' }), 'btn-generate-script', async job => {
    if (job.result?.script) document.getElementById('script-editor').value = job.result.script;
    await loadProjectDetails(currentProject.metadata.slug);
  });
}

async function saveScript() {
  if (!currentProject) return;
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/save-script`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: document.getElementById('script-editor').value }) });
    showToast('Script saved!');
  } catch (error) { showToast(error.message, 'error'); }
}

async function generateScenes() {
  if (!currentProject) return;
  await startJob(() => apiJson(`/api/projects/${currentProject.metadata.slug}/generate-scenes`, { method: 'POST' }), 'btn-generate-scenes', () => loadProjectDetails(currentProject.metadata.slug));
}

async function saveScenes() {
  if (!currentProject) return;
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/save-scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenes: getScenesTableData() }) });
    showToast('Scene plan saved!');
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) { showToast(error.message, 'error'); }
}

async function generateSceneImage(sceneId) {
  if (!currentProject) return;
  await startJob(() => apiJson(`/api/projects/${currentProject.metadata.slug}/scenes/${sceneId}/generate-image`, { method: 'POST' }), null, () => loadProjectDetails(currentProject.metadata.slug));
}

async function generateVoice() {
  if (!currentProject) return;
  await startJob(() => apiJson(`/api/projects/${currentProject.metadata.slug}/generate-voice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presetId: selectedVoicePresetId }) }), 'btn-gen-voice', () => loadProjectDetails(currentProject.metadata.slug));
}

async function generateSubtitles() {
  if (!currentProject) return;
  await startJob(() => apiJson(`/api/projects/${currentProject.metadata.slug}/generate-subtitles`, { method: 'POST' }), 'btn-gen-subs', () => loadProjectDetails(currentProject.metadata.slug));
}

async function uploadMusic(e) {
  if (!currentProject) return;
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('music', file);
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/upload-music`, { method: 'POST', body: formData });
    showToast('Background music uploaded!');
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) { showToast(error.message, 'error'); }
}

async function uploadSceneImage(sceneId, input) {
  if (!currentProject) return;
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/scenes/${sceneId}/upload-image`, { method: 'POST', body: formData });
    showToast(`Image for ${sceneId} uploaded!`);
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) { showToast(error.message, 'error'); }
}

async function renderVideo() {
  if (!currentProject) return;
  await startJob(() => apiJson(`/api/projects/${currentProject.metadata.slug}/render`, { method: 'POST' }), 'btn-render-video', () => loadProjectDetails(currentProject.metadata.slug));
}

function exportProjectJson() {
  if (!currentProject) return;
  window.open(`/api/projects/${currentProject.metadata.slug}/export`, '_blank');
}
