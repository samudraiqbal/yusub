let currentProject = null;

document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('project-list').addEventListener('change', (e) => {
    const slug = e.target.value;
    if (slug) {
      loadProjectDetails(slug);
    } else {
      closeProject();
    }
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
  document.getElementById('btn-gen-voice').addEventListener('click', generateVoice);
  document.getElementById('btn-gen-subs').addEventListener('click', generateSubtitles);
  document.getElementById('btn-render-video').addEventListener('click', renderVideo);
  document.getElementById('btn-export-json').addEventListener('click', exportProjectJson);

  // Music upload helper
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
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

async function loadProjects() {
  try {
    const projects = await apiJson('/api/projects');
    const select = document.getElementById('project-list');
    select.innerHTML = '<option value="">-- Choose or Create --</option>';
    projects.forEach(p => {
      select.innerHTML += `<option value="${p.slug}">${p.title}</option>`;
    });
    if (currentProject) {
      select.value = currentProject.slug;
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function createProject() {
  const title = document.getElementById('p-title').value;
  const target_duration_minutes = document.getElementById('p-duration').value;
  const style = document.getElementById('p-style').value;
  const tone = document.getElementById('p-tone').value;

  if (!title) {
    showToast('Please provide a title', 'error');
    return;
  }

  try {
    const metadata = await apiJson('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, target_duration_minutes, style, tone })
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

    // Fill workspace
    document.getElementById('script-editor').value = data.script || '';
    renderScenesTable(data.scenes, data.assets);

    // Update status badges
    updateBadge('status-voice', data.assets.voice);
    updateBadge('status-music', data.assets.music);
    updateBadge('status-subtitles', data.assets.subtitles);
    updateBadge('status-video', data.assets.video);

    if (data.assets.video) {
      document.getElementById('video-preview-container').innerHTML = `
        <video controls>
          <source src="/projects/${slug}/output/final_video.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `;
    } else {
      document.getElementById('video-preview-container').innerHTML = `<p class="placeholder-text">Video not rendered yet</p>`;
    }

    // Toggle visibility
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
  if (present) {
    badge.innerText = 'Ready';
    badge.className = 'badge badge-success';
  } else {
    badge.innerText = 'Missing';
    badge.className = 'badge badge-error';
  }
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
  if (!confirm(`Are you sure you want to delete project "${currentProject.metadata.title}"? This will delete all scripts, scenes, and generated assets.`)) {
    return;
  }
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

    let previewHtml = '';
    if (asset.hasVideo) {
      previewHtml = `<video src="/projects/${currentProject.metadata.slug}/videos/${scene.scene_id}.mp4" class="scene-preview-img" muted playsinline onclick="this.play()"></video>`;
    } else if (asset.hasImage) {
      previewHtml = `<img src="/projects/${currentProject.metadata.slug}/images/${scene.scene_id}.png" class="scene-preview-img" alt="Scene Asset">`;
    } else {
      previewHtml = `<div class="scene-preview-empty">No Image</div>`;
    }

    const row = document.createElement('tr');
    row.dataset.sceneId = scene.scene_id;
    row.innerHTML = `
      <td><strong>${scene.scene_id}</strong></td>
      <td>
        <div class="form-group">
          <label>Narration Text:</label>
          <textarea class="scene-narration">${scene.narration_text || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Subtitle / Caption:</label>
          <input type="text" class="scene-subtitle" value="${scene.subtitle_text || ''}">
        </div>
      </td>
      <td>
        <textarea class="scene-prompt">${scene.image_prompt || ''}</textarea>
        <button class="btn btn-secondary btn-block btn-gen-img" onclick="generateSceneImage('${scene.scene_id}')" style="margin-top: 0.5rem; font-size: 0.75rem; padding: 0.25rem;">Generate Image</button>
      </td>
      <td>
        <div class="form-group">
          <label>Duration (Seconds):</label>
          <input type="number" class="scene-duration" value="${scene.duration_seconds || 5}" min="1" max="60" style="width: 70px;">
        </div>
        <div class="form-group">
          <label>Visual Effect:</label>
          <select class="scene-effect">
            <option value="slow zoom in" ${scene.visual_effect === 'slow zoom in' ? 'selected' : ''}>Zoom In</option>
            <option value="slow zoom out" ${scene.visual_effect === 'slow zoom out' ? 'selected' : ''}>Zoom Out</option>
            <option value="pan left" ${scene.visual_effect === 'pan left' ? 'selected' : ''}>Pan Left</option>
            <option value="pan right" ${scene.visual_effect === 'pan right' ? 'selected' : ''}>Pan Right</option>
            <option value="parallax effect" ${scene.visual_effect === 'parallax effect' ? 'selected' : ''}>Parallax</option>
            <option value="slight camera shake" ${scene.visual_effect === 'slight camera shake' ? 'selected' : ''}>Shake</option>
            <option value="fade in" ${scene.visual_effect === 'fade in' ? 'selected' : ''}>Fade In</option>
            <option value="fade out" ${scene.visual_effect === 'fade out' ? 'selected' : ''}>Fade Out</option>
          </select>
        </div>
      </td>
      <td>
        <input type="checkbox" class="scene-should-video" ${shouldGenerateVideo ? 'checked' : ''}>
        <div class="form-group" style="margin-top: 0.5rem;">
          <textarea class="scene-video-prompt" placeholder="Video prompt..." style="font-size: 0.7rem; height: 40px;">${videoPrompt}</textarea>
        </div>
      </td>
      <td>
        <div class="asset-preview-box">
          ${previewHtml}
          <input type="file" class="scene-img-file" accept="image/*" style="display: none;" onchange="uploadSceneImage('${scene.scene_id}', this)">
          <button class="btn btn-secondary" onclick="this.previousElementSibling.click()" style="margin-top: 0.5rem; font-size: 0.7rem; padding: 0.25rem; width: 100%;">Upload</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function getScenesTableData() {
  const rows = document.querySelectorAll('#scenes-list tr');
  const scenes = [];
  rows.forEach(row => {
    const scene_id = row.dataset.sceneId;
    if (!scene_id) return;
    const videoPrompt = row.querySelector('.scene-video-prompt').value.trim();
    scenes.push({
      scene_id,
      narration_text: row.querySelector('.scene-narration').value,
      subtitle_text: row.querySelector('.scene-subtitle').value,
      image_prompt: row.querySelector('.scene-prompt').value,
      duration_seconds: Number(row.querySelector('.scene-duration').value),
      visual_effect: row.querySelector('.scene-effect').value,
      should_generate_video: Boolean(videoPrompt && row.querySelector('.scene-should-video').checked),
      image_to_video_prompt: videoPrompt,
      camera_motion: row.querySelector('.scene-effect').value, // default maps to effect
      transition: 'cross dissolve'
    });
  });
  return scenes;
}

async function generateScript() {
  if (!currentProject) return;
  showToast('Generating English history script...', 'success');
  try {
    const data = await apiJson(`/api/projects/${currentProject.metadata.slug}/generate-script`, { method: 'POST' });
    document.getElementById('script-editor').value = data.script;
    showToast('Script generated!');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function saveScript() {
  if (!currentProject) return;
  const script = document.getElementById('script-editor').value;
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/save-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script })
    });
    showToast('Script saved!');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function generateScenes() {
  if (!currentProject) return;
  showToast('Creating detailed scene plan...', 'success');
  try {
    const data = await apiJson(`/api/projects/${currentProject.metadata.slug}/generate-scenes`, { method: 'POST' });
    await loadProjectDetails(currentProject.metadata.slug);
    showToast('Scenes plan generated!');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function saveScenes() {
  if (!currentProject) return;
  const scenes = getScenesTableData();
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/save-scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes })
    });
    showToast('Scene plan saved!');
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function generateSceneImage(sceneId) {
  if (!currentProject) return;
  showToast(`Generating AI image for ${sceneId}...`, 'success');
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/scenes/${sceneId}/generate-image`, { method: 'POST' });
    showToast(`Image for ${sceneId} generated!`);
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function generateVoice() {
  if (!currentProject) return;
  showToast('Generating Voice-Over using edge-tts...', 'success');
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/generate-voice`, { method: 'POST' });
    showToast('Voice-Over audio generated!');
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function generateSubtitles() {
  if (!currentProject) return;
  showToast('Generating SRT subtitles...', 'success');
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/generate-subtitles`, { method: 'POST' });
    showToast('SRT Subtitles generated!');
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function uploadMusic(e) {
  if (!currentProject) return;
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('music', file);

  showToast('Uploading background music...', 'success');
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/upload-music`, {
      method: 'POST',
      body: formData
    });
    showToast('Background music uploaded!');
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function uploadSceneImage(sceneId, input) {
  if (!currentProject) return;
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  showToast(`Uploading image for ${sceneId}...`, 'success');
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/scenes/${sceneId}/upload-image`, {
      method: 'POST',
      body: formData
    });
    showToast(`Image for ${sceneId} uploaded!`);
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function renderVideo() {
  if (!currentProject) return;
  showToast('Starting video render via FFmpeg. This could take a while...', 'success');
  try {
    await apiJson(`/api/projects/${currentProject.metadata.slug}/render`, { method: 'POST' });
    showToast('Video rendered successfully!');
    await loadProjectDetails(currentProject.metadata.slug);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function exportProjectJson() {
  if (!currentProject) return;
  window.open(`/api/projects/${currentProject.metadata.slug}/export`, '_blank');
}
