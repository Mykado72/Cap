// ─── Cap! — app.js ────────────────────────────────────────────────────────────
// ⚠️  Remplacer BACKEND_URL par votre URL Railway une fois déployé
const BACKEND_URL = 'https://cap-backend-production-3b1c.up.railway.app'; // ← à changer

const STORAGE_KEY = 'cap_data';
const NOTIF_KEY   = 'cap_notif';

// ─── State ───────────────────────────────────────────────────────────────────
let state      = load();
let notifState = loadNotif();
let reviewQueue = [];
let reviewIndex  = 0;

// ─── Persistence ─────────────────────────────────────────────────────────────
function load() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return { lastVisit: null, objectives: [] };
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function loadNotif() {
  try { const r = localStorage.getItem(NOTIF_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return { enabled: false, notifyAt: '20:00', endpoint: null };
}
function saveNotif() { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifState)); }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function today() { return new Date().toISOString().slice(0, 10); }
function daysSince(d) { if (!d) return Infinity; return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
function periodLabel(p) {
  const n = new Date();
  if (p === 'year') return n.getFullYear().toString();
  if (p === 'month') return n.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `Semaine ${Math.ceil((((d - ys) / 86400000) + 1) / 7)} — ${n.getFullYear()}`;
}
function objectiveProgress(o) {
  if (o.mode === 'percent') return o.progress || 0;
  if (!o.tasks?.length) return 0;
  return Math.round((o.tasks.filter(t => t.done).length / o.tasks.length) * 100);
}
function progressColor(p) { return p >= 80 ? 'var(--green)' : p >= 40 ? 'var(--yellow)' : 'var(--red)'; }
function periodName(p) { return p === 'year' ? 'Annuel' : p === 'month' ? 'Mensuel' : 'Hebdomadaire'; }
function periodIcon(p)  { return p === 'year' ? '🎯' : p === 'month' ? '📅' : '📌'; }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── Review ───────────────────────────────────────────────────────────────────
function checkReview() {
  if (daysSince(state.lastVisit) < 1) return;
  const active = state.objectives.filter(o => !o.archived);
  if (!active.length) return;
  reviewQueue = active; reviewIndex = 0; showReviewModal();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const periods = ['year', 'month', 'week'];
  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <div class="logo">Cap<span class="logo-bang">!</span></div>
      <div class="header-actions">
        <button class="btn-icon" id="btn-archive">⌛</button>
        <button class="btn-icon" id="btn-settings">⚙</button>
      </div>
    </header>
    <main class="main-content">
      ${periods.map(p => {
        const list = state.objectives.filter(o => !o.archived && o.period === p);
        return `
          <section class="period-section">
            <div class="section-header">
              <span class="section-icon">${periodIcon(p)}</span>
              <h2 class="section-title">${periodName(p)}</h2>
              <button class="btn-add" data-period="${p}">+</button>
            </div>
            <div class="objectives-list">
              ${list.length === 0
                ? `<p class="empty-hint">Aucun objectif — <button class="link-btn" data-period="${p}">en ajouter un</button></p>`
                : list.map(renderCard).join('')}
            </div>
          </section>`;
      }).join('')}
    </main>
    <div class="fab-container">
      <button class="fab" id="fab-main">+</button>
      <div class="fab-menu" id="fab-menu">
        <button class="fab-item" data-period="week">📌 Hebdo</button>
        <button class="fab-item" data-period="month">📅 Mensuel</button>
        <button class="fab-item" data-period="year">🎯 Annuel</button>
      </div>
    </div>`;
  bindEvents();
}

function renderCard(obj) {
  const pct = objectiveProgress(obj), color = progressColor(pct);
  return `
    <article class="obj-card">
      <div class="obj-card-top">
        <div class="obj-info">
          <span class="obj-period-badge ${obj.period}">${periodName(obj.period)}</span>
          <h3 class="obj-title">${esc(obj.title)}</h3>
        </div>
        <div class="obj-actions">
          <button class="btn-icon-sm" data-action="update"  data-id="${obj.id}">✎</button>
          <button class="btn-icon-sm" data-action="archive" data-id="${obj.id}">✓</button>
          <button class="btn-icon-sm danger" data-action="delete" data-id="${obj.id}">✕</button>
        </div>
      </div>
      <div class="obj-progress-wrap">
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="progress-label" style="color:${color}">${pct}%</span>
      </div>
      ${obj.mode === 'list' ? renderTaskList(obj, false) : ''}
    </article>`;
}

function renderTaskList(obj, interactive) {
  if (!obj.tasks?.length) return '<p class="empty-tasks">Aucune tâche.</p>';
  return `<ul class="task-list">${obj.tasks.map(t => `
    <li class="task-item ${t.done ? 'done' : ''}">
      ${interactive
        ? `<input type="checkbox" class="task-check" data-obj="${obj.id}" data-task="${t.id}" ${t.done ? 'checked' : ''}>`
        : `<span class="task-check-static ${t.done ? 'checked' : ''}"></span>`}
      <span class="task-label">${esc(t.label)}</span>
    </li>`).join('')}</ul>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────
function bindEvents() {
  const fab = document.getElementById('fab-main'), fabMenu = document.getElementById('fab-menu');
  fab.addEventListener('click', () => fabMenu.classList.toggle('open'));
  document.querySelectorAll('.fab-item, .btn-add, .link-btn').forEach(b =>
    b.addEventListener('click', () => { fabMenu.classList.remove('open'); showAddModal(b.dataset.period); }));
  document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const { action, id } = b.dataset;
    if (action === 'delete')  confirmDelete(id);
    if (action === 'archive') { archiveObj(id); }
    if (action === 'update')  showUpdateModal(id);
  }));
  document.getElementById('btn-archive').addEventListener('click', showArchiveModal);
  document.getElementById('btn-settings').addEventListener('click', showSettingsModal);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function showModal(html, onClose) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal-box">${html}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('visible'));
  function close() {
    ov.classList.remove('visible');
    ov.addEventListener('transitionend', () => { ov.remove(); onClose?.(); }, { once: true });
  }
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.modal-close')?.addEventListener('click', close);
  return { close, overlay: ov };
}

// ─── Add ──────────────────────────────────────────────────────────────────────
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
        <button class="btn-secondary small" id="btn-add-task">Ajouter</button>
      </div>
    </div>
    <button class="btn-primary" id="btn-save-new">Créer l'objectif</button>`);

  let mode = 'percent'; const tasks = [];
  overlay.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => {
    overlay.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
    mode = b.dataset.mode; overlay.querySelector('#tasks-section').classList.toggle('hidden', mode !== 'list');
  }));
  const refreshTasks = () => {
    const el = overlay.querySelector('#tasks-builder');
    el.innerHTML = tasks.map((t, i) => `
      <div class="task-row">
        <span class="task-check-static"></span>
        <span class="task-row-label">${esc(t)}</span>
        <button class="btn-remove-task" data-i="${i}">✕</button>
      </div>`).join('');
    el.querySelectorAll('.btn-remove-task').forEach(b => b.addEventListener('click', () => { tasks.splice(+b.dataset.i, 1); refreshTasks(); }));
  };
  overlay.querySelector('#btn-add-task').addEventListener('click', () => {
    const inp = overlay.querySelector('#new-task-input'), v = inp.value.trim();
    if (v) { tasks.push(v); inp.value = ''; refreshTasks(); }
  });
  overlay.querySelector('#new-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#btn-add-task').click(); });
  overlay.querySelector('#btn-save-new').addEventListener('click', () => {
    const title = overlay.querySelector('#new-title').value.trim();
    if (!title) { shake(overlay.querySelector('#new-title')); return; }
    if (mode === 'list' && !tasks.length) { shake(overlay.querySelector('#new-task-input')); return; }
    state.objectives.push({ id: uid(), title, period, periodLabel: periodLabel(period), mode, progress: 0,
      tasks: mode === 'list' ? tasks.map(l => ({ id: uid(), label: l, done: false })) : [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archived: false });
    save(); close(); render();
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────
function showUpdateModal(id) {
  const obj = state.objectives.find(o => o.id === id); if (!obj) return;
  const pct = objectiveProgress(obj);
  const { close, overlay } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Mise à jour</h2>
    <p class="modal-subtitle">${esc(obj.title)}</p>
    ${obj.mode === 'percent' ? `
      <label class="field-label">Progression : <span id="pd">${pct}%</span></label>
      <input type="range" id="pct-slider" class="pct-slider" min="0" max="100" value="${pct}">
    ` : `<label class="field-label">Tâches</label>${renderTaskList(obj, true)}`}
    <button class="btn-primary" id="btn-save-upd">Enregistrer</button>`);
  if (obj.mode === 'percent') {
    overlay.querySelector('#pct-slider').addEventListener('input', e => { overlay.querySelector('#pd').textContent = e.target.value + '%'; });
  } else {
    overlay.querySelectorAll('.task-check').forEach(cb => cb.addEventListener('change', () => {
      const t = obj.tasks.find(t => t.id === cb.dataset.task); if (t) t.done = cb.checked;
      cb.closest('.task-item')?.classList.toggle('done', cb.checked);
    }));
  }
  overlay.querySelector('#btn-save-upd').addEventListener('click', () => {
    if (obj.mode === 'percent') obj.progress = +overlay.querySelector('#pct-slider').value;
    obj.updatedAt = new Date().toISOString(); save(); close(); render();
  });
}

// ─── Review ───────────────────────────────────────────────────────────────────
function showReviewModal() {
  if (reviewIndex >= reviewQueue.length) {
    state.lastVisit = new Date().toISOString(); save(); render();
    showToast('✓ Bilan terminé ! Continue comme ça 🎯'); return;
  }
  const obj = reviewQueue[reviewIndex], pct = objectiveProgress(obj);
  const { close, overlay } = showModal(`
    <div class="review-header">
      <span class="review-counter">${reviewIndex + 1} / ${reviewQueue.length}</span>
      <span class="review-tag ${obj.period}">${periodIcon(obj.period)} ${periodName(obj.period)}</span>
    </div>
    <h2 class="modal-title">Point objectif</h2>
    <p class="modal-subtitle">${esc(obj.title)}</p>
    <div class="review-current">
      <span class="review-pct-badge" style="color:${progressColor(pct)}">${pct}%</span>
      <span class="review-pct-label">actuellement</span>
    </div>
    ${obj.mode === 'percent' ? `
      <label class="field-label">Nouvelle progression : <span id="rd">${pct}%</span></label>
      <input type="range" id="review-slider" class="pct-slider" min="0" max="100" value="${pct}">
    ` : `<label class="field-label">Tâches réalisées</label>${renderTaskList(obj, true)}`}
    <div class="review-actions">
      <button class="btn-secondary" id="btn-skip">Passer</button>
      <button class="btn-primary" id="btn-next">Suivant →</button>
    </div>`);
  if (obj.mode === 'percent') {
    overlay.querySelector('#review-slider').addEventListener('input', e => { overlay.querySelector('#rd').textContent = e.target.value + '%'; });
  } else {
    overlay.querySelectorAll('.task-check').forEach(cb => cb.addEventListener('change', () => {
      const t = obj.tasks.find(t => t.id === cb.dataset.task); if (t) t.done = cb.checked;
      cb.closest('.task-item')?.classList.toggle('done', cb.checked);
    }));
  }
  overlay.querySelector('#btn-next').addEventListener('click', () => {
    if (obj.mode === 'percent') obj.progress = +overlay.querySelector('#review-slider').value;
    obj.updatedAt = new Date().toISOString(); save(); close(); reviewIndex++; showReviewModal();
  });
  overlay.querySelector('#btn-skip').addEventListener('click', () => { close(); reviewIndex++; showReviewModal(); });
}

// ─── Archive ──────────────────────────────────────────────────────────────────
function archiveObj(id) {
  const obj = state.objectives.find(o => o.id === id); if (!obj) return;
  obj.archived = true; obj.updatedAt = new Date().toISOString(); save(); render(); showToast('Objectif archivé ✓');
}
function showArchiveModal() {
  const list = state.objectives.filter(o => o.archived);
  const { close } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Archives</h2>
    ${!list.length ? '<p class="empty-hint">Aucun objectif archivé.</p>' : list.map(obj => {
      const pct = objectiveProgress(obj);
      return `<div class="archive-item">
        <div class="archive-item-info">
          <span class="obj-period-badge ${obj.period}">${periodName(obj.period)}</span>
          <span class="archive-title">${esc(obj.title)}</span>
        </div>
        <span class="archive-pct" style="color:${progressColor(pct)}">${pct}%</span>
        <button class="btn-icon-sm" data-restore="${obj.id}">↩</button>
        <button class="btn-icon-sm danger" data-del="${obj.id}">✕</button>
      </div>`;
    }).join('')}`);
  document.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => {
    const obj = state.objectives.find(o => o.id === b.dataset.restore);
    if (obj) { obj.archived = false; save(); close(); render(); }
  }));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    state.objectives = state.objectives.filter(o => o.id !== b.dataset.del); save(); close(); render();
  }));
}
function confirmDelete(id) {
  const obj = state.objectives.find(o => o.id === id); if (!obj) return;
  const { close } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Supprimer ?</h2>
    <p class="modal-subtitle">« ${esc(obj.title)} » sera supprimé définitivement.</p>
    <div class="review-actions">
      <button class="btn-secondary" id="cc">Annuler</button>
      <button class="btn-danger" id="cd">Supprimer</button>
    </div>`);
  document.getElementById('cc').addEventListener('click', close);
  document.getElementById('cd').addEventListener('click', () => {
    state.objectives = state.objectives.filter(o => o.id !== id); save(); close(); render();
  });
}

// ─── Settings / Notifications ─────────────────────────────────────────────────
function showSettingsModal() {
  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  const { close, overlay } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Paramètres</h2>

    <div class="settings-section">
      <div class="settings-row">
        <div class="settings-label">
          <span class="settings-icon">🔔</span>
          <div>
            <div class="settings-name">Notifications push</div>
            <div class="settings-desc">Rappel quotidien pour faire le point</div>
          </div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="notif-toggle" ${notifState.enabled ? 'checked' : ''} ${!supported ? 'disabled' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>

      ${!supported ? `<p class="settings-warn">⚠️ Non supporté sur ce navigateur.<br>Sur iOS : installe l'app sur l'écran d'accueil via Safari.</p>` : ''}

      <div class="settings-row ${notifState.enabled ? '' : 'dimmed'}" id="time-row">
        <div class="settings-label">
          <span class="settings-icon">🕐</span>
          <div>
            <div class="settings-name">Heure du rappel</div>
            <div class="settings-desc">Chaque jour à cette heure (heure de Paris)</div>
          </div>
        </div>
        <input type="time" id="notif-time" class="time-input" value="${notifState.notifyAt}" ${!notifState.enabled ? 'disabled' : ''}>
      </div>

      <div class="notif-status ${notifState.enabled ? 'on' : 'off'}">
        ${notifState.enabled ? `🔔 Activées — rappel à ${notifState.notifyAt}` : '🔕 Désactivées'}
      </div>
    </div>

    <div class="settings-actions">
      <button class="btn-secondary small" id="btn-test" ${!notifState.enabled ? 'disabled' : ''}>Tester</button>
      <button class="btn-primary" id="btn-save-settings">Enregistrer</button>
    </div>`);

  const toggle = overlay.querySelector('#notif-toggle');
  const timeRow = overlay.querySelector('#time-row');
  const timeInput = overlay.querySelector('#notif-time');
  const testBtn = overlay.querySelector('#btn-test');

  toggle.addEventListener('change', () => {
    timeRow.classList.toggle('dimmed', !toggle.checked);
    timeInput.disabled = !toggle.checked;
    testBtn.disabled = !toggle.checked;
  });

  overlay.querySelector('#btn-save-settings').addEventListener('click', async () => {
    const want = toggle.checked, time = timeInput.value || '20:00';
    if (want && !notifState.enabled) {
      await enableNotifications(time, close);
    } else if (!want && notifState.enabled) {
      await disableNotifications();
      notifState.enabled = false; notifState.endpoint = null; saveNotif(); close();
      showToast('Notifications désactivées');
    } else if (want && notifState.enabled && time !== notifState.notifyAt) {
      await updateNotifTime(time);
      notifState.notifyAt = time; saveNotif(); close();
      showToast(`🕐 Rappel mis à jour à ${time}`);
    } else { close(); }
  });

  testBtn.addEventListener('click', async () => {
    if (!notifState.endpoint) return;
    testBtn.textContent = 'Envoi…'; testBtn.disabled = true;
    try {
      const r = await fetch(`${BACKEND_URL}/test-push`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: notifState.endpoint })
      });
      showToast(r.ok ? '✓ Notification de test envoyée !' : 'Erreur lors du test');
    } catch { showToast('Impossible de joindre le serveur'); }
    finally { testBtn.textContent = 'Tester'; testBtn.disabled = false; }
  });
}

// ─── Push helpers ─────────────────────────────────────────────────────────────
function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

async function enableNotifications(time, closeModal) {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('Permission refusée — vérifie les réglages'); return; }
    const keyRes = await fetch(`${BACKEND_URL}/vapid-public-key`);
    const { key } = await keyRes.json();
    const sw  = await navigator.serviceWorker.ready;
    const sub = await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key) });
    const subJson = sub.toJSON();
    await fetch(`${BACKEND_URL}/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subJson, notifyAt: time })
    });
    notifState.enabled = true; notifState.notifyAt = time; notifState.endpoint = subJson.endpoint;
    saveNotif(); closeModal(); showToast(`🔔 Notifications activées à ${time} ✓`);
  } catch (err) { console.error(err); showToast('Erreur lors de l\'activation'); }
}

async function disableNotifications() {
  try {
    if (notifState.endpoint) {
      await fetch(`${BACKEND_URL}/unsubscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: notifState.endpoint })
      });
    }
    const sw = await navigator.serviceWorker.ready;
    const sub = await sw.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (e) { console.error(e); }
}

async function updateNotifTime(time) {
  try {
    await fetch(`${BACKEND_URL}/update-time`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: notifState.endpoint, notifyAt: time })
    });
  } catch (e) { console.error(e); }
}

// ─── Toast / Shake ────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); t.addEventListener('transitionend', () => t.remove(), { once: true }); }, 2800);
}
function shake(el) { el.classList.add('shake'); el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true }); }

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  const wasToday = state.lastVisit?.slice(0, 10) === today();
  render();
  if (!wasToday && state.objectives.filter(o => !o.archived).length > 0) setTimeout(() => checkReview(), 600);
  state.lastVisit = new Date().toISOString(); save();
}
document.addEventListener('DOMContentLoaded', init);
