const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getProjectFolder(slug) {
  const folder = path.join(PROJECTS_DIR, slug);
  ensureDir(folder);
  ensureDir(path.join(folder, 'images'));
  ensureDir(path.join(folder, 'videos'));
  ensureDir(path.join(folder, 'output'));
  ensureDir(path.join(folder, 'temp'));
  return folder;
}

function listProjects() {
  ensureDir(PROJECTS_DIR);
  return fs.readdirSync(PROJECTS_DIR).filter(name => fs.statSync(path.join(PROJECTS_DIR, name)).isDirectory()).map(slug => {
    const file = path.join(PROJECTS_DIR, slug, 'metadata.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { slug, title: slug };
  });
}

function saveMetadata(slug, metadata) {
  const folder = getProjectFolder(slug);
  fs.writeFileSync(path.join(folder, 'metadata.json'), JSON.stringify(metadata, null, 2));
}

function saveScript(slug, scriptText) {
  fs.writeFileSync(path.join(getProjectFolder(slug), 'script.txt'), scriptText || '', 'utf8');
}

function getScript(slug) {
  const file = path.join(getProjectFolder(slug), 'script.txt');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function saveScenes(slug, scenes) {
  fs.writeFileSync(path.join(getProjectFolder(slug), 'scenes.json'), JSON.stringify(scenes || [], null, 2));
}

function getScenes(slug) {
  const file = path.join(getProjectFolder(slug), 'scenes.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

function deleteProject(slug) {
  const folder = path.join(PROJECTS_DIR, slug);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
    return true;
  }
  return false;
}

module.exports = { PROJECTS_DIR, getProjectFolder, listProjects, saveMetadata, saveScript, getScript, saveScenes, getScenes, deleteProject };
