/* ═══════════════════════════════════════════════════════════════════
   CHRONIQUES OUBLIÉES · VTT · script.js
   Version 1.0 — GitHub Pages compatible (static only)
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════════════════════════════════════
//  ÉTAT GLOBAL
// ══════════════════════════════════════════════════════════════════
const State = {
  // Vue
  zoom: 1,
  minZoom: 0.2,
  maxZoom: 4,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  activeTool: 'select',

  // Grille
  gridVisible: false,
  gridCellSize: 60,
  gridColor: '#c9a84c',
  gridOpacity: 0.25,

  // Scènes
  currentSceneId: null,
  scenes: [],

  // Combat / Initiative
  combatActive: false,
  currentTurn: 0,
  round: 0,
  initiativeOrder: [],

  // Paramètres
  campaignName: 'La Malédiction de Strahd',
  sessionNumber: 1,
  particlesEnabled: true,
  vignetteEnabled: true,

  // Particules splash
  particles: [],
  animFrame: null,
};

// ══════════════════════════════════════════════════════════════════
//  SCÈNES PAR DÉFAUT
// ══════════════════════════════════════════════════════════════════
const DEFAULT_SCENES = [
  {
    id: 'scene-foret',
    name: 'Forêt Maudite',
    description: 'Les arbres gémissent dans la nuit…',
    icon: '🌲',
    mapUrl: null,
    mapColor: 'linear-gradient(135deg, #0a1f0a, #1a3a1a)',
  },
  {
    id: 'scene-taverne',
    name: 'Taverne du Corbeau',
    description: 'Chaleur, bière et murmures suspects.',
    icon: '🍺',
    mapUrl: null,
    mapColor: 'linear-gradient(135deg, #2a1a0a, #3d2510)',
  },
  {
    id: 'scene-donjon',
    name: 'Donjon de Pierre',
    description: 'Le silence n\'est jamais innocent ici.',
    icon: '🏰',
    mapUrl: null,
    mapColor: 'linear-gradient(135deg, #111122, #1a1a2e)',
  },
  {
    id: 'scene-marais',
    name: 'Marais du Destin',
    description: 'La brume cache des horreurs anciennes.',
    icon: '🌫',
    mapUrl: null,
    mapColor: 'linear-gradient(135deg, #0a1a10, #1a2d1a)',
  },
  {
    id: 'scene-chateau',
    name: 'Château de Ravenloft',
    description: 'Le domaine du Comte s\'étend à l\'infini.',
    icon: '🦇',
    mapUrl: null,
    mapColor: 'linear-gradient(135deg, #1a0a1a, #2d0d2d)',
  },
];

// Héros pour l'initiative
const HEROES = [
  { name: 'Thorin',      icon: '⚔',  class: 'warrior' },
  { name: 'Elara',       icon: '✦',  class: 'mage'    },
  { name: 'Zara',        icon: '🗡', class: 'rogue'   },
  { name: 'Brother Vex', icon: '☩',  class: 'cleric'  },
];

// ══════════════════════════════════════════════════════════════════
//  UTILITAIRES
// ══════════════════════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function showToast(message, type = 'info', icon = '⚜') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3200);
}

function updateLog(msg) {
  const el = $('log-last');
  if (el) el.textContent = msg;
}

function saveToStorage() {
  try {
    const data = {
      campaignName: State.campaignName,
      sessionNumber: State.sessionNumber,
      gridVisible: State.gridVisible,
      gridCellSize: State.gridCellSize,
      gridColor: State.gridColor,
      gridOpacity: State.gridOpacity,
      particlesEnabled: State.particlesEnabled,
      vignetteEnabled: State.vignetteEnabled,
      currentSceneId: State.currentSceneId,
      scenes: State.scenes.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        mapUrl: s.mapUrl && s.mapUrl.startsWith('data:') ? null : s.mapUrl,
        mapColor: s.mapColor,
        mapDataKey: s.mapDataKey || null,
      })),
    };
    localStorage.setItem('chroniques-vtt-v1', JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('chroniques-vtt-v1');
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(State, {
      campaignName: data.campaignName || State.campaignName,
      sessionNumber: data.sessionNumber || 1,
      gridVisible: data.gridVisible || false,
      gridCellSize: data.gridCellSize || 60,
      gridColor: data.gridColor || '#c9a84c',
      gridOpacity: data.gridOpacity || 0.25,
      particlesEnabled: data.particlesEnabled !== undefined ? data.particlesEnabled : true,
      vignetteEnabled: data.vignetteEnabled !== undefined ? data.vignetteEnabled : true,
      currentSceneId: data.currentSceneId || null,
    });
    // Restaurer les scènes sauvegardées
    if (data.scenes && data.scenes.length > 0) {
      State.scenes = data.scenes.map(s => {
        const def = DEFAULT_SCENES.find(d => d.id === s.id);
        const scene = { ...(def || {}), ...s };
        // Tenter de récupérer l'image base64 depuis localStorage si elle avait une clé
        if (s.mapDataKey) {
          const imgData = localStorage.getItem(s.mapDataKey);
          if (imgData) scene.mapUrl = imgData;
        }
        return scene;
      });
    }
    return true;
  } catch (e) {
    console.warn('LocalStorage load error:', e);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
//  PARTICULES — SPLASH SCREEN
// ══════════════════════════════════════════════════════════════════
function initSplashParticles() {
  const canvas = $('splash-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['rgba(201,168,76,', 'rgba(124,77,255,', 'rgba(179,157,255,'];

  for (let i = 0; i < 80; i++) {
    State.particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.3,
      speedY: -(Math.random() * 0.6 + 0.1),
      speedX: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.6 + 0.1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: Math.random(),
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    State.particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.life -= 0.003;
      if (p.life <= 0 || p.y < 0) {
        p.y = canvas.height + 5;
        p.x = Math.random() * canvas.width;
        p.life = Math.random();
        p.opacity = Math.random() * 0.6 + 0.1;
      }
      const alpha = p.opacity * Math.min(p.life * 3, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + alpha + ')';
      ctx.fill();
    });
    State.animFrame = requestAnimationFrame(animate);
  }
  animate();
}

// ══════════════════════════════════════════════════════════════════
//  TRANSITION SPLASH → APP
// ══════════════════════════════════════════════════════════════════
function enterApp() {
  const splash = $('splash-screen');
  const app = $('app');

  splash.classList.add('fade-out');
  setTimeout(() => {
    splash.remove();
    cancelAnimationFrame(State.animFrame);
    app.classList.remove('hidden');
    initApp();
  }, 850);
}

// ══════════════════════════════════════════════════════════════════
//  INITIALISATION PRINCIPALE
// ══════════════════════════════════════════════════════════════════
function initApp() {
  loadFromStorage();
  applySavedSettings();

  // Scènes par défaut si aucune sauvegarde
  if (!State.scenes.length) {
    State.scenes = DEFAULT_SCENES.map(s => ({ ...s }));
  }

  renderScenesList();
  renderScenesModal();
  setupMapViewport();
  setupToolbar();
  setupTopbar();
  setupDice();
  setupInitiative();
  setupModals();
  setupSettings();
  setupFileImports();
  setupKeyboard();
  setupMinimap();

  // Charger la scène courante
  if (State.currentSceneId) {
    const scene = State.scenes.find(s => s.id === State.currentSceneId);
    if (scene) loadScene(scene);
  } else {
    loadScene(State.scenes[0]);
  }

  applyVignette();
  updateCampaignDisplay();

  // Phase 2
  initPhase2();

  updateLog('Bienvenue, Maître du Jeu…');
  showToast('Table virtuelle prête', 'success', '⚜');
}

function applySavedSettings() {
  // Grille
  const gridBtn = $('btn-grid-toggle');
  if (State.gridVisible && gridBtn) gridBtn.classList.add('active');

  // Paramètres UI
  const settCamp = $('setting-campaign-name');
  if (settCamp) settCamp.value = State.campaignName;
  const settSess = $('setting-session');
  if (settSess) settSess.value = State.sessionNumber;
  const settGrid = $('setting-grid');
  if (settGrid) settGrid.checked = State.gridVisible;
  const settCell = $('setting-cell-size');
  if (settCell) settCell.value = State.gridCellSize;
  const settColor = $('setting-grid-color');
  if (settColor) settColor.value = State.gridColor;
  const settOp = $('setting-grid-opacity');
  if (settOp) settOp.value = State.gridOpacity;
  const settPart = $('setting-particles');
  if (settPart) settPart.checked = State.particlesEnabled;
  const settVign = $('setting-vignette');
  if (settVign) settVign.checked = State.vignetteEnabled;
}

function updateCampaignDisplay() {
  const nameEl = $('campaign-name');
  if (nameEl) nameEl.textContent = State.campaignName;
  const sessEl = $('info-session');
  if (sessEl) sessEl.textContent = `#${State.sessionNumber}`;
}

// ══════════════════════════════════════════════════════════════════
//  SCÈNES
// ══════════════════════════════════════════════════════════════════
function renderScenesList() {
  const list = $('scenes-list');
  if (!list) return;
  list.innerHTML = '';
  State.scenes.forEach(scene => {
    const item = document.createElement('div');
    item.className = 'scene-item' + (scene.id === State.currentSceneId ? ' active' : '');
    item.innerHTML = `
      <span class="scene-item-icon">${scene.icon}</span>
      <div class="scene-item-info">
        <span class="scene-item-name">${scene.name}</span>
        <span class="scene-item-desc">${scene.description}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      loadScene(scene);
      closeAllModals();
    });
    list.appendChild(item);
  });
}

function renderScenesModal() {
  const grid = $('modal-scenes-grid');
  if (!grid) return;
  grid.innerHTML = '';
  State.scenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = 'modal-scene-card' + (scene.id === State.currentSceneId ? ' active' : '');
    const previewContent = scene.mapUrl
      ? `<img src="${scene.mapUrl}" alt="${scene.name}" />`
      : `<span style="font-size:2.5rem">${scene.icon}</span>`;
    card.innerHTML = `
      <div class="modal-scene-preview" style="${scene.mapUrl ? '' : 'background:' + scene.mapColor}">
        ${previewContent}
      </div>
      <div class="modal-scene-info">
        <span class="modal-scene-name">${scene.name}</span>
        <span class="modal-scene-desc">${scene.description}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      loadScene(scene);
      closeAllModals();
    });
    grid.appendChild(card);
  });
}

function loadScene(scene) {
  State.currentSceneId = scene.id;
  const mapImg = $('map-image');
  const placeholder = $('map-placeholder');
  const loading = $('map-loading');
  const sceneLabel = $('current-scene-label');

  if (sceneLabel) sceneLabel.textContent = scene.name;

  if (scene.mapUrl) {
    placeholder.classList.add('hidden');
    loading.classList.remove('hidden');

    mapImg.onload = () => {
      loading.classList.add('hidden');
      mapImg.style.display = 'block';
      fitView();
      drawGrid();
      updateMinimap();
    };
    mapImg.onerror = () => {
      loading.classList.add('hidden');
      placeholder.classList.remove('hidden');
      showToast('Impossible de charger la carte', 'warning', '⚠');
    };
    mapImg.src = scene.mapUrl;
  } else {
    // Scène sans image — fond coloré
    mapImg.src = '';
    mapImg.style.display = 'none';
    placeholder.classList.remove('hidden');
    loading.classList.add('hidden');

    // Appliquer la couleur de fond au container
    const container = $('map-container');
    if (container) container.style.background = scene.mapColor || 'var(--deep)';
  }

  renderScenesList();
  renderScenesModal();
  saveToStorage();
  updateLog(`Scène chargée : ${scene.name}`);
  showToast(`${scene.icon} ${scene.name}`, 'info');
}

// ══════════════════════════════════════════════════════════════════
//  MAP VIEWPORT — ZOOM & PAN
// ══════════════════════════════════════════════════════════════════
function setupMapViewport() {
  const viewport = $('map-viewport');
  const container = $('map-container');
  if (!viewport || !container) return;

  // Molette — zoom
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = clamp(State.zoom + delta * State.zoom, State.minZoom, State.maxZoom);
    const ratio = newZoom / State.zoom;

    State.panX = mouseX - ratio * (mouseX - State.panX);
    State.panY = mouseY - ratio * (mouseY - State.panY);
    State.zoom = newZoom;

    applyTransform();
    updateZoomLabel();
    updateMinimap();
  }, { passive: false });

  // Clic milieu ou outil pan — déplacement
  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 1 || State.activeTool === 'pan') {
      e.preventDefault();
      State.isPanning = true;
      State.panStartX = e.clientX - State.panX;
      State.panStartY = e.clientY - State.panY;
      viewport.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!State.isPanning) {
      // Mise à jour coordonnées
      const viewport = $('map-viewport');
      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const worldX = Math.round((e.clientX - rect.left - State.panX) / State.zoom);
        const worldY = Math.round((e.clientY - rect.top - State.panY) / State.zoom);
        const coordsEl = $('coords-text');
        if (coordsEl) coordsEl.textContent = `${worldX}, ${worldY}`;
      }
      return;
    }
    State.panX = e.clientX - State.panStartX;
    State.panY = e.clientY - State.panStartY;
    applyTransform();
    updateMinimap();
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || State.activeTool === 'pan') {
      State.isPanning = false;
      const viewport = $('map-viewport');
      if (viewport) viewport.style.cursor = State.activeTool === 'pan' ? 'grab' : 'default';
    }
  });

  // Touch support (mobile)
  let lastTouchDist = null;
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      State.isPanning = true;
      State.panStartX = e.touches[0].clientX - State.panX;
      State.panStartY = e.touches[0].clientY - State.panY;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && lastTouchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / lastTouchDist;
      State.zoom = clamp(State.zoom * ratio, State.minZoom, State.maxZoom);
      lastTouchDist = dist;
      applyTransform();
      updateZoomLabel();
    } else if (e.touches.length === 1 && State.isPanning) {
      State.panX = e.touches[0].clientX - State.panStartX;
      State.panY = e.touches[0].clientY - State.panStartY;
      applyTransform();
    }
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    State.isPanning = false;
    lastTouchDist = null;
  });
}

function applyTransform() {
  const container = $('map-container');
  if (container) {
    container.style.transform = `translate(${State.panX}px, ${State.panY}px) scale(${State.zoom})`;
    container.style.transformOrigin = '0 0';
  }
  drawGrid();
}

function updateZoomLabel() {
  const lbl = $('zoom-label');
  if (lbl) lbl.textContent = Math.round(State.zoom * 100) + '%';
}

function fitView() {
  const viewport = $('map-viewport');
  const mapImg = $('map-image');
  if (!viewport || !mapImg || !mapImg.naturalWidth) return;

  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const iw = mapImg.naturalWidth;
  const ih = mapImg.naturalHeight;

  const scaleX = vw / iw;
  const scaleY = vh / ih;
  State.zoom = clamp(Math.min(scaleX, scaleY) * 0.95, State.minZoom, State.maxZoom);
  State.panX = (vw - iw * State.zoom) / 2;
  State.panY = (vh - ih * State.zoom) / 2;

  applyTransform();
  updateZoomLabel();
}

// ══════════════════════════════════════════════════════════════════
//  GRILLE
// ══════════════════════════════════════════════════════════════════
function drawGrid() {
  const canvas = $('grid-canvas');
  if (!canvas) return;
  const viewport = $('map-viewport');
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!State.gridVisible) return;

  const cellSize = State.gridCellSize * State.zoom;
  const offsetX = State.panX % cellSize;
  const offsetY = State.panY % cellSize;

  ctx.strokeStyle = State.gridColor;
  ctx.globalAlpha = State.gridOpacity;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  for (let x = offsetX; x < canvas.width; x += cellSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = offsetY; y < canvas.height; y += cellSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function toggleGrid() {
  State.gridVisible = !State.gridVisible;
  const btn = $('btn-grid-toggle');
  if (btn) btn.classList.toggle('active', State.gridVisible);

  // Sync settings checkbox
  const settGrid = $('setting-grid');
  if (settGrid) settGrid.checked = State.gridVisible;

  drawGrid();
  saveToStorage();
  showToast(State.gridVisible ? 'Grille activée' : 'Grille masquée', 'info', '⊞');
}

// ══════════════════════════════════════════════════════════════════
//  MINIMAP
// ══════════════════════════════════════════════════════════════════
function setupMinimap() {
  // Clic sur la minimap pour naviguer
  const minimap = $('minimap-canvas');
  if (!minimap) return;
  minimap.addEventListener('click', (e) => {
    const rect = minimap.getBoundingClientRect();
    const mapImg = $('map-image');
    if (!mapImg || !mapImg.naturalWidth) return;

    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const viewport = $('map-viewport');

    State.panX = -(rx * mapImg.naturalWidth * State.zoom) + viewport.clientWidth / 2;
    State.panY = -(ry * mapImg.naturalHeight * State.zoom) + viewport.clientHeight / 2;
    applyTransform();
    updateMinimap();
  });
}

function updateMinimap() {
  const canvas = $('minimap-canvas');
  const indicator = $('minimap-viewport-indicator');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const mapImg = $('map-image');
  const viewport = $('map-viewport');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!mapImg || !mapImg.naturalWidth) {
    if (indicator) indicator.style.display = 'none';
    return;
  }

  // Dessiner la miniature
  ctx.drawImage(mapImg, 0, 0, canvas.width, canvas.height);

  // Indicateur de vue
  if (!indicator || !viewport) return;
  const scaleX = canvas.width / mapImg.naturalWidth;
  const scaleY = canvas.height / mapImg.naturalHeight;

  const visW = (viewport.clientWidth / State.zoom) * scaleX;
  const visH = (viewport.clientHeight / State.zoom) * scaleY;
  const visX = (-State.panX / State.zoom) * scaleX;
  const visY = (-State.panY / State.zoom) * scaleY;

  indicator.style.display = 'block';
  indicator.style.left   = clamp(visX, 0, canvas.width) + 'px';
  indicator.style.top    = clamp(visY, 0, canvas.height) + 'px';
  indicator.style.width  = Math.min(visW, canvas.width) + 'px';
  indicator.style.height = Math.min(visH, canvas.height) + 'px';
}

// ══════════════════════════════════════════════════════════════════
//  TOOLBAR GAUCHE
// ══════════════════════════════════════════════════════════════════
function setupToolbar() {
  // Boutons outils
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      State.activeTool = btn.dataset.tool;
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const viewport = $('map-viewport');
      if (viewport) {
        viewport.style.cursor = State.activeTool === 'pan' ? 'grab' : 'default';
      }
      updateLog(`Outil : ${btn.querySelector('span')?.textContent || btn.dataset.tool}`);
    });
  });

  // Zoom buttons
  $('btn-zoom-in')?.addEventListener('click', () => {
    State.zoom = clamp(State.zoom * 1.2, State.minZoom, State.maxZoom);
    applyTransform();
    updateZoomLabel();
    updateMinimap();
  });

  $('btn-zoom-out')?.addEventListener('click', () => {
    State.zoom = clamp(State.zoom / 1.2, State.minZoom, State.maxZoom);
    applyTransform();
    updateZoomLabel();
    updateMinimap();
  });

  $('btn-fit-view')?.addEventListener('click', () => {
    fitView();
    updateMinimap();
    showToast('Vue ajustée', 'info', '⊞');
  });

  // Fog toggle — Phase 2 le prend en charge dans initPhase2()
  // (stub cosmétique Phase 1 supprimé)
  $('btn-ambient')?.addEventListener('click', () => {
    showToast("Sons d'ambiance (Phase 3)", 'warning', '🎵');
  });
}

// ══════════════════════════════════════════════════════════════════
//  TOPBAR
// ══════════════════════════════════════════════════════════════════
function setupTopbar() {
  $('btn-grid-toggle')?.addEventListener('click', toggleGrid);

  $('btn-scene-switcher')?.addEventListener('click', () => openModal('modal-scene'));

  $('btn-settings')?.addEventListener('click', () => openModal('modal-settings'));

  // Clic sur le nom de campagne → paramètres
  $('campaign-name')?.addEventListener('click', () => openModal('modal-settings'));

  // Bouton + dans le panneau scènes
  document.querySelector('#scenes-list')?.closest('.panel-section')
    ?.querySelector('.btn-add')
    ?.addEventListener('click', () => {
      $('file-map-import')?.click();
    });
}

// ══════════════════════════════════════════════════════════════════
//  MODALES
// ══════════════════════════════════════════════════════════════════
function openModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function setupModals() {
  // Fermer via bouton ✕
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // Fermer en cliquant l'overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', closeAllModals);
  });

  // Echap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

// ══════════════════════════════════════════════════════════════════
//  PARAMÈTRES
// ══════════════════════════════════════════════════════════════════
function setupSettings() {
  $('btn-save-settings')?.addEventListener('click', () => {
    const campName = $('setting-campaign-name')?.value.trim();
    if (campName) State.campaignName = campName;

    const sess = parseInt($('setting-session')?.value, 10);
    if (!isNaN(sess) && sess > 0) State.sessionNumber = sess;

    State.gridVisible  = $('setting-grid')?.checked || false;
    State.gridCellSize = parseInt($('setting-cell-size')?.value, 10) || 60;
    State.gridColor    = $('setting-grid-color')?.value || '#c9a84c';
    State.gridOpacity  = parseFloat($('setting-grid-opacity')?.value) || 0.25;
    State.particlesEnabled = $('setting-particles')?.checked !== false;
    State.vignetteEnabled  = $('setting-vignette')?.checked !== false;

    const gridBtn = $('btn-grid-toggle');
    if (gridBtn) gridBtn.classList.toggle('active', State.gridVisible);

    drawGrid();
    applyVignette();
    updateCampaignDisplay();
    saveToStorage();
    closeAllModals();
    showToast('Paramètres sauvegardés', 'success', '✓');
    updateLog('Paramètres mis à jour');
  });

  // Live preview grille
  $('setting-grid-opacity')?.addEventListener('input', (e) => {
    State.gridOpacity = parseFloat(e.target.value);
    if (State.gridVisible) drawGrid();
  });
  $('setting-grid-color')?.addEventListener('input', (e) => {
    State.gridColor = e.target.value;
    if (State.gridVisible) drawGrid();
  });
  $('setting-cell-size')?.addEventListener('input', (e) => {
    State.gridCellSize = parseInt(e.target.value, 10) || 60;
    if (State.gridVisible) drawGrid();
  });
  $('setting-grid')?.addEventListener('change', (e) => {
    State.gridVisible = e.target.checked;
    const gridBtn = $('btn-grid-toggle');
    if (gridBtn) gridBtn.classList.toggle('active', State.gridVisible);
    drawGrid();
  });
}

function applyVignette() {
  const viewport = $('map-viewport');
  if (!viewport) return;
  if (State.vignetteEnabled) {
    viewport.style.boxShadow = 'inset 0 0 80px rgba(7,7,14,0.6)';
  } else {
    viewport.style.boxShadow = 'none';
  }
}

// ══════════════════════════════════════════════════════════════════
//  IMPORT DE CARTES
// ══════════════════════════════════════════════════════════════════
function setupFileImports() {
  // Bouton placeholder
  $('btn-import-map')?.addEventListener('click', () => $('file-map-import')?.click());

  // Import depuis placeholder
  $('file-map-import')?.addEventListener('change', (e) => {
    handleMapFile(e.target.files[0]);
  });

  // Import depuis modale scènes
  $('btn-modal-import')?.addEventListener('click', () => $('file-modal-import')?.click());

  $('file-modal-import')?.addEventListener('change', (e) => {
    handleMapFile(e.target.files[0]);
    closeAllModals();
  });

  // Drag & drop sur le viewport
  const viewport = $('map-viewport');
  if (viewport) {
    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      viewport.style.outline = '2px dashed var(--gold)';
    });
    viewport.addEventListener('dragleave', () => {
      viewport.style.outline = '';
    });
    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      viewport.style.outline = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleMapFile(file);
    });
  }

  // Bouton + dans le panneau droit
  const panelAddBtn = document.querySelector('#panel-right .btn-add');
  if (panelAddBtn) {
    panelAddBtn.addEventListener('click', () => $('file-map-import')?.click());
  }
}

function handleMapFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Format invalide (PNG/JPG uniquement)', 'warning', '⚠');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Fichier trop lourd (max 10 Mo)', 'warning', '⚠');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const sceneName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

    // Créer une nouvelle scène
    const newId = 'scene-custom-' + Date.now();
    const dataKey = 'map-data-' + newId;

    // Tenter de sauvegarder l'image (peut échouer si quota dépassé)
    try {
      localStorage.setItem(dataKey, dataUrl);
    } catch (err) {
      console.warn('Storage quota exceeded for image — image will not persist across sessions');
    }

    const newScene = {
      id: newId,
      name: sceneName,
      description: 'Carte importée localement',
      icon: '🗺',
      mapUrl: dataUrl,
      mapColor: 'linear-gradient(135deg, #0a0a1a, #1a1a2e)',
      mapDataKey: dataKey,
    };

    State.scenes.push(newScene);
    loadScene(newScene);
    renderScenesList();
    renderScenesModal();
    saveToStorage();
    showToast(`Carte importée : ${sceneName}`, 'success', '📜');
    updateLog(`Carte importée : ${sceneName}`);
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════════════════════════════════════
//  DÉS
// ══════════════════════════════════════════════════════════════════
function setupDice() {
  document.querySelectorAll('.dice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sides = parseInt(btn.dataset.sides, 10);
      rollDie(sides);
    });
  });
}

function rollDie(sides) {
  const result = Math.floor(Math.random() * sides) + 1;
  const resultEl = $('dice-result');
  const valueEl  = $('dice-result-value');
  const typeEl   = $('dice-result-type');

  if (resultEl) resultEl.classList.remove('hidden');
  if (valueEl)  valueEl.textContent = result;
  if (typeEl)   typeEl.textContent  = `d${sides}`;

  // Animation pulse
  if (valueEl) {
    valueEl.style.transform = 'scale(1.4)';
    valueEl.style.color = result === sides ? 'var(--gold-light)' : result === 1 ? 'var(--blood)' : 'var(--text-primary)';
    setTimeout(() => {
      valueEl.style.transform = 'scale(1)';
    }, 200);
  }

  const msg = `d${sides} → ${result}${result === sides ? ' 🎉 CRITIQUE !' : result === 1 ? ' 💀 FUMBLE' : ''}`;
  updateLog(msg);

  const icon = result === sides ? '🎉' : result === 1 ? '💀' : '🎲';
  const type = result === sides ? 'success' : result === 1 ? 'warning' : 'info';
  showToast(msg, type, icon);
}

// ══════════════════════════════════════════════════════════════════
//  INITIATIVE
// ══════════════════════════════════════════════════════════════════
function setupInitiative() {
  $('btn-roll-initiative')?.addEventListener('click', rollInitiative);
  $('btn-end-turn')?.addEventListener('click', nextTurn);
  $('btn-next-round')?.addEventListener('click', nextRound);
}

function rollInitiative() {
  if (State.combatActive) {
    // Reset
    State.combatActive = false;
    State.round = 0;
    State.currentTurn = 0;
    State.initiativeOrder = [];
    renderInitiativeTrack();
    $('round-number').textContent = '—';
    $('info-round').textContent = '—';
    showToast('Combat terminé', 'info', '⚔');
    updateLog('Combat terminé');
    return;
  }

  // Lancer l'initiative pour chaque héros + un ennemi aléatoire
  const combatants = [
    ...HEROES.map(h => ({
      name: h.name,
      icon: h.icon,
      initiative: Math.floor(Math.random() * 20) + 1,
      isEnemy: false,
    })),
    {
      name: 'Ennemi',
      icon: '💀',
      initiative: Math.floor(Math.random() * 20) + 1,
      isEnemy: true,
    },
  ];

  // Trier par initiative décroissante
  combatants.sort((a, b) => b.initiative - a.initiative);

  State.initiativeOrder = combatants;
  State.currentTurn = 0;
  State.round = 1;
  State.combatActive = true;

  renderInitiativeTrack();
  $('round-number').textContent = State.round;
  $('info-round').textContent = State.round;
  $('btn-roll-initiative').innerHTML = '<span>🛑</span><small>Arrêter</small>';

  showToast('Combat lancé !', 'success', '⚔');
  updateLog(`Combat — Round ${State.round} — Tour de ${State.initiativeOrder[0].name}`);
}

function nextTurn() {
  if (!State.combatActive) return;
  State.currentTurn = (State.currentTurn + 1) % State.initiativeOrder.length;
  if (State.currentTurn === 0) nextRound();
  else renderInitiativeTrack();
  const current = State.initiativeOrder[State.currentTurn];
  updateLog(`Tour de ${current.name} (initiative ${current.initiative})`);
}

function nextRound() {
  if (!State.combatActive) return;
  State.round++;
  State.currentTurn = 0;
  $('round-number').textContent = State.round;
  $('info-round').textContent = State.round;
  renderInitiativeTrack();
  showToast(`Round ${State.round}`, 'info', '🔄');
  updateLog(`Round ${State.round} — Tour de ${State.initiativeOrder[0].name}`);
}

function renderInitiativeTrack() {
  const track = $('init-track');
  if (!track) return;
  track.innerHTML = '';

  if (!State.combatActive || !State.initiativeOrder.length) {
    track.innerHTML = '<span class="init-empty">— Combat non lancé —</span>';
    return;
  }

  State.initiativeOrder.forEach((c, i) => {
    const slot = document.createElement('div');
    slot.className = 'init-slot' + (i === State.currentTurn ? ' active' : '') + (c.isEnemy ? ' enemy' : '');
    slot.innerHTML = `
      <span class="init-icon">${c.icon}</span>
      <span class="init-name">${c.name}</span>
      <span class="init-score">${c.initiative}</span>
    `;
    slot.title = `${c.name} — Initiative : ${c.initiative}`;
    slot.addEventListener('click', () => {
      State.currentTurn = i;
      renderInitiativeTrack();
    });
    track.appendChild(slot);
  });
}

// ══════════════════════════════════════════════════════════════════
//  RACCOURCIS CLAVIER
// ══════════════════════════════════════════════════════════════════
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ignorer si un input est actif
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    switch (e.key.toLowerCase()) {
      case 's': activateTool('select'); break;
      case 'g': activateTool('pan'); break;
      case 'm': activateTool('measure'); break;
      case 'f': fitView(); updateMinimap(); break;
      case '+': case '=':
        State.zoom = clamp(State.zoom * 1.2, State.minZoom, State.maxZoom);
        applyTransform(); updateZoomLabel(); updateMinimap();
        break;
      case '-':
        State.zoom = clamp(State.zoom / 1.2, State.minZoom, State.maxZoom);
        applyTransform(); updateZoomLabel(); updateMinimap();
        break;
      case 'escape': closeAllModals(); break;
    }
  });
}

function activateTool(tool) {
  State.activeTool = tool;
  document.querySelectorAll('[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  const viewport = $('map-viewport');
  if (viewport) viewport.style.cursor = tool === 'pan' ? 'grab' : 'default';
}

// ══════════════════════════════════════════════════════════════════
//  RESIZE
// ══════════════════════════════════════════════════════════════════
window.addEventListener('resize', () => {
  drawGrid();
  updateMinimap();
});

// ══════════════════════════════════════════════════════════════════
//  STYLES DYNAMIQUES POUR INITIATIVE (injection CSS)
// ══════════════════════════════════════════════════════════════════
(function injectDynamicStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Initiative Track */
    .init-track {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;
      overflow-x: auto;
      padding: 2px 0;
      scrollbar-width: none;
    }
    .init-track::-webkit-scrollbar { display: none; }
    .init-empty {
      font-family: 'Crimson Text', serif;
      font-style: italic;
      color: var(--text-muted);
      font-size: 0.82rem;
    }
    .init-slot {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px 3px 6px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      font-family: 'Cinzel', serif;
      font-size: 0.7rem;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition);
      white-space: nowrap;
      user-select: none;
    }
    .init-slot:hover {
      border-color: rgba(201,168,76,0.3);
      color: var(--text-primary);
    }
    .init-slot.active {
      background: rgba(201,168,76,0.12);
      border-color: var(--gold);
      color: var(--gold-light);
      box-shadow: 0 0 12px rgba(201,168,76,0.2);
    }
    .init-slot.enemy.active {
      background: rgba(192,57,43,0.12);
      border-color: var(--blood);
      color: #e74c3c;
      box-shadow: 0 0 12px rgba(192,57,43,0.2);
    }
    .init-icon { font-size: 0.85rem; }
    .init-name { font-weight: 600; }
    .init-score {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    .init-slot.active .init-score { color: var(--gold-dim); }

    /* Scene list items */
    .scene-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: var(--transition);
      border: 1px solid transparent;
    }
    .scene-item:hover {
      background: rgba(201,168,76,0.06);
      border-color: rgba(201,168,76,0.12);
    }
    .scene-item.active {
      background: rgba(201,168,76,0.1);
      border-color: rgba(201,168,76,0.25);
    }
    .scene-item-icon { font-size: 1.2rem; flex-shrink: 0; }
    .scene-item-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .scene-item-name {
      font-family: 'Cinzel', serif;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .scene-item-desc {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Dice result animation */
    .dice-result .result-value {
      transition: transform 0.2s ease, color 0.2s ease;
    }

    /* Minimap indicator */
    #minimap-viewport-indicator {
      position: absolute;
      border: 1px solid rgba(201,168,76,0.7);
      background: rgba(201,168,76,0.08);
      pointer-events: none;
      display: none;
    }
  `;
  document.head.appendChild(style);
})();

// ══════════════════════════════════════════════════════════════════
//  PHASE 2 — ÉTAT TOKENS & BROUILLARD
// ══════════════════════════════════════════════════════════════════
Object.assign(State, {
  tokens: [],
  selectedTokenId: null,
  tokenDragging: false,
  tokenDragId: null,
  tokenDragOffX: 0,
  tokenDragOffY: 0,
  snapToGrid: true,
  fogEnabled: false,
  fogOpacity: 0.85,
  fogPainting: false,
  fogTool: 'reveal',
  fogBrushSize: 2,
  _tokenImgData: {}, // id → dataUrl
});

// ══════════════════════════════════════════════════════════════════
//  PHASE 2 — PERSISTANCE
// ══════════════════════════════════════════════════════════════════
function savePhase2() {
  try {
    const lean = State.tokens.map(t => {
      const copy = { ...t };
      if (copy.imgData) {
        try { localStorage.setItem('co-tok-img-' + copy.id, copy.imgData); } catch (_) {}
        delete copy.imgData;
        copy.hasImg = true;
      }
      return copy;
    });
    localStorage.setItem('co-tokens-v2', JSON.stringify(lean));
    localStorage.setItem('co-fog-v2', JSON.stringify({ fogEnabled: State.fogEnabled, fogOpacity: State.fogOpacity }));
  } catch (e) { console.warn('savePhase2:', e); }
  saveFogCanvas();
}

function loadPhase2() {
  try {
    const raw = localStorage.getItem('co-tokens-v2');
    if (raw) {
      State.tokens = JSON.parse(raw).map(t => {
        if (t.hasImg) {
          const img = localStorage.getItem('co-tok-img-' + t.id);
          if (img) t.imgData = img;
          delete t.hasImg;
        }
        return t;
      });
    }
  } catch (e) { console.warn('loadPhase2 tokens:', e); }
  try {
    const fraw = localStorage.getItem('co-fog-v2');
    if (fraw) { const f = JSON.parse(fraw); State.fogEnabled = f.fogEnabled || false; State.fogOpacity = f.fogOpacity || 0.85; }
  } catch (e) {}
}

// ══════════════════════════════════════════════════════════════════
//  PHASE 2 — TOKENS
// ══════════════════════════════════════════════════════════════════
let _pendingImgData = null;

function initPhase2() {
  loadPhase2();

  // Brush cursor element
  if (!$('fog-brush-cursor')) {
    const cur = document.createElement('div');
    cur.id = 'fog-brush-cursor';
    document.body.appendChild(cur);
  }

  // Token info panel
  if (!$('token-info-panel')) {
    const panel = document.createElement('div');
    panel.id = 'token-info-panel';
    panel.innerHTML = `
      <div class="tip-name" id="tip-name">—</div>
      <div class="tip-type" id="tip-type">—</div>
      <div class="tip-hp-row">
        <div class="tip-hp-bar"><div class="tip-hp-fill" id="tip-hp-fill"></div></div>
        <span class="tip-hp-text" id="tip-hp-text">—</span>
      </div>
      <div class="tip-actions">
        <button class="tip-btn" id="tip-btn-damage">— PV</button>
        <button class="tip-btn" id="tip-btn-heal">+ PV</button>
        <button class="tip-btn" id="tip-btn-edit">✎</button>
        <button class="tip-btn danger" id="tip-btn-delete">✕</button>
      </div>`;
    document.body.appendChild(panel);
    $('tip-btn-damage')?.addEventListener('click', () => adjustHP(State.selectedTokenId, -1));
    $('tip-btn-heal')?.addEventListener('click',   () => adjustHP(State.selectedTokenId, +1));
    $('tip-btn-edit')?.addEventListener('click',   () => openTokenEditModal(State.selectedTokenId));
    $('tip-btn-delete')?.addEventListener('click', () => { deleteToken(State.selectedTokenId); });
  }

  // Fog canvas
  ensureFogCanvas();
  applyFogVisibility();
  restoreFogCanvas();

  // Render all saved tokens
  State.tokens.forEach(t => renderToken(t));

  // Wire modal buttons
  $('btn-new-token-from-panel')?.addEventListener('click', () => { closeAllModals(); openTokenCreateModal(); });
  $('btn-token-img-pick')?.addEventListener('click', () => $('token-img-file')?.click());
  $('token-img-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      _pendingImgData = ev.target.result;
      const nm = $('token-img-name'); if (nm) nm.textContent = file.name;
      const prev = $('token-img-preview'); if (prev) prev.style.display = 'block';
      const prevImg = $('token-img-preview-img'); if (prevImg) prevImg.src = _pendingImgData;
    };
    reader.readAsDataURL(file);
  });
  $('btn-token-save')?.addEventListener('click', saveTokenFromModal);
  $('btn-token-cancel')?.addEventListener('click', closeAllModals);

  // Fog modal
  $('fog-enabled')?.addEventListener('change', (e) => {
    State.fogEnabled = e.target.checked;
    applyFogVisibility();
    savePhase2();
    showToast(State.fogEnabled ? 'Brouillard activé' : 'Brouillard désactivé', 'info', '🌫');
  });
  $('fog-opacity')?.addEventListener('input', (e) => {
    State.fogOpacity = parseFloat(e.target.value);
    applyFogOpacity();
  });
  $('fog-brush-size')?.addEventListener('change', (e) => { State.fogBrushSize = parseInt(e.target.value, 10) || 2; });
  document.querySelectorAll('.fog-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      State.fogTool = btn.dataset.fogTool;
      document.querySelectorAll('.fog-tool-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
  $('btn-fog-reveal-all')?.addEventListener('click', fogRevealAll);
  $('btn-fog-hide-all')?.addEventListener('click', fogHideAll);

  // Topbar buttons
  $('btn-tokens-panel')?.addEventListener('click', () => {
    renderTokensListPanel();
    openModal('modal-tokens-panel');
  });
  $('btn-fog-panel')?.addEventListener('click', () => {
    const fChk = $('fog-enabled'); if (fChk) fChk.checked = State.fogEnabled;
    const fOp  = $('fog-opacity');  if (fOp)  fOp.value  = State.fogOpacity;
    const fBr  = $('fog-brush-size'); if (fBr) fBr.value = State.fogBrushSize;
    openModal('modal-fog');
  });

  // Wire fog painting to viewport
  setupFogPainting();
  setupTokenDrag();

  // Keyboard: T = create token, Delete = delete selected
  document.addEventListener('keydown', (e) => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key.toLowerCase() === 't') openTokenCreateModal();
    if ((e.key === 'Delete' || e.key === 'Backspace') && State.selectedTokenId) {
      deleteToken(State.selectedTokenId);
    }
  });

  // Click on viewport background → deselect
  $('map-viewport')?.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.vtt-token')) {
      selectToken(null);
    }
  });
}

function generateTokenId() { return 'tok-' + Date.now() + '-' + Math.floor(Math.random() * 9999); }

function openTokenCreateModal() {
  _pendingImgData = null;
  $('token-edit-id').value = '';
  $('modal-token-title').textContent = '♟ Créer un Pion';
  $('token-name').value = '';
  $('token-type').value = 'joueur';
  $('token-hp').value = '30';
  $('token-hp-max').value = '30';
  $('token-size').value = '1';
  $('token-color').value = '#c9a84c';
  $('token-icon').value = '';
  const nm = $('token-img-name'); if (nm) nm.textContent = 'aucune';
  const prev = $('token-img-preview'); if (prev) prev.style.display = 'none';
  const fi = $('token-img-file'); if (fi) fi.value = '';
  openModal('modal-token-create');
  setTimeout(() => $('token-name')?.focus(), 100);
}

function openTokenEditModal(id) {
  const t = State.tokens.find(t => t.id === id);
  if (!t) return;
  _pendingImgData = t.imgData || null;
  $('token-edit-id').value = id;
  $('modal-token-title').textContent = '✎ Modifier le Pion';
  $('token-name').value = t.name;
  $('token-type').value = t.type;
  $('token-hp').value = t.hp;
  $('token-hp-max').value = t.hpMax;
  $('token-size').value = t.size;
  $('token-color').value = t.color;
  $('token-icon').value = t.icon || '';
  const nm = $('token-img-name'); if (nm) nm.textContent = t.imgData ? 'image chargée' : 'aucune';
  const prev = $('token-img-preview'); if (prev) prev.style.display = t.imgData ? 'block' : 'none';
  const prevImg = $('token-img-preview-img'); if (prevImg && t.imgData) prevImg.src = t.imgData;
  closeAllModals();
  openModal('modal-token-create');
}

function saveTokenFromModal() {
  const name = ($('token-name')?.value || '').trim();
  if (!name) { showToast('Donnez un nom au pion', 'warning', '⚠'); return; }
  const editId = $('token-edit-id')?.value;
  const hp    = parseInt($('token-hp')?.value, 10)    || 30;
  const hpMax = parseInt($('token-hp-max')?.value, 10) || 30;
  const size  = parseInt($('token-size')?.value, 10)   || 1;

  if (editId) {
    // Edit existing
    const t = State.tokens.find(t => t.id === editId);
    if (t) {
      t.name  = name;
      t.type  = $('token-type')?.value || 'joueur';
      t.hp    = hp;
      t.hpMax = hpMax;
      t.size  = size;
      t.color = $('token-color')?.value || '#c9a84c';
      t.icon  = $('token-icon')?.value || '';
      if (_pendingImgData) t.imgData = _pendingImgData;
      // Re-render
      const el = $('token-el-' + editId);
      if (el) { el.remove(); }
      renderToken(t);
      selectToken(t.id);
    }
  } else {
    // Create new — place in center of viewport
    const vp = $('map-viewport');
    const cx = vp ? (vp.clientWidth  / 2 - State.panX) / State.zoom : 200;
    const cy = vp ? (vp.clientHeight / 2 - State.panY) / State.zoom : 200;
    const token = {
      id:     generateTokenId(),
      name,
      type:   $('token-type')?.value || 'joueur',
      hp,
      hpMax,
      size,
      color:  $('token-color')?.value || '#c9a84c',
      icon:   $('token-icon')?.value || '',
      imgData: _pendingImgData || null,
      x: cx,
      y: cy,
    };
    State.tokens.push(token);
    renderToken(token);
    selectToken(token.id);
    showToast(`♟ ${name} placé sur la carte`, 'success', '♟');
    updateLog(`Pion créé : ${name}`);
  }
  savePhase2();
  closeAllModals();
}

function renderToken(t) {
  const layer = $('tokens-layer');
  if (!layer) return;
  const cellPx = State.gridCellSize;
  const sizePx = cellPx * t.size;
  const el = document.createElement('div');
  el.id = 'token-el-' + t.id;
  el.className = 'vtt-token ' + t.type;
  el.style.cssText = `
    width: ${sizePx}px;
    height: ${sizePx}px;
    left: ${t.x - sizePx / 2}px;
    top:  ${t.y - sizePx / 2}px;
    border-color: ${t.color};
  `;
  el.dataset.tokenId = t.id;

  // Inner (image or emoji)
  const inner = document.createElement('div');
  inner.className = 'token-inner';
  if (t.imgData) {
    const img = document.createElement('img');
    img.src = t.imgData;
    img.draggable = false;
    inner.appendChild(img);
  } else {
    const icon = t.icon || defaultIcon(t.type);
    inner.textContent = icon;
  }
  el.appendChild(inner);

  // Label
  const label = document.createElement('div');
  label.className = 'token-label';
  label.textContent = t.name;
  el.appendChild(label);

  // HP bar
  const bar = document.createElement('div');
  bar.className = 'token-hp-bar';
  const fill = document.createElement('div');
  fill.className = 'token-hp-fill';
  fill.id = 'hp-fill-' + t.id;
  updateHpFill(fill, t.hp, t.hpMax);
  bar.appendChild(fill);
  el.appendChild(bar);

  // Click to select
  el.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (e.button === 0) selectToken(t.id);
  });

  layer.appendChild(el);
  if (State.selectedTokenId === t.id) el.classList.add('selected');
}

function defaultIcon(type) {
  return type === 'joueur' ? '🧙' : type === 'ennemi' ? '💀' : '🗣';
}

function updateHpFill(fillEl, hp, hpMax) {
  const pct = Math.max(0, Math.min(100, (hp / hpMax) * 100));
  fillEl.style.width = pct + '%';
  fillEl.style.background = pct > 60 ? '#27ae60' : pct > 30 ? '#e67e22' : '#c0392b';
}

function selectToken(id) {
  // Deselect previous
  if (State.selectedTokenId) {
    const prev = $('token-el-' + State.selectedTokenId);
    if (prev) prev.classList.remove('selected');
  }
  State.selectedTokenId = id;
  const panel = $('token-info-panel');
  if (!id) {
    if (panel) panel.classList.remove('visible');
    return;
  }
  const t = State.tokens.find(t => t.id === id);
  if (!t || !panel) return;
  const el = $('token-el-' + id);
  if (el) el.classList.add('selected');
  // Update info panel
  const tipName = $('tip-name'); if (tipName) tipName.textContent = t.name;
  const tipType = $('tip-type'); if (tipType) tipType.textContent = { joueur:'🧙 Joueur', ennemi:'💀 Ennemi', pnj:'🗣 PNJ' }[t.type] || t.type;
  const tipFill = $('tip-hp-fill');
  if (tipFill) updateHpFill(tipFill, t.hp, t.hpMax);
  const tipText = $('tip-hp-text'); if (tipText) tipText.textContent = `${t.hp}/${t.hpMax}`;
  panel.classList.add('visible');
}

function adjustHP(id, delta) {
  const t = State.tokens.find(t => t.id === id);
  if (!t) return;
  const amount = delta > 0 ? 1 : -1;
  t.hp = Math.max(0, Math.min(t.hpMax, t.hp + amount));
  // Update bar on token
  const fill = $('hp-fill-' + id);
  if (fill) updateHpFill(fill, t.hp, t.hpMax);
  // Update info panel
  const tipFill = $('tip-hp-fill'); if (tipFill) updateHpFill(tipFill, t.hp, t.hpMax);
  const tipText = $('tip-hp-text'); if (tipText) tipText.textContent = `${t.hp}/${t.hpMax}`;
  savePhase2();
}

function deleteToken(id) {
  const el = $('token-el-' + id);
  if (el) el.remove();
  State.tokens = State.tokens.filter(t => t.id !== id);
  try { localStorage.removeItem('co-tok-img-' + id); } catch (_) {}
  if (State.selectedTokenId === id) selectToken(null);
  savePhase2();
  showToast('Pion supprimé', 'info', '✕');
}

function moveTokenEl(id, worldX, worldY) {
  const t = State.tokens.find(t => t.id === id);
  if (!t) return;
  const cellPx = State.gridCellSize;
  let x = worldX, y = worldY;
  if (State.snapToGrid && State.gridVisible) {
    x = Math.round(x / cellPx) * cellPx;
    y = Math.round(y / cellPx) * cellPx;
  }
  t.x = x; t.y = y;
  const sizePx = cellPx * t.size;
  const el = $('token-el-' + id);
  if (el) {
    el.style.left = (x - sizePx / 2) + 'px';
    el.style.top  = (y - sizePx / 2) + 'px';
  }
}

function setupTokenDrag() {
  const vp = $('map-viewport');
  if (!vp) return;

  vp.addEventListener('mousedown', (e) => {
    if (State.fogPainting) return;
    const tokenEl = e.target.closest('.vtt-token');
    if (!tokenEl || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const id = tokenEl.dataset.tokenId;
    State.tokenDragging = true;
    State.tokenDragId = id;
    tokenEl.classList.add('dragging');
    // Compute offset in world coords from token center
    const rect = vp.getBoundingClientRect();
    const mouseWorldX = (e.clientX - rect.left - State.panX) / State.zoom;
    const mouseWorldY = (e.clientY - rect.top  - State.panY) / State.zoom;
    const t = State.tokens.find(t => t.id === id);
    if (t) { State.tokenDragOffX = mouseWorldX - t.x; State.tokenDragOffY = mouseWorldY - t.y; }
    selectToken(id);
  });

  window.addEventListener('mousemove', (e) => {
    if (!State.tokenDragging || !State.tokenDragId) return;
    const rect = vp.getBoundingClientRect();
    const wx = (e.clientX - rect.left - State.panX) / State.zoom - State.tokenDragOffX;
    const wy = (e.clientY - rect.top  - State.panY) / State.zoom - State.tokenDragOffY;
    moveTokenEl(State.tokenDragId, wx, wy);
  });

  window.addEventListener('mouseup', (e) => {
    if (!State.tokenDragging) return;
    if (State.tokenDragId) {
      const el = $('token-el-' + State.tokenDragId);
      if (el) el.classList.remove('dragging');
      savePhase2();
    }
    State.tokenDragging = false;
    State.tokenDragId = null;
  });
}

function renderTokensListPanel() {
  const container = $('tokens-list-panel');
  if (!container) return;
  container.innerHTML = '';
  if (!State.tokens.length) {
    container.innerHTML = '<span style="color:var(--text-muted);font-style:italic;font-size:0.8rem;">Aucun pion sur la carte.</span>';
    return;
  }
  State.tokens.forEach(t => {
    const row = document.createElement('div');
    row.className = 'token-list-row';
    const avatar = document.createElement('div');
    avatar.className = 'token-list-avatar';
    if (t.type === 'ennemi') avatar.style.borderColor = '#c0392b';
    else if (t.type === 'pnj') avatar.style.borderColor = '#8e44ad';
    if (t.imgData) {
      const img = document.createElement('img');
      img.src = t.imgData;
      avatar.appendChild(img);
    } else {
      avatar.textContent = t.icon || defaultIcon(t.type);
    }
    const info = document.createElement('div');
    info.className = 'token-list-info';
    info.innerHTML = `<div class="token-list-name">${t.name}</div><div class="token-list-meta">${{ joueur:'Joueur', ennemi:'Ennemi', pnj:'PNJ' }[t.type]} · ${t.hp}/${t.hpMax} PV</div>`;
    const actions = document.createElement('div');
    actions.className = 'token-list-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'token-list-btn';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => openTokenEditModal(t.id));
    const delBtn = document.createElement('button');
    delBtn.className = 'token-list-btn del';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => { deleteToken(t.id); renderTokensListPanel(); });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(avatar);
    row.appendChild(info);
    row.appendChild(actions);
    // Click row → select
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectToken(t.id);
      closeAllModals();
    });
    container.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════════
//  PHASE 2 — BROUILLARD DE GUERRE
// ══════════════════════════════════════════════════════════════════
function ensureFogCanvas() {
  const layer = $('fog-layer');
  if (!layer) return;
  let canvas = $('fog-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'fog-canvas';
    layer.appendChild(canvas);
  }
  return canvas;
}

function resizeFogCanvas() {
  const mapImg = $('map-image');
  const canvas = $('fog-canvas');
  if (!canvas || !mapImg || !mapImg.naturalWidth) return;
  const w = mapImg.naturalWidth;
  const h = mapImg.naturalHeight;
  // Only reset if size changed
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
    // Fill with black (hidden)
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  }
  canvas.style.width  = mapImg.style.width  || mapImg.width  + 'px';
  canvas.style.height = mapImg.style.height || mapImg.height + 'px';
}

function applyFogVisibility() {
  const layer = $('fog-layer');
  if (!layer) return;
  layer.style.display = State.fogEnabled ? 'block' : 'none';
  const fogBtn = $('btn-fog-toggle');
  if (fogBtn) fogBtn.classList.toggle('active', State.fogEnabled);
}

function applyFogOpacity() {
  const canvas = $('fog-canvas');
  if (canvas) canvas.style.opacity = State.fogOpacity;
}

function saveFogCanvas() {
  try {
    const canvas = $('fog-canvas');
    if (!canvas || !canvas.width) return;
    const key = 'co-fog-map-' + (State.currentSceneId || 'default');
    localStorage.setItem(key, canvas.toDataURL('image/png'));
  } catch (e) {}
}

function restoreFogCanvas() {
  try {
    const canvas = ensureFogCanvas();
    if (!canvas) return;
    const key = 'co-fog-map-' + (State.currentSceneId || 'default');
    const dataUrl = localStorage.getItem(key);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      if (canvas.width === 0) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      applyFogOpacity();
    };
    img.src = dataUrl;
  } catch (e) {}
}

function fogRevealAll() {
  const canvas = $('fog-canvas');
  if (!canvas || !canvas.width) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  savePhase2();
  showToast('Toute la carte révélée', 'success', '☀');
}

function fogHideAll() {
  const canvas = $('fog-canvas');
  if (!canvas || !canvas.width) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  savePhase2();
  showToast('Carte couverte', 'info', '🌑');
}

function setupFogPainting() {
  const vp = $('map-viewport');
  if (!vp) return;
  const cursor = $('fog-brush-cursor');

  let painting = false;

  function screenToWorld(clientX, clientY) {
    const rect = vp.getBoundingClientRect();
    return {
      x: (clientX - rect.left  - State.panX) / State.zoom,
      y: (clientY - rect.top   - State.panY) / State.zoom,
    };
  }

  function paintFog(clientX, clientY) {
    if (!State.fogEnabled) return;
    const canvas = $('fog-canvas');
    if (!canvas || !canvas.width) return;
    const { x, y } = screenToWorld(clientX, clientY);
    const r = State.fogBrushSize * State.gridCellSize * 0.5;
    const ctx = canvas.getContext('2d');
    if (State.fogTool === 'reveal') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function updateCursor(clientX, clientY) {
    if (!cursor) return;
    if (State.fogPainting) {
      const r = State.fogBrushSize * State.gridCellSize * State.zoom * 0.5;
      cursor.style.display = 'block';
      cursor.style.width  = r * 2 + 'px';
      cursor.style.height = r * 2 + 'px';
      cursor.style.left   = clientX + 'px';
      cursor.style.top    = clientY  + 'px';
    } else {
      cursor.style.display = 'none';
    }
  }

  vp.addEventListener('mousedown', (e) => {
    if (!State.fogEnabled || !State.fogPainting) return;
    if (e.target.closest('.vtt-token')) return;
    if (e.button === 0) { painting = true; paintFog(e.clientX, e.clientY); }
    if (e.button === 2) {
      State.fogPainting = false;
      vp.classList.remove('fog-painting');
      if (cursor) cursor.style.display = 'none';
    }
  });

  window.addEventListener('mousemove', (e) => {
    updateCursor(e.clientX, e.clientY);
    if (painting && State.fogPainting) paintFog(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', (e) => {
    if (painting) { painting = false; savePhase2(); }
  });

  vp.addEventListener('contextmenu', (e) => {
    if (State.fogPainting) { e.preventDefault(); State.fogPainting = false; vp.classList.remove('fog-painting'); if (cursor) cursor.style.display = 'none'; }
  });

  // Clicking the fog toggle in the toolbar enters painting mode
  $('btn-fog-toggle')?.addEventListener('click', () => {
    if (!State.fogEnabled) return;
    State.fogPainting = !State.fogPainting;
    vp.classList.toggle('fog-painting', State.fogPainting);
    if (!State.fogPainting && cursor) cursor.style.display = 'none';
    showToast(State.fogPainting ? 'Mode peinture brouillard — Clic droit pour quitter' : 'Mode peinture désactivé', 'info', '🌫');
  });

  // ESC exits painting mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && State.fogPainting) {
      State.fogPainting = false;
      vp.classList.remove('fog-painting');
      if (cursor) cursor.style.display = 'none';
    }
  });
}

// Hook loadScene to resize fog canvas after image loads
const _origLoadScene = loadScene;
// We patch by wrapping the existing loadScene call in initApp instead:
// After Phase 2 init, fog canvas is resized via the mapImg.onload → setTimeout already in loadScene.
// We additionally watch for map image load globally:
document.addEventListener('DOMContentLoaded', () => {
  const obs = new MutationObserver(() => {
    const mapImg = $('map-image');
    if (mapImg) {
      mapImg.addEventListener('load', () => {
        ensureFogCanvas();
        setTimeout(() => {
          resizeFogCanvas();
          applyFogOpacity();
          restoreFogCanvas();
        }, 80);
      });
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
});

// ══════════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initSplashParticles();
  $('btn-enter')?.addEventListener('click', enterApp);
});
