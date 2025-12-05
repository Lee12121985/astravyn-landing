// ai/app.js
// Frontend for image + video generation. Calls backend endpoints /api/generate and /api/generate-video
import { requireAuth } from '../js/auth.js';

const API_BASE = 'http://localhost:3001';

// ---------- image UI ----------
const promptEl = document.getElementById('prompt');
const sizeEl = document.getElementById('size');
const countEl = document.getElementById('count');
const generateBtn = document.getElementById('generate');
const statusEl = document.getElementById('status');
const galleryEl = document.getElementById('gallery');

// ---------- video UI ----------
const vPromptEl = document.getElementById('v-prompt');
const vDurationEl = document.getElementById('v-duration');
const vCountEl = document.getElementById('v-count');
const genVideoBtn = document.getElementById('generate-video');
const vStatusEl = document.getElementById('v-status');
const videoGalleryEl = document.getElementById('video-gallery');

// ---------- library UI ----------
const libraryGalleryEl = document.getElementById('library-gallery');

let currentUser = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? 'crimson' : 'inherit';
}

function setVStatus(text, isError = false) {
  vStatusEl.textContent = text;
  vStatusEl.style.color = isError ? 'crimson' : 'inherit';
}

function setLoading(btn, isLoading, text) {
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = text || 'Generating...';
    btn.classList.add('loading');
  } else {
    btn.textContent = btn.dataset.originalText || 'Generate';
    btn.classList.remove('loading');
  }
}

async function generateImages() {
  if (!currentUser) return;

  // Example Check: Restrict to Premium or Admin if desired
  // if (!currentUser.isPremium && currentUser.role !== 'admin') {
  //   setStatus("Upgrade to Premium to generate images!", true);
  //   return;
  // }

  const prompt = promptEl.value.trim();
  if (!prompt) { setStatus('Please enter a prompt.', true); promptEl.focus(); return; }
  const size = sizeEl.value;
  const count = Number(countEl.value);

  setStatus('Requesting images...');
  setLoading(generateBtn, true, 'Generating...');

  try {
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': currentUser.uid
      },
      body: JSON.stringify({ prompt, size, count })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => null);
      throw new Error(body || `HTTP ${res.status}`);
    }
    const data = await res.json();
    showImages(data.images || []);
    setStatus(`Generated ${(data.images || []).length} image(s).`);
  } catch (err) {
    console.error(err);
    setStatus('Generation failed: ' + err.message, true);
  } finally {
    setLoading(generateBtn, false);
  }
}

async function generateVideos() {
  if (!currentUser) return;

  const prompt = vPromptEl.value.trim();
  if (!prompt) { setVStatus('Please enter a prompt.', true); vPromptEl.focus(); return; }
  const duration = vDurationEl.value ? Number(vDurationEl.value) : undefined;
  const count = Number(vCountEl.value || 1);

  setVStatus('Requesting video generation...');
  setLoading(genVideoBtn, true, 'Generating Video...');

  try {
    const res = await fetch(`${API_BASE}/api/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': currentUser.uid
      },
      body: JSON.stringify({ prompt, duration, count })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => null);
      throw new Error(body || `HTTP ${res.status}`);
    }
    const data = await res.json();
    showVideos(data.videos || []);
    setVStatus(`Generated ${(data.videos || []).length} video(s).`);
  } catch (err) {
    console.error(err);
    setVStatus('Video generation failed: ' + err.message, true);
  } finally {
    setLoading(genVideoBtn, false);
  }
}

function showImages(images) {
  galleryEl.innerHTML = '';
  if (!images.length) { galleryEl.innerHTML = '<div class="muted">No images returned.</div>'; return; }

  images.forEach((src, idx) => {
    const card = createCard(src, `Image ${idx + 1}`, false);
    galleryEl.appendChild(card);
  });
}

function showVideos(videos) {
  videoGalleryEl.innerHTML = '';
  if (!videos.length) { videoGalleryEl.innerHTML = '<div class="muted">No videos returned.</div>'; return; }

  videos.forEach((src, idx) => {
    const card = createCard(src, `Video ${idx + 1}`, true);
    videoGalleryEl.appendChild(card);
  });
}

async function loadLibrary() {
  try {
    // Pass user ID if backend supports filtering by user
    const headers = currentUser ? { 'X-User-ID': currentUser.uid } : {};
    const res = await fetch(`${API_BASE}/api/library`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    showLibrary(data.files || []);
  } catch (err) {
    console.error('Failed to load library:', err);
    libraryGalleryEl.innerHTML = '<div class="muted">Failed to load library. Ensure backend is running.</div>';
  }
}

function showLibrary(files) {
  libraryGalleryEl.innerHTML = '';
  if (!files.length) { libraryGalleryEl.innerHTML = '<div class="muted">No files in library.</div>'; return; }

  files.forEach((src, idx) => {
    const isVideo = src.toLowerCase().endsWith('.mp4');
    const card = createCard(src, `Item ${idx + 1}`, isVideo);
    libraryGalleryEl.appendChild(card);
  });
}

function createCard(src, altText, isVideo) {
  const container = document.createElement('div');
  container.className = 'media-card';

  const preview = document.createElement('div');
  preview.className = 'media-preview';

  if (isVideo) {
    const vid = document.createElement('video');
    vid.controls = true;
    vid.src = src;
    vid.preload = 'metadata';
    preview.appendChild(vid);
  } else {
    const img = document.createElement('img');
    img.alt = altText;
    img.src = src;
    preview.appendChild(img);
  }

  const actions = document.createElement('div');
  actions.className = 'media-actions';

  const dl = document.createElement('button');
  dl.className = 'small-btn';
  dl.textContent = 'Download';
  dl.onclick = () => downloadFile(src, src.split('/').pop());

  const open = document.createElement('button');
  open.className = 'small-btn';
  open.textContent = 'Open';
  open.onclick = () => window.open(src, '_blank');

  actions.appendChild(dl);
  actions.appendChild(open);

  container.appendChild(preview);
  container.appendChild(actions);

  return container;
}

function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Initialize Auth
requireAuth('../login/index.html')
  .then(user => {
    console.log('User authenticated:', user.email);
    currentUser = user;

    // Attach events only after auth logic matches
    generateBtn.addEventListener('click', () => { generateImages().then(loadLibrary); });
    genVideoBtn.addEventListener('click', () => { generateVideos().then(loadLibrary); });

    promptEl.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { generateImages().then(loadLibrary); }
    });
    vPromptEl.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { generateVideos().then(loadLibrary); }
    });

    // Initial Load
    loadLibrary();
  })
  .catch(err => {
    console.log("Auth failed, redirecting...", err);
  });
