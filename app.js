// ─── Cap! — app.js ────────────────────────────────────────────────────────────
// Données stockées dans localStorage sous la clé "cap_data"
// Structure :
// {
//   lastVisit: ISO string,
//   objectives: [
//     {
//       id, title, period ("year"|"month"|"week"), periodLabel,
//       mode ("percent"|"list"),
//       progress (0–100, si percent),
//       tasks ([{id, label, done}], si list),
//       createdAt, updatedAt, archived
//     }
//   ]
// }

const STORAGE_KEY = 'cap_data';

// ─── State ───────────────────────────────────────────────────────────────────
let state = load();
let reviewQueue = []; // objectifs à passer en revue
let reviewIndex = 0;

// ─── Persistence ─────────────────────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { lastVisit: null, objectives: [] };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(isoDate) {
  if (!isoDate) return Infinity;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

function periodLabel(period) {
  const now = new Date();
  if (period === 'year') return now.getFullYear().toString();
  if (period === 'month') {
    return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  // week: numéro de semaine ISO
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `Semaine ${week} — ${now.getFullYear()}`;
}

function objectiveProgress(obj) {
  if (obj.mode === 'percent') return obj.progress || 0;
  if (!obj.tasks || obj.tasks.length === 0) return 0;
  const done = obj.tasks.filter(t => t.done).length;
  return Math.round((done / obj.tasks.length) * 100);
}

function progressColor(pct) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 40) return 'var(--yellow)';
  return 'var(--red)';
}

function periodName(p) {
  return p === 'year' ? 'Annuel' : p === 'month' ? 'Mensuel' : 'Hebdomadaire';
}

function periodIcon(p) {
  return p === 'year' ? '🎯' : p === 'month' ? '📅' : '📌';
}

// ─── Vérification bilan ──────────────────────────────────────────────────────
function checkReview() {
  const days = daysSince(state.lastVisit);
  if (days < 1) return; // visité aujourd'hui déjà
  const active = state.objectives.filter(o => !o.archived);
  if (active.length === 0) return;
  reviewQueue = active;
  reviewIndex = 0;
  showReviewModal();
}

// ─── Rendu principal ─────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  const periods = ['year', 'month', 'week'];
  const byPeriod = {};
  periods.forEach(p => {
    byPeriod[p] = state.objectives.filter(o => !o.archived && o.period === p);
  });

  app.innerHTML = `
    <header class="app-header">
      <div class="logo">Cap<span class="logo-bang">!</span></div>
      <div class="header-actions">
        <button class="btn-icon" id="btn-archive" title="Archives">⌛</button>
      </div>
    </header>

    <main class="main-content">
      ${periods.map(p => `
        <section class="period-section" data-period="${p}">
          <div class="section-header">
            <span class="section-icon">${periodIcon(p)}</span>
            <h2 class="section-title">${periodName(p)}</h2>
            <button class="btn-add" data-period="${p}" title="Ajouter un objectif">+</button>
          </div>
          <div class="objectives-list" id="list-${p}">
            ${byPeriod[p].length === 0
              ? `<p class="empty-hint">Aucun objectif ${periodName(p).toLowerCase()} — <button class="link-btn" data-period="${p}">en ajouter un</button></p>`
              : byPeriod[p].map(obj => renderCard(obj)).join('')
            }
          </div>
        </section>
      `).join('')}
    </main>

    <div class="fab-container">
      <button class="fab" id="fab-main" title="Nouvel objectif">+</button>
      <div class="fab-menu" id="fab-menu">
        <button class="fab-item" data-period="week">📌 Hebdo</button>
        <button class="fab-item" data-period="month">📅 Mensuel</button>
        <button class="fab-item" data-period="year">🎯 Annuel</button>
      </div>
    </div>
  `;

  bindMainEvents();
}

function renderCard(obj) {
  const pct = objectiveProgress(obj);
  const color = progressColor(pct);
  const isPercent = obj.mode === 'percent';

  return `
    <article class="obj-card" data-id="${obj.id}">
      <div class="obj-card-top">
        <div class="obj-info">
          <span class="obj-period-badge ${obj.period}">${periodName(obj.period)}</span>
          <h3 class="obj-title">${escHtml(obj.title)}</h3>
        </div>
        <div class="obj-actions">
          <button class="btn-icon-sm" data-action="update" data-id="${obj.id}" title="Mettre à jour">✎</button>
          <button class="btn-icon-sm" data-action="archive" data-id="${obj.id}" title="Archiver">✓</button>
          <button class="btn-icon-sm danger" data-action="delete" data-id="${obj.id}" title="Supprimer">✕</button>
        </div>
      </div>

      <div class="obj-progress-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="progress-label" style="color:${color}">${pct}%</span>
      </div>

      ${isPercent ? '' : renderTaskList(obj, false)}
    </article>
  `;
}

function renderTaskList(obj, interactive) {
  if (!obj.tasks || obj.tasks.length === 0) return '<p class="empty-tasks">Aucune tâche.</p>';
  return `
    <ul class="task-list">
      ${obj.tasks.map(t => `
        <li class="task-item ${t.done ? 'done' : ''}">
          ${interactive
            ? `<input type="checkbox" class="task-check" data-obj="${obj.id}" data-task="${t.id}" ${t.done ? 'checked' : ''}>`
            : `<span class="task-check-static ${t.done ? 'checked' : ''}"></span>`
          }
          <span class="task-label">${escHtml(t.label)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Événements principaux ───────────────────────────────────────────────────
function bindMainEvents() {
  // FAB
  const fab = document.getElementById('fab-main');
  const fabMenu = document.getElementById('fab-menu');
  fab.addEventListener('click', () => {
    fabMenu.classList.toggle('open');
  });
  document.querySelectorAll('.fab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      fabMenu.classList.remove('open');
      showAddModal(btn.dataset.period);
    });
  });

  // Boutons + dans les sections
  document.querySelectorAll('.btn-add, .link-btn').forEach(btn => {
    btn.addEventListener('click', () => showAddModal(btn.dataset.period));
  });

  // Actions sur les cartes
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'delete') confirmDelete(id);
      if (action === 'archive') archiveObj(id);
      if (action === 'update') showUpdateModal(id);
    });
  });

  // Archive
  document.getElementById('btn-archive').addEventListener('click', showArchiveModal);
}

// ─── Modal générique ─────────────────────────────────────────────────────────
function showModal(html, onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box">${html}</div>`;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('visible'));

  function close() {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => {
      overlay.remove();
      if (onClose) onClose();
    }, { once: true });
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.modal-close')?.addEventListener('click', close);

  return { close, overlay };
}

// ─── Ajout d'un objectif ─────────────────────────────────────────────────────
function showAddModal(period) {
  const { close, overlay } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Nouvel objectif <span class="period-tag">${periodName(period)}</span></h2>

    <label class="field-label">Titre</label>
    <input id="new-title" class="field-input" placeholder="Mon objectif…" maxlength="80" autofocus>

    <label class="field-label">Mode de suivi</label>
    <div class="mode-toggle">
      <button class="mode-btn active" data-mode="percent">% Pourcentage</button>
      <button class="mode-btn" data-mode="list">☑ Liste de tâches</button>
    </div>

    <div id="tasks-section" class="tasks-section hidden">
      <label class="field-label">Tâches</label>
      <div id="tasks-builder"></div>
      <div class="task-add-row">
        <input id="new-task-input" class="field-input" placeholder="Nouvelle tâche…" maxlength="100">
        <button class="btn-secondary" id="btn-add-task">Ajouter</button>
      </div>
    </div>

    <button class="btn-primary" id="btn-save-new">Créer l'objectif</button>
  `);

  let selectedMode = 'percent';
  const tasks = [];

  overlay.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.dataset.mode;
      overlay.querySelector('#tasks-section').classList.toggle('hidden', selectedMode !== 'list');
    });
  });

  function refreshTaskBuilder() {
    const builder = overlay.querySelector('#tasks-builder');
    builder.innerHTML = tasks.map((t, i) => `
      <div class="task-row">
        <span class="task-check-static"></span>
        <span class="task-row-label">${escHtml(t)}</span>
        <button class="btn-remove-task" data-i="${i}">✕</button>
      </div>
    `).join('');
    builder.querySelectorAll('.btn-remove-task').forEach(b => {
      b.addEventListener('click', () => { tasks.splice(+b.dataset.i, 1); refreshTaskBuilder(); });
    });
  }

  overlay.querySelector('#btn-add-task').addEventListener('click', () => {
    const inp = overlay.querySelector('#new-task-input');
    const val = inp.value.trim();
    if (val) { tasks.push(val); inp.value = ''; refreshTaskBuilder(); }
  });
  overlay.querySelector('#new-task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('#btn-add-task').click();
  });

  overlay.querySelector('#btn-save-new').addEventListener('click', () => {
    const title = overlay.querySelector('#new-title').value.trim();
    if (!title) { shake(overlay.querySelector('#new-title')); return; }
    if (selectedMode === 'list' && tasks.length === 0) { shake(overlay.querySelector('#new-task-input')); return; }

    const obj = {
      id: uid(),
      title,
      period,
      periodLabel: periodLabel(period),
      mode: selectedMode,
      progress: 0,
      tasks: selectedMode === 'list' ? tasks.map(l => ({ id: uid(), label: l, done: false })) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false
    };
    state.objectives.push(obj);
    save();
    close();
    render();
  });
}

// ─── Mise à jour d'un objectif ───────────────────────────────────────────────
function showUpdateModal(id) {
  const obj = state.objectives.find(o => o.id === id);
  if (!obj) return;

  const isPercent = obj.mode === 'percent';
  const pct = objectiveProgress(obj);

  const { close, overlay } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Mise à jour</h2>
    <p class="modal-subtitle">${escHtml(obj.title)}</p>

    ${isPercent ? `
      <label class="field-label">Progression : <span id="pct-display">${pct}%</span></label>
      <input type="range" id="pct-slider" class="pct-slider" min="0" max="100" value="${pct}">
    ` : `
      <label class="field-label">Tâches réalisées</label>
      ${renderTaskList(obj, true)}
    `}

    <button class="btn-primary" id="btn-save-update">Enregistrer</button>
  `);

  if (isPercent) {
    const slider = overlay.querySelector('#pct-slider');
    const display = overlay.querySelector('#pct-display');
    slider.addEventListener('input', () => { display.textContent = slider.value + '%'; });
  } else {
    overlay.querySelectorAll('.task-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const task = obj.tasks.find(t => t.id === cb.dataset.task);
        if (task) task.done = cb.checked;
        const li = cb.closest('.task-item');
        li?.classList.toggle('done', cb.checked);
      });
    });
  }

  overlay.querySelector('#btn-save-update').addEventListener('click', () => {
    if (isPercent) {
      obj.progress = +overlay.querySelector('#pct-slider').value;
    }
    obj.updatedAt = new Date().toISOString();
    save();
    close();
    render();
  });
}

// ─── Modal Bilan ─────────────────────────────────────────────────────────────
function showReviewModal() {
  if (reviewIndex >= reviewQueue.length) {
    state.lastVisit = new Date().toISOString();
    save();
    render();
    // Toast
    showToast('✓ Bilan terminé ! Continue comme ça 🎯');
    return;
  }

  const obj = reviewQueue[reviewIndex];
  const isPercent = obj.mode === 'percent';
  const pct = objectiveProgress(obj);

  const { close, overlay } = showModal(`
    <div class="review-header">
      <span class="review-counter">${reviewIndex + 1} / ${reviewQueue.length}</span>
      <span class="review-tag ${obj.period}">${periodIcon(obj.period)} ${periodName(obj.period)}</span>
    </div>
    <h2 class="modal-title review-title">Point objectif</h2>
    <p class="modal-subtitle">${escHtml(obj.title)}</p>

    <div class="review-current">
      <span class="review-pct-badge" style="color:${progressColor(pct)}">${pct}%</span>
      <span class="review-pct-label">actuellement</span>
    </div>

    ${isPercent ? `
      <label class="field-label">Nouvelle progression : <span id="review-pct-display">${pct}%</span></label>
      <input type="range" id="review-slider" class="pct-slider" min="0" max="100" value="${pct}">
    ` : `
      <label class="field-label">Cochez les tâches réalisées</label>
      ${renderTaskList(obj, true)}
    `}

    <div class="review-actions">
      <button class="btn-secondary" id="btn-review-skip">Passer</button>
      <button class="btn-primary" id="btn-review-save">Suivant →</button>
    </div>
  `);

  if (isPercent) {
    const slider = overlay.querySelector('#review-slider');
    const display = overlay.querySelector('#review-pct-display');
    slider.addEventListener('input', () => { display.textContent = slider.value + '%'; });
  } else {
    overlay.querySelectorAll('.task-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const task = obj.tasks.find(t => t.id === cb.dataset.task);
        if (task) task.done = cb.checked;
        const li = cb.closest('.task-item');
        li?.classList.toggle('done', cb.checked);
      });
    });
  }

  overlay.querySelector('#btn-review-save').addEventListener('click', () => {
    if (isPercent) {
      obj.progress = +overlay.querySelector('#review-slider').value;
    }
    obj.updatedAt = new Date().toISOString();
    save();
    close();
    reviewIndex++;
    showReviewModal();
  });

  overlay.querySelector('#btn-review-skip').addEventListener('click', () => {
    close();
    reviewIndex++;
    showReviewModal();
  });
}

// ─── Archive ─────────────────────────────────────────────────────────────────
function archiveObj(id) {
  const obj = state.objectives.find(o => o.id === id);
  if (!obj) return;
  obj.archived = true;
  obj.updatedAt = new Date().toISOString();
  save();
  render();
  showToast('Objectif archivé ✓');
}

function showArchiveModal() {
  const archived = state.objectives.filter(o => o.archived);
  const { close } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Archives</h2>
    ${archived.length === 0
      ? '<p class="empty-hint">Aucun objectif archivé.</p>'
      : archived.map(obj => {
          const pct = objectiveProgress(obj);
          return `
            <div class="archive-item">
              <div class="archive-item-info">
                <span class="obj-period-badge ${obj.period}">${periodName(obj.period)}</span>
                <span class="archive-title">${escHtml(obj.title)}</span>
              </div>
              <span class="archive-pct" style="color:${progressColor(pct)}">${pct}%</span>
              <button class="btn-icon-sm" data-restore="${obj.id}" title="Restaurer">↩</button>
              <button class="btn-icon-sm danger" data-del="${obj.id}" title="Supprimer définitivement">✕</button>
            </div>
          `;
        }).join('')
    }
  `);

  document.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', () => {
      const obj = state.objectives.find(o => o.id === btn.dataset.restore);
      if (obj) { obj.archived = false; save(); close(); render(); }
    });
  });
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.objectives = state.objectives.filter(o => o.id !== btn.dataset.del);
      save(); close(); render();
    });
  });
}

function confirmDelete(id) {
  const obj = state.objectives.find(o => o.id === id);
  if (!obj) return;
  const { close } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Supprimer ?</h2>
    <p class="modal-subtitle">« ${escHtml(obj.title)} » sera supprimé définitivement.</p>
    <div class="review-actions">
      <button class="btn-secondary" id="btn-cancel-del">Annuler</button>
      <button class="btn-danger" id="btn-confirm-del">Supprimer</button>
    </div>
  `);
  document.getElementById('btn-cancel-del').addEventListener('click', close);
  document.getElementById('btn-confirm-del').addEventListener('click', () => {
    state.objectives = state.objectives.filter(o => o.id !== id);
    save(); close(); render();
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => {
    t.classList.remove('visible');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, 2800);
}

function shake(el) {
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Mettre à jour lastVisit si besoin (première fois ou nouveau jour)
  const wasToday = state.lastVisit && state.lastVisit.slice(0, 10) === today();

  render();

  if (!wasToday && state.objectives.filter(o => !o.archived).length > 0) {
    setTimeout(() => checkReview(), 600);
  }

  state.lastVisit = new Date().toISOString();
  save();
}

document.addEventListener('DOMContentLoaded', init);
