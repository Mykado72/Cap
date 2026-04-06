// ─── Cap! — app.js ────────────────────────────────────────────────────────────
// const BACKEND_URL = 'https://cap-backend-production-3b1c.up.railway.app';
const BACKEND_URL = 'https://cap-backend-render.onrender.com';

const STORAGE_KEY = 'cap_data';
const NOTIF_KEY   = 'cap_notif';
const HISTORY_KEY = 'cap_history';

// ─── State ────────────────────────────────────────────────────────────────────
let state      = load();
let notifState = loadNotif();
let reviewQueue = [];
let reviewIndex  = 0;

// ─── Persistence ──────────────────────────────────────────────────────────────
function load() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return { lastVisit: null, lastReview: null, objectives: [], onboardingDone: false };
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function loadNotif() {
  try { const r = localStorage.getItem(NOTIF_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return { enabled: false, notifyAt: '20:00', notifyAt2: '', endpoint: null };
}
function saveNotif() { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifState)); }

function loadHistory() {
  try { const r = localStorage.getItem(HISTORY_KEY); if (r) return JSON.parse(r); } catch (_) {}
  return [];
}
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function today() { return new Date().toISOString().slice(0, 10); }
function daysSince(d) { if (!d) return Infinity; return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

function periodLabel(p) {
  const n = new Date();
  if (p === 'day')   return n.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (p === 'year')  return n.getFullYear().toString();
  if (p === 'month') return n.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `Semaine ${Math.ceil((((d - ys) / 86400000) + 1) / 7)} — ${n.getFullYear()}`;
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - ys) / 86400000) + 1) / 7);
}

function objectiveProgress(o) {
  if (o.mode === 'percent') return o.progress || 0;
  if (!o.tasks?.length) return 0;
  return Math.round((o.tasks.filter(t => t.done).length / o.tasks.length) * 100);
}

function progressColor(p) { return p >= 80 ? 'var(--green)' : p >= 40 ? 'var(--yellow)' : 'var(--red)'; }
function periodName(p) { return p === 'day' ? 'Quotidien' : p === 'week' ? 'Hebdomadaire' : p === 'month' ? 'Mensuel' : 'Annuel'; }
function periodIcon(p)  { return p === 'day' ? '☀️' : p === 'week' ? '📌' : p === 'month' ? '📅' : '🎯'; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Streak ───────────────────────────────────────────────────────────────────
// Calcule le nombre de jours consécutifs où un bilan a été fait.
// On se base sur les snapshots de l'historique (trigger='review').
function computeStreak() {
  const history = loadHistory();
  // Récupérer les dates distinctes où un bilan a été fait (trigger review)
  const reviewDays = [...new Set(
    history
      .filter(h => h.trigger === 'review')
      .map(h => h.date.slice(0, 10))
  )].sort().reverse(); // du plus récent au plus ancien

  if (!reviewDays.length) return 0;

  // Si le dernier bilan n'est ni aujourd'hui ni hier → streak rompu
  const todayStr = today();
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (reviewDays[0] !== todayStr && reviewDays[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < reviewDays.length; i++) {
    const prev = new Date(reviewDays[i - 1]);
    const curr = new Date(reviewDays[i]);
    const diff = Math.round((prev - curr) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

// ─── Réinitialisation automatique ─────────────────────────────────────────────
function shouldReset(obj) {
  const ref = obj.lastResetAt || obj.createdAt;
  if (!ref) return false;
  const refDate = new Date(ref);
  const now = new Date();
  if (obj.period === 'day')   return ref.slice(0, 10) !== today();
  if (obj.period === 'week')  return isoWeek(now) !== isoWeek(refDate) || now.getFullYear() !== refDate.getFullYear();
  if (obj.period === 'month') return now.getMonth() !== refDate.getMonth() || now.getFullYear() !== refDate.getFullYear();
  if (obj.period === 'year')  return now.getFullYear() !== refDate.getFullYear();
  return false;
}

function snapshotObjective(obj, trigger = 'manual') {
  const history = loadHistory();
  const pct = objectiveProgress(obj);
  history.push({
    id: uid(),
    date: new Date().toISOString(),
    objectiveId: obj.id,
    title: obj.title,
    period: obj.period,
    mode: obj.mode,
    progress: pct,
    tasks: obj.mode === 'list' ? obj.tasks.map(t => ({ ...t })) : [],
    status: pct >= 100 ? 'atteint' : pct >= 50 ? 'partiel' : 'insuffisant',
    trigger,
    note: (obj.journal || []).find(e => e.date?.slice(0,10) === today())?.note || ''
  });
  saveHistory(history);
}

function resetObjective(obj) {
  obj.progress = 0;
  if (obj.tasks) obj.tasks = obj.tasks.map(t => ({ ...t, done: false }));
  obj.lastResetAt = new Date().toISOString();
  obj.updatedAt   = new Date().toISOString();
  obj.journal     = [];
}

function autoReset() {
  const active = state.objectives.filter(o => !o.archived);
  let changed = false;
  active.forEach(obj => {
    if (shouldReset(obj)) {
      snapshotObjective(obj, 'auto');
      resetObjective(obj);
      changed = true;
    }
  });
  if (changed) save();
  return changed;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { emoji: '🚭', title: "J'arrête de fumer", period: 'year', mode: 'list',
    tasks: ["Ne pas acheter de cigarettes aujourd'hui","Appeler un proche si envie forte","Télécharger une app d'aide au sevrage","Consulter un médecin ou tabacologue"] },
  { emoji: '🚬', title: "Je réduis ma consommation de tabac", period: 'month', mode: 'list',
    tasks: ["Passer de 20 à 15 cigarettes/jour cette semaine","Eviter de fumer après les repas","Repousser la première cigarette d'1h chaque matin","Tenir un journal de ma consommation"] },
  { emoji: '🍎', title: "J'arrête de grignoter", period: 'month', mode: 'list',
    tasks: ["Préparer des encas sains à la maison","Ne pas acheter de biscuits ou chips","Boire un grand verre d'eau avant de craquer","Identifier mes déclencheurs (stress, ennui…)"] },
  { emoji: '❤️', title: "Prendre soin de ma santé", period: 'year', mode: 'list',
    tasks: ["Prendre rendez-vous chez le médecin généraliste","Faire une prise de sang annuelle","Consulter le dentiste","Faire contrôler ma vue","Consulter le dermatologue"] },
  { emoji: '🏃', title: "Bouger davantage", period: 'month', mode: 'list',
    tasks: ["Marcher 30 min par jour","Prendre les escaliers plutôt que l'ascenseur","M'inscrire à une activité sportive","Faire du vélo ou de la course le week-end"] },
  { emoji: '😴', title: "Mieux dormir", period: 'month', mode: 'list',
    tasks: ["Me coucher avant minuit","Arrêter les écrans 30 min avant de dormir","Garder une heure de réveil fixe","Créer une routine du soir apaisante"] },
  { emoji: '💰', title: "Mieux gérer mon budget", period: 'month', mode: 'list',
    tasks: ["Noter toutes mes dépenses cette semaine","Préparer mes repas plutôt que commander","Annuler les abonnements inutilisés","Mettre de côté 10% de mes revenus"] },
  { emoji: '📵', title: "Réduire le temps d'écran", period: 'month', mode: 'list',
    tasks: ["Limiter les réseaux sociaux à 30 min/jour","Pas de téléphone pendant les repas","Mode avion une heure avant de dormir","Lire un livre à la place du scroll"] },
  { emoji: '🧘', title: "Prendre du temps pour moi", period: 'month', mode: 'percent', tasks: [] },
  { emoji: '📚', title: "Lire davantage", period: 'month', mode: 'list',
    tasks: ["Lire 20 pages par jour","Toujours avoir un livre en cours","Rejoindre un club de lecture","Finir un livre ce mois-ci"] },
  // ── Hebdomadaires ──
  { emoji: '🥗', title: "Manger équilibré cette semaine", period: 'week', mode: 'list',
    tasks: ["Cuisiner maison au moins 4 repas","Manger 5 fruits/légumes par jour","Éviter la junk food","Préparer ma liste de courses"] },
  { emoji: '🏋️', title: "Faire du sport cette semaine", period: 'week', mode: 'list',
    tasks: ["3 séances de sport minimum","Marcher 8000 pas/jour","Faire 15 min d'étirements","Aller à la piscine ou courir"] },
  { emoji: '🧹', title: "Organiser mon espace de vie", period: 'week', mode: 'list',
    tasks: ["Faire le ménage complet","Désencombrer un tiroir ou placard","Faire la lessive","Préparer mes affaires pour la semaine"] },
  { emoji: '🤝', title: "Entretenir mes relations", period: 'week', mode: 'list',
    tasks: ["Appeler un ami ou un proche","Répondre aux messages en attente","Planifier une sortie ou un dîner","Prendre des nouvelles de ma famille"] },
  { emoji: '🎯', title: "Avancer sur mon projet perso", period: 'week', mode: 'list',
    tasks: ["Définir les 3 priorités de la semaine","Consacrer 1h/jour à mon projet","Faire un bilan vendredi","Éliminer une distraction"] },
];

function showOnboarding() {
  const selected = new Set();
  const screen = document.createElement('div');
  screen.className = 'onboard-screen';
  document.body.appendChild(screen);
  requestAnimationFrame(() => screen.classList.add('visible'));

  function refresh() {
    screen.innerHTML = `
      <div class="onboard-wrap">
        <div class="onboard-hero">
          <div class="onboard-logo">Cap<span class="logo-bang">!</span></div>
          <h1 class="onboard-title">Bienvenue 👋</h1>
          <p class="onboard-sub">Cap! est ton journal de bord personnel.<br>Choisis des objectifs pour commencer, ou crée les tiens.</p>
        </div>
        <p class="onboard-hint">Sélectionne ceux qui te parlent :</p>
        ${['year','month','week'].map(period => {
          const group = SUGGESTIONS.map((s,i)=>({...s,i})).filter(s=>s.period===period);
          if(!group.length) return '';
          const labels = {year:'🎯 Annuels', month:'📅 Mensuels', week:'📌 Hebdomadaires'};
          return `<div class="onboard-group">
            <div class="onboard-group-title">${labels[period]}</div>
            <div class="suggest-grid">
              ${group.map(s=>`
                <button class="suggest-card ${selected.has(s.i)?'selected':''}" data-i="${s.i}">
                  <span class="suggest-emoji">${s.emoji}</span>
                  <span class="suggest-label">${s.title}</span>
                  ${selected.has(s.i)?'<span class="suggest-check">✓</span>':''}
                </button>`).join('')}
            </div>
          </div>`;
        }).join('')}
        <div class="onboard-actions">
          <button class="btn-secondary" id="btn-onboard-skip">Commencer sans objectif</button>
          <button class="btn-primary ${selected.size===0?'disabled-soft':''}" id="btn-onboard-add">
            ${selected.size>0?`Ajouter (${selected.size}) →`:'Ajouter →'}
          </button>
        </div>
      </div>`;
    screen.querySelectorAll('.suggest-card').forEach(btn => {
      btn.addEventListener('click', () => { const i=+btn.dataset.i; if(selected.has(i))selected.delete(i);else selected.add(i); refresh(); });
    });
    screen.querySelector('#btn-onboard-skip').addEventListener('click', finish);
    screen.querySelector('#btn-onboard-add').addEventListener('click', () => {
      if(selected.size===0){showToast('Sélectionne au moins un objectif');return;}
      selected.forEach(i => {
        const s = SUGGESTIONS[i];
        state.objectives.push({ id:uid(), title:s.title, period:s.period, periodLabel:periodLabel(s.period),
          mode:s.mode, progress:0, tasks:s.mode==='list'?s.tasks.map(l=>({id:uid(),label:l,done:false})):[],
          createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
          lastResetAt:new Date().toISOString(), archived:false, journal:[] });
      });
      save(); finish();
    });
  }
  function finish() {
    state.onboardingDone=true; save();
    screen.classList.remove('visible');
    screen.addEventListener('transitionend', ()=>{screen.remove();render();},{once:true});
  }
  refresh();
}

// ─── Confettis 🎉 ────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;width:100%;height:100%';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#3ddc84','#5b7fff','#f5c542','#ff5f6d','#a78bfa','#f5a623','#fff'];
  const COUNT   = 120;
  const pieces  = Array.from({length: COUNT}, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * -canvas.height * 0.4 - 20,
    w:  6 + Math.random() * 8,
    h:  10 + Math.random() * 6,
    r:  Math.random() * Math.PI * 2,
    dr: (Math.random() - 0.5) * 0.25,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 1,
  }));

  let frame, start = null;
  const DURATION = 3000;

  function draw(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pieces.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.r  += p.dr;
      p.vy += 0.12; // gravité
      p.alpha = elapsed < DURATION * 0.6 ? 1 : 1 - (elapsed - DURATION * 0.6) / (DURATION * 0.4);

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (elapsed < DURATION) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }
  frame = requestAnimationFrame(draw);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const periods = ['day','week','month','year'];
  const streak = computeStreak();
  const streakHtml = streak > 0
    ? `<div class="streak-badge" title="${streak} jour${streak>1?'s':''} de suite">🔥 ${streak}</div>`
    : '';

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <div class="logo">Cap<span class="logo-bang">!</span>${streakHtml}</div>
      <div class="header-actions">
        <button class="btn-icon" id="btn-review-now" title="Faire le point">✍️</button>
        <button class="btn-icon" id="btn-history" title="Historique des bilans">📊</button>
        <button class="btn-icon" id="btn-settings" title="Paramètres">⚙</button>
      </div>
    </header>
    <main class="main-content">
      ${periods.map(p => {
        const list = state.objectives.filter(o=>!o.archived&&o.period===p);
        return `
          <section class="period-section">
            <div class="section-header">
              <span class="section-icon">${periodIcon(p)}</span>
              <h2 class="section-title">${periodName(p)}</h2>
              <button class="btn-add" data-period="${p}">+</button>
            </div>
            <div class="objectives-list sortable-list" data-period="${p}">
              ${list.length===0
                ?`<p class="empty-hint">Aucun objectif — <button class="link-btn" data-period="${p}">en ajouter un</button></p>`
                :list.map(renderCard).join('')}
            </div>
          </section>`;
      }).join('')}
    </main>
    <div class="fab-container">
      <button class="fab" id="fab-main">+</button>
      <div class="fab-menu" id="fab-menu">
        <button class="fab-item" data-period="day">☀️ Quotidien</button>
        <button class="fab-item" data-period="week">📌 Hebdo</button>
        <button class="fab-item" data-period="month">📅 Mensuel</button>
        <button class="fab-item" data-period="year">🎯 Annuel</button>
      </div>
    </div>`;
  bindEvents();
  initDragAndDrop();
}

function renderCard(obj) {
  const pct=objectiveProgress(obj), color=progressColor(pct);
  const journalCount=(obj.journal||[]).filter(e=>e.note).length;
  return `
    <article class="obj-card" data-id="${obj.id}" draggable="true">
      <div class="obj-card-top">
        <div class="drag-handle" title="Réordonner">⠿</div>
        <div class="obj-info">
          <span class="obj-period-badge ${obj.period}">${periodName(obj.period)}</span>
          <h3 class="obj-title">${esc(obj.title)}</h3>
        </div>
        <div class="obj-actions">
          <button class="btn-icon-sm journal-btn ${journalCount>0?'has-notes':''}" data-journal="${obj.id}" title="Journal">📓</button>
          <button class="btn-icon-sm" data-action="edit" data-id="${obj.id}" title="Modifier l'objectif">✎</button>
          <button class="btn-icon-sm danger" data-action="delete" data-id="${obj.id}" title="Supprimer">✕</button>
        </div>
      </div>
      <div class="obj-progress-wrap">
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="progress-label" style="color:${color}">${pct}%</span>
      </div>
      ${obj.mode==='list'?renderTaskList(obj,true):''}
      ${journalCount>0?renderLastJournalEntry(obj):''}
    </article>`;
}

function renderLastJournalEntry(obj) {
  const entries=(obj.journal||[]).filter(e=>e.note);
  if(!entries.length) return '';
  const last=entries[entries.length-1];
  return `
    <div class="journal-preview" data-journal="${obj.id}">
      <span class="journal-preview-icon">📓</span>
      <div class="journal-preview-body">
        <span class="journal-preview-date">${formatDate(last.date)}</span>
        <p class="journal-preview-text">${esc(last.note)}</p>
      </div>
    </div>`;
}

function renderTaskList(obj, interactive) {
  if(!obj.tasks?.length) return '<p class="empty-tasks">Aucune tâche.</p>';
  return `<ul class="task-list">${obj.tasks.map(t=>`
    <li class="task-item ${t.done?'done':''}">
      ${interactive
        ?`<input type="checkbox" class="task-check" data-obj="${obj.id}" data-task="${t.id}" ${t.done?'checked':''}>`
        :`<span class="task-check-static ${t.done?'checked':''}"></span>`}
      <span class="task-label">${esc(t.label)}</span>
    </li>`).join('')}</ul>`;
}

// ─── Events ───────────────────────────────────────────────────────────────────
function bindEvents() {
  const fab=document.getElementById('fab-main'), fabMenu=document.getElementById('fab-menu');
  fab.addEventListener('click',()=>fabMenu.classList.toggle('open'));
  document.querySelectorAll('.fab-item,.btn-add,.link-btn').forEach(b=>
    b.addEventListener('click',()=>{fabMenu.classList.remove('open');showAddModal(b.dataset.period);}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const{action,id}=b.dataset;
    if(action==='delete') confirmDelete(id);
    if(action==='edit')   showEditModal(id);
  }));
  document.querySelectorAll('[data-journal]').forEach(el=>
    el.addEventListener('click',e=>{e.stopPropagation();showJournalModal(el.dataset.journal);}));
  document.querySelectorAll('.task-check[data-obj]').forEach(cb=>{
    cb.addEventListener('change',e=>{
      e.stopPropagation();
      const obj=state.objectives.find(o=>o.id===cb.dataset.obj);
      const task=obj?.tasks?.find(t=>t.id===cb.dataset.task);
      if(task){
        task.done=cb.checked;
        cb.closest('.task-item')?.classList.toggle('done',cb.checked);
        const card=cb.closest('.obj-card');
        const pct=objectiveProgress(obj), color=progressColor(pct);
        const fill=card?.querySelector('.progress-bar-fill');
        if(fill){fill.style.width=pct+'%';fill.style.background=color;}
        const lbl=card?.querySelector('.progress-label');
        if(lbl){lbl.textContent=pct+'%';lbl.style.color=color;}
        if(pct===100) launchConfetti();
        save();
      }
    });
  });
  document.getElementById('btn-review-now').addEventListener('click',()=>startReview());
  document.getElementById('btn-history').addEventListener('click',showHistoryModal);
  document.getElementById('btn-settings').addEventListener('click',showSettingsModal);
}

// ─── Modal générique ──────────────────────────────────────────────────────────
function showModal(html, onClose) {
  const ov=document.createElement('div');
  ov.className='modal-overlay';
  ov.innerHTML=`<div class="modal-box">${html}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add('visible'));
  function close(){
    ov.classList.remove('visible');
    ov.addEventListener('transitionend',()=>{ov.remove();onClose?.();},{once:true});
  }
  ov.addEventListener('click',e=>{if(e.target===ov)close();});
  ov.querySelector('.modal-close')?.addEventListener('click',close);
  return{close,overlay:ov};
}

// ─── Ajout ────────────────────────────────────────────────────────────────────
function showAddModal(period) {
  const{close,overlay}=showModal(`
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

  let mode='percent'; const tasks=[];
  overlay.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>{
    overlay.querySelectorAll('.mode-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    mode=b.dataset.mode;overlay.querySelector('#tasks-section').classList.toggle('hidden',mode!=='list');
  }));
  const refreshTasks=()=>{
    const el=overlay.querySelector('#tasks-builder');
    el.innerHTML=tasks.map((t,i)=>`
      <div class="task-row">
        <span class="task-check-static"></span>
        <span class="task-row-label">${esc(t)}</span>
        <button class="btn-remove-task" data-i="${i}">✕</button>
      </div>`).join('');
    el.querySelectorAll('.btn-remove-task').forEach(b=>b.addEventListener('click',()=>{tasks.splice(+b.dataset.i,1);refreshTasks();}));
  };
  overlay.querySelector('#btn-add-task').addEventListener('click',()=>{
    const inp=overlay.querySelector('#new-task-input'),v=inp.value.trim();
    if(v){tasks.push(v);inp.value='';refreshTasks();}
  });
  overlay.querySelector('#new-task-input').addEventListener('keydown',e=>{if(e.key==='Enter')overlay.querySelector('#btn-add-task').click();});
  overlay.querySelector('#btn-save-new').addEventListener('click',()=>{
    const title=overlay.querySelector('#new-title').value.trim();
    if(!title){shake(overlay.querySelector('#new-title'));return;}
    if(mode==='list'&&!tasks.length){shake(overlay.querySelector('#new-task-input'));return;}
    state.objectives.push({id:uid(),title,period,periodLabel:periodLabel(period),mode,progress:0,
      tasks:mode==='list'?tasks.map(l=>({id:uid(),label:l,done:false})):[],
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      lastResetAt:new Date().toISOString(),archived:false,journal:[]});
    save();close();render();
  });
}

// ─── Édition complète d'un objectif ──────────────────────────────────────────
function showEditModal(id) {
  const obj = state.objectives.find(o=>o.id===id); if(!obj) return;

  // Copies locales éditables
  let localTitle  = obj.title;
  let localPeriod = obj.period;
  let localMode   = obj.mode;
  let localPct    = obj.progress || 0;
  let localTasks  = obj.tasks ? obj.tasks.map(t=>({...t})) : [];

  const periods = ['day','week','month','year'];

  const {close, overlay} = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Modifier l'objectif</h2>

    <label class="field-label">Titre</label>
    <input id="edit-title" class="field-input" value="${esc(obj.title)}" maxlength="80">

    <label class="field-label">Période</label>
    <div class="period-toggle">
      ${periods.map(p=>`
        <button class="period-btn ${p===obj.period?'active':''}" data-p="${p}">
          ${periodIcon(p)} ${periodName(p)}
        </button>`).join('')}
    </div>

    <label class="field-label">Mode de suivi</label>
    <div class="mode-toggle">
      <button class="mode-btn ${obj.mode==='percent'?'active':''}" data-mode="percent">% Pourcentage</button>
      <button class="mode-btn ${obj.mode==='list'?'active':''}" data-mode="list">☑ Liste de tâches</button>
    </div>

    <div id="edit-percent-section" class="${obj.mode==='percent'?'':'hidden'}">
      <label class="field-label">Progression actuelle : <span id="edit-pct-display">${localPct}%</span></label>
      <input type="range" id="edit-pct-slider" class="pct-slider" min="0" max="100" value="${localPct}">
    </div>

    <div id="edit-tasks-section" class="${obj.mode==='list'?'':'hidden'}">
      <label class="field-label">Tâches <span style="color:var(--text3);font-weight:400;font-size:.75rem">(glisser pour réordonner)</span></label>
      <div id="edit-tasks-list" class="edit-tasks-sortable"></div>
      <div class="task-add-row" style="margin-top:8px">
        <input id="edit-task-input" class="field-input" placeholder="Nouvelle tâche…" maxlength="100">
        <button class="btn-secondary small" id="btn-edit-add-task">Ajouter</button>
      </div>
    </div>

    <button class="btn-primary" id="btn-save-edit">Enregistrer</button>`);

  // ── Titre
  overlay.querySelector('#edit-title').addEventListener('input', e => { localTitle = e.target.value; });

  // ── Période
  overlay.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      localPeriod = btn.dataset.p;
    });
  });

  // ── Mode
  overlay.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      localMode = btn.dataset.mode;
      overlay.querySelector('#edit-percent-section').classList.toggle('hidden', localMode !== 'percent');
      overlay.querySelector('#edit-tasks-section').classList.toggle('hidden', localMode !== 'list');
    });
  });

  // ── Slider %
  overlay.querySelector('#edit-pct-slider').addEventListener('input', e => {
    localPct = +e.target.value;
    overlay.querySelector('#edit-pct-display').textContent = localPct + '%';
  });

  // ── Liste de tâches avec drag interne
  function rebuildTaskList() {
    const list = overlay.querySelector('#edit-tasks-list');
    list.innerHTML = localTasks.map((t,i) => `
      <div class="task-edit-row" draggable="true" data-i="${i}">
        <span class="drag-handle-sm">⠿</span>
        <input type="checkbox" class="task-check edit-task-cb" data-i="${i}" ${t.done?'checked':''}>
        <span class="task-edit-label">${esc(t.label)}</span>
        <button class="btn-remove-task edit-task-del" data-i="${i}">✕</button>
      </div>`).join('');

    // Checkboxes
    list.querySelectorAll('.edit-task-cb').forEach(cb => {
      cb.addEventListener('change', () => { localTasks[+cb.dataset.i].done = cb.checked; });
    });
    // Supprimer
    list.querySelectorAll('.edit-task-del').forEach(btn => {
      btn.addEventListener('click', () => { localTasks.splice(+btn.dataset.i, 1); rebuildTaskList(); });
    });
    // Drag interne pour réordonner les tâches
    let dragIdx = null;
    list.querySelectorAll('.task-edit-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragIdx = +row.dataset.i;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drag-over-task'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over-task'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('drag-over-task');
        const targetIdx = +row.dataset.i;
        if (dragIdx === null || dragIdx === targetIdx) return;
        const [moved] = localTasks.splice(dragIdx, 1);
        localTasks.splice(targetIdx, 0, moved);
        rebuildTaskList();
      });
    });
  }
  rebuildTaskList();

  // Ajouter tâche
  const addInp = overlay.querySelector('#edit-task-input');
  overlay.querySelector('#btn-edit-add-task').addEventListener('click', () => {
    const v = addInp.value.trim();
    if (v) { localTasks.push({id:uid(),label:v,done:false}); addInp.value=''; rebuildTaskList(); }
  });
  addInp.addEventListener('keydown', e => { if(e.key==='Enter') overlay.querySelector('#btn-edit-add-task').click(); });

  // ── Sauvegarder
  overlay.querySelector('#btn-save-edit').addEventListener('click', () => {
    const newTitle = overlay.querySelector('#edit-title').value.trim();
    if (!newTitle) { shake(overlay.querySelector('#edit-title')); return; }
    if (localMode === 'list' && localTasks.length === 0) { shake(overlay.querySelector('#edit-task-input')); return; }

    obj.title    = newTitle;
    obj.period   = localPeriod;
    obj.mode     = localMode;
    obj.progress = localMode === 'percent' ? localPct : 0;
    obj.tasks    = localMode === 'list' ? localTasks : [];
    obj.updatedAt = new Date().toISOString();
    save(); close(); render();
    if (objectiveProgress(obj) === 100) launchConfetti();
    showToast('✓ Objectif mis à jour');
  });
}

// ─── Bilan ────────────────────────────────────────────────────────────────────
function startReview() {
  const active=state.objectives.filter(o=>!o.archived);
  if(!active.length){showToast('Aucun objectif actif à passer en revue');return;}
  reviewQueue=active;reviewIndex=0;showReviewModal();
}

function finishReview() {
  state.lastReview=new Date().toISOString();
  state.lastVisit =new Date().toISOString();
  save();
  const hadResets=autoReset();
  render();
  showToast(hadResets?'✓ Bilan terminé ! Certains objectifs ont été réinitialisés 🔄':'✓ Bilan terminé ! Continue comme ça 🎯');
}

function showReviewModal() {
  if(reviewIndex>=reviewQueue.length){finishReview();return;}
  const obj=reviewQueue[reviewIndex],pct=objectiveProgress(obj);
  const todayEntry=(obj.journal||[]).find(e=>e.date?.slice(0,10)===today());
  const lastNote=todayEntry?.note||'';
  const{close,overlay}=showModal(`
    <div class="review-header">
      <span class="review-counter">${reviewIndex+1} / ${reviewQueue.length}</span>
      <span class="review-tag ${obj.period}">${periodIcon(obj.period)} ${periodName(obj.period)}</span>
    </div>
    <h2 class="modal-title">On fait le point ✍️</h2>
    <p class="modal-subtitle">${esc(obj.title)}</p>
    <div class="review-current">
      <span class="review-pct-badge" style="color:${progressColor(pct)}">${pct}%</span>
      <span class="review-pct-label">actuellement</span>
    </div>
    ${obj.mode==='percent'?`
      <label class="field-label">Nouvelle progression : <span id="rd">${pct}%</span></label>
      <input type="range" id="review-slider" class="pct-slider" min="0" max="100" value="${pct}">
    `:`<label class="field-label">Tâches du moment</label>${renderTaskList(obj,true)}`}
    <div class="journal-section">
      <label class="field-label journal-label">📓 Mon ressenti du jour</label>
      <textarea id="review-note" class="journal-textarea" placeholder="Comment ça se passe ?…" maxlength="1000">${esc(lastNote)}</textarea>
      <div class="journal-chars"><span id="journal-count">${lastNote.length}</span>/1000</div>
    </div>
    <div class="review-actions">
      <button class="btn-secondary" id="btn-skip">Passer</button>
      <button class="btn-primary" id="btn-next">Suivant →</button>
    </div>`);

  if(obj.mode==='percent'){
    overlay.querySelector('#review-slider').addEventListener('input',e=>{overlay.querySelector('#rd').textContent=e.target.value+'%';});
  } else {
    overlay.querySelectorAll('.task-check').forEach(cb=>cb.addEventListener('change',()=>{
      const t=obj.tasks.find(t=>t.id===cb.dataset.task);if(t)t.done=cb.checked;
      cb.closest('.task-item')?.classList.toggle('done',cb.checked);
    }));
  }
  const noteEl=overlay.querySelector('#review-note');
  noteEl.addEventListener('input',()=>{overlay.querySelector('#journal-count').textContent=noteEl.value.length;});

  overlay.querySelector('#btn-next').addEventListener('click',()=>{
    if(obj.mode==='percent')obj.progress=+overlay.querySelector('#review-slider').value;
    const note=noteEl.value.trim();
    if(!obj.journal)obj.journal=[];
    const existing=obj.journal.find(e=>e.date?.slice(0,10)===today());
    if(existing){existing.note=note;existing.pct=objectiveProgress(obj);existing.date=new Date().toISOString();}
    else{obj.journal.push({id:uid(),date:new Date().toISOString(),note,pct:objectiveProgress(obj)});}
    snapshotObjective(obj,'review');
    obj.updatedAt=new Date().toISOString();
    if(objectiveProgress(obj)===100) launchConfetti();
    save();close();reviewIndex++;showReviewModal();
  });
  overlay.querySelector('#btn-skip').addEventListener('click',()=>{close();reviewIndex++;showReviewModal();});
}

// ─── Journal ──────────────────────────────────────────────────────────────────
function showJournalModal(id) {
  const obj=state.objectives.find(o=>o.id===id);if(!obj)return;
  const entries=(obj.journal||[]).filter(e=>e.note).slice().reverse();
  showModal(`
    <button class="modal-close">✕</button>
    <div class="journal-modal-header">
      <span class="journal-modal-icon">📓</span>
      <div><h2 class="modal-title">Journal intime</h2><p class="modal-subtitle">${esc(obj.title)}</p></div>
    </div>
    ${!entries.length
      ?`<div class="journal-empty"><div class="journal-empty-icon">✍️</div><p>Aucune note pour l'instant.</p><p class="journal-empty-hint">Les notes apparaissent lors du bilan «&nbsp;On fait le point&nbsp;».</p></div>`
      :`<div class="journal-entries">${entries.map(e=>`
          <div class="journal-entry">
            <div class="journal-entry-meta">
              <span class="journal-entry-date">${formatDate(e.date)}</span>
              <span class="journal-entry-pct" style="color:${progressColor(e.pct||0)}">${e.pct||0}%</span>
            </div>
            <p class="journal-entry-text">${esc(e.note).replace(/\n/g,'<br>')}</p>
          </div>`).join('')}</div>`}`);
}

// ─── Historique global des bilans ─────────────────────────────────────────────
function showHistoryModal() {
  const history=loadHistory().slice().reverse();
  const byDate={};
  history.forEach(h=>{const d=h.date.slice(0,10);if(!byDate[d])byDate[d]=[];byDate[d].push(h);});
  const si=s=>s==='atteint'?'🏆':s==='partiel'?'📈':'📉';
  const sl=s=>s==='atteint'?'Atteint':s==='partiel'?'Partiel':'Insuffisant';
  const sc=s=>s==='atteint'?'green':s==='partiel'?'yellow':'red';
  const entries=Object.entries(byDate);

  showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Historique des bilans 📊</h2>
    ${!entries.length
      ?`<div class="journal-empty" style="margin-top:20px">
          <div class="journal-empty-icon">📊</div>
          <p>Aucun bilan enregistré.</p>
          <p class="journal-empty-hint">Les bilans apparaissent après chaque "On fait le point".</p>
        </div>`
      :entries.map(([date,items])=>`
        <div class="history-day">
          <div class="history-day-header">
            <span class="history-day-date">${new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
            <span class="history-day-count">${items.length} objectif${items.length>1?'s':''}</span>
          </div>
          ${items.map(h=>`
            <div class="history-item">
              <div class="history-item-top">
                <span class="obj-period-badge ${h.period}">${periodName(h.period)}</span>
                <span class="history-status ${sc(h.status)}">${si(h.status)} ${sl(h.status)}</span>
              </div>
              <div class="history-item-title">${esc(h.title)}</div>
              <div class="history-item-progress">
                <div class="progress-bar-bg" style="height:4px">
                  <div class="progress-bar-fill" style="width:${h.progress}%;background:${progressColor(h.progress)}"></div>
                </div>
                <span style="color:${progressColor(h.progress)};font-family:'Syne',sans-serif;font-weight:700;font-size:.82rem">${h.progress}%</span>
              </div>
              ${h.mode==='list'&&h.tasks?.length?`
                <div class="history-tasks">
                  ${h.tasks.map(t=>`<span class="history-task ${t.done?'done':''}"><span class="history-task-dot"></span>${esc(t.label)}</span>`).join('')}
                </div>`:''}
              ${h.note?`<p class="history-note">📓 ${esc(h.note).replace(/\n/g,'<br>')}</p>`:''}
            </div>`).join('')}
        </div>`).join('')}
    <div style="text-align:center;margin-top:20px;padding-bottom:4px">
      <button class="btn-danger" id="btn-clear-history" style="width:auto;padding:8px 20px;font-size:.82rem;margin-top:0">🗑 Effacer tout l'historique</button>
    </div>`);

  document.getElementById('btn-clear-history')?.addEventListener('click',()=>{
    if(!confirm("Effacer tout l'historique des bilans ?"))return;
    saveHistory([]);showToast('Historique effacé');document.querySelector('.modal-close')?.click();
  });
}

// ─── Supprimer ────────────────────────────────────────────────────────────────
function confirmDelete(id) {
  const obj=state.objectives.find(o=>o.id===id);if(!obj)return;
  const{close}=showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Supprimer ?</h2>
    <p class="modal-subtitle">« ${esc(obj.title)} » sera supprimé définitivement, ainsi que tout son journal.</p>
    <div class="review-actions">
      <button class="btn-secondary" id="cc">Annuler</button>
      <button class="btn-danger" id="cd">Supprimer</button>
    </div>`);
  document.getElementById('cc').addEventListener('click',close);
  document.getElementById('cd').addEventListener('click',()=>{
    state.objectives=state.objectives.filter(o=>o.id!==id);save();close();render();
  });
}

// ─── Paramètres ───────────────────────────────────────────────────────────────
function showSettingsModal() {
  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  // État local des deux créneaux (indépendants)
  const slot1 = { enabled: notifState.enabled,        time: notifState.notifyAt  || '20:00' };
  const slot2 = { enabled: !!notifState.notifyAt2,    time: notifState.notifyAt2 || ''      };

  function renderNotifSlot(num, slot) {
    const id = `slot${num}`;
    return `
      <div class="notif-slot" id="${id}-row">
        <div class="notif-slot-left">
          <label class="toggle-switch" style="flex-shrink:0">
            <input type="checkbox" id="${id}-toggle" ${slot.enabled ? 'checked' : ''} ${!supported ? 'disabled' : ''}>
            <span class="toggle-track"></span>
          </label>
          <div>
            <div class="settings-name">${num === 1 ? '1ère' : '2ème'} notification</div>
            <div class="settings-desc">${num === 2 ? 'Optionnelle · ' : ''}Heure de Paris</div>
          </div>
        </div>
        <div class="notif-slot-right">
          <input type="time" id="${id}-time" class="time-input"
            value="${slot.time}"
            ${!slot.enabled ? 'disabled' : ''}>
          <button class="btn-notif-apply ${slot.enabled ? '' : 'hidden'}" id="${id}-apply">✓</button>
        </div>
      </div>`;
  }

  const { close, overlay } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Paramètres</h2>

    <div class="settings-section">
      <div class="settings-group-title">🔔 Notifications push</div>
      ${!supported ? `<p class="settings-warn">⚠️ Non supporté.<br>Sur iOS : installe l'app via Safari → "Sur l'écran d'accueil".</p>` : ''}
      ${renderNotifSlot(1, slot1)}
      ${renderNotifSlot(2, slot2)}
      <button class="btn-secondary small" id="btn-test" style="margin-top:10px;width:100%;text-align:center" ${!notifState.enabled ? 'disabled' : ''}>Tester une notification</button>

      <div class="settings-row" style="margin-top:14px">
        <div class="settings-label">
          <span class="settings-icon" id="theme-icon">${isLightTheme() ? '☀️' : '🌙'}</span>
          <div><div class="settings-name">Thème</div><div class="settings-desc" id="theme-desc">${isLightTheme() ? 'Mode clair' : 'Mode sombre'}</div></div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="theme-toggle" ${isLightTheme() ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>
    </div>

    <div class="settings-clearzone">
      <div class="settings-data-actions">
        <button class="btn-data" id="btn-export">⬆️ Exporter mes données</button>
        <button class="btn-data" id="btn-import">⬇️ Importer des données</button>
      </div>
      <input type="file" id="import-file-input" accept=".json" style="display:none">
      <div class="settings-data-actions" style="margin-top:0">
        <button class="btn-data" id="btn-show-suggestions">💡 Catalogue d'objectifs</button>
        <button class="btn-data danger-data" id="btn-reset-all">🗑 Effacer toutes les données</button>
      </div>
      <a href="https://mykado72.github.io/Cap/clear-cache.html" class="btn-clear-cache" target="_blank" rel="noopener">🗑 Vider le cache de l'app</a>
    </div>`);

  // ── Helpers locaux ────────────────────────────────────────────────────────────
  function getEl(id) { return overlay.querySelector('#' + id); }

  function syncSlotUI(num) {
    const tog  = getEl(`slot${num}-toggle`);
    const inp  = getEl(`slot${num}-time`);
    const appl = getEl(`slot${num}-apply`);
    const on   = tog?.checked;
    if (inp)  inp.disabled  = !on;
    if (appl) appl.classList.toggle('hidden', !on);
  }

  // ── Créneau 1 ────────────────────────────────────────────────────────────────
  getEl('slot1-toggle')?.addEventListener('change', async () => {
    const on  = getEl('slot1-toggle').checked;
    const t   = getEl('slot1-time').value || '20:00';
    syncSlotUI(1);
    getEl('btn-test').disabled = !on;

    if (on && !notifState.enabled) {
      // Première activation : demander permission + abonnement
      await enableNotifications(t, notifState.notifyAt2 || '', close);
    } else if (!on && notifState.enabled) {
      // Désactiver complètement
      await disableNotifications();
      notifState.enabled  = false;
      notifState.endpoint = null;
      notifState.notifyAt = '';
      saveNotif();
      showToast('🔕 Notifications désactivées');
      getEl('btn-test').disabled = true;
    }
  });

  getEl('slot1-apply')?.addEventListener('click', async () => {
    const t = getEl('slot1-time').value;
    if (!t) return;
    const btn = getEl('slot1-apply');
    btn.textContent = '…'; btn.disabled = true;
    try {
      if (!notifState.enabled) {
        await enableNotifications(t, notifState.notifyAt2 || '', close);
      } else {
        await updateNotifTime(t, notifState.notifyAt2 || '');
        notifState.notifyAt = t;
        saveNotif();
        showToast(`✓ 1ère notification → ${t}`);
      }
    } finally { btn.textContent = '✓'; btn.disabled = false; }
  });

  // ── Créneau 2 ────────────────────────────────────────────────────────────────
  getEl('slot2-toggle')?.addEventListener('change', async () => {
    const on = getEl('slot2-toggle').checked;
    const t  = getEl('slot2-time').value || '';
    syncSlotUI(2);

    if (!notifState.enabled) {
      showToast('Active d\'abord la 1ère notification');
      getEl('slot2-toggle').checked = false;
      syncSlotUI(2);
      return;
    }

    const newTime2 = on ? (t || '') : '';
    if (!on) {
      // Désactiver le 2ème créneau seulement
      await updateNotifTime(notifState.notifyAt, '');
      notifState.notifyAt2 = '';
      saveNotif();
      showToast('🔕 2ème notification désactivée');
    } else if (t) {
      // Activer avec l'heure déjà renseignée
      await updateNotifTime(notifState.notifyAt, t);
      notifState.notifyAt2 = t;
      saveNotif();
      showToast(`✓ 2ème notification → ${t}`);
    }
    // Si pas d'heure, l'utilisateur doit d'abord saisir une heure et appuyer sur ✓
  });

  getEl('slot2-apply')?.addEventListener('click', async () => {
    const t = getEl('slot2-time').value;
    if (!t) { showToast('Saisis une heure d\'abord'); return; }
    if (!notifState.enabled) { showToast('Active d\'abord la 1ère notification'); return; }
    const btn = getEl('slot2-apply');
    btn.textContent = '…'; btn.disabled = true;
    try {
      await updateNotifTime(notifState.notifyAt, t);
      notifState.notifyAt2 = t;
      // S'assurer que le toggle est bien coché
      getEl('slot2-toggle').checked = true;
      saveNotif();
      showToast(`✓ 2ème notification → ${t}`);
    } finally { btn.textContent = '✓'; btn.disabled = false; }
  });

  // ── Tester ───────────────────────────────────────────────────────────────────
  getEl('btn-test')?.addEventListener('click', async () => {
    if (!notifState.endpoint) return;
    const btn = getEl('btn-test');
    btn.textContent = 'Envoi…'; btn.disabled = true;
    try {
      const r = await fetch(`${BACKEND_URL}/test-push`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: notifState.endpoint })
      });
      showToast(r.ok ? '✓ Notification de test envoyée !' : 'Erreur lors du test');
    } catch { showToast('Impossible de joindre le serveur'); }
    finally { btn.textContent = 'Tester une notification'; btn.disabled = false; }
  });

  // ── Thème ─────────────────────────────────────────────────────────────────────
  getEl('theme-toggle')?.addEventListener('change', () => {
    const light = getEl('theme-toggle').checked;
    setTheme(light);
    getEl('theme-icon').textContent = light ? '☀️' : '🌙';
    getEl('theme-desc').textContent  = light ? 'Mode clair' : 'Mode sombre';
  });

  // ── Export / Import ───────────────────────────────────────────────────────────
  getEl('btn-export')?.addEventListener('click', () => exportData());
  const fileInput = getEl('import-file-input');
  getEl('btn-import')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try { importData(e.target.result); close(); }
      catch (err) { showToast('❌ Fichier invalide ou corrompu'); console.error(err); }
    };
    reader.readAsText(file);
  });

  // ── Catalogue / Reset ─────────────────────────────────────────────────────────
  getEl('btn-show-suggestions')?.addEventListener('click', () => { close(); showSuggestionsModal(); });
  getEl('btn-reset-all')?.addEventListener('click', () => { close(); confirmResetAll(); });
}

// ─── Thème clair / sombre ─────────────────────────────────────────────────────
const THEME_KEY = 'cap_theme';

function isLightTheme() {
  return localStorage.getItem(THEME_KEY) === 'light';
}

function setTheme(light) {
  if (light) {
    document.documentElement.classList.add('light');
    localStorage.setItem(THEME_KEY, 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f4f6fb');
  } else {
    document.documentElement.classList.remove('light');
    localStorage.setItem(THEME_KEY, 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f1117');
  }
}

function applyTheme() {
  setTheme(isLightTheme());
}

// ─── Catalogue d'objectifs ────────────────────────────────────────────────────
function showSuggestionsModal() {
  const selected = new Set();
  const { close, overlay } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Catalogue d'objectifs 💡</h2>
    <p class="modal-subtitle">Sélectionne des objectifs à ajouter à ta liste.</p>
    <div class="suggest-grid" id="suggest-grid-modal" style="margin-bottom:0"></div>
    <button class="btn-primary" id="btn-add-suggestions">Ajouter →</button>`);

  function refresh() {
    const grid = overlay.querySelector('#suggest-grid-modal');
    grid.innerHTML = SUGGESTIONS.map((s, i) => `
      <button class="suggest-card ${selected.has(i) ? 'selected' : ''}" data-i="${i}">
        <span class="suggest-emoji">${s.emoji}</span>
        <span class="suggest-label">${s.title}
          <span class="suggest-period-hint">${periodIcon(s.period)} ${periodName(s.period)}</span>
        </span>
        ${selected.has(i) ? '<span class="suggest-check">✓</span>' : ''}
      </button>`).join('');
    grid.querySelectorAll('.suggest-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        if (selected.has(i)) selected.delete(i); else selected.add(i);
        refresh();
      });
    });
    const addBtn = overlay.querySelector('#btn-add-suggestions');
    addBtn.textContent = selected.size > 0 ? `Ajouter (${selected.size}) →` : 'Ajouter →';
    addBtn.style.opacity = selected.size === 0 ? '0.5' : '1';
  }
  refresh();

  overlay.querySelector('#btn-add-suggestions').addEventListener('click', () => {
    if (selected.size === 0) { showToast('Sélectionne au moins un objectif'); return; }
    selected.forEach(i => {
      const s = SUGGESTIONS[i];
      const exists = state.objectives.some(o => !o.archived && o.title === s.title && o.period === s.period);
      if (!exists) {
        state.objectives.push({
          id: uid(), title: s.title, period: s.period, periodLabel: periodLabel(s.period),
          mode: s.mode, progress: 0,
          tasks: s.mode === 'list' ? s.tasks.map(l => ({ id: uid(), label: l, done: false })) : [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          lastResetAt: new Date().toISOString(), archived: false, journal: []
        });
      }
    });
    save(); close(); render();
    showToast(`✓ ${selected.size} objectif${selected.size > 1 ? 's' : ''} ajouté${selected.size > 1 ? 's' : ''} !`);
  });
}

// ─── Effacer toutes les données ───────────────────────────────────────────────
function confirmResetAll() {
  const { close } = showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title" style="color:var(--red)">⚠️ Tout effacer ?</h2>
    <p class="modal-subtitle">Cette action supprimera <strong style="color:var(--text)">tous tes objectifs, tout l'historique et toutes tes notes</strong>. Elle est irréversible.</p>
    <p style="font-size:.82rem;color:var(--text3);margin-top:8px">Les paramètres de notifications et le thème ne seront pas effacés.</p>
    <div class="review-actions">
      <button class="btn-secondary" id="cancel-reset">Annuler</button>
      <button class="btn-danger" id="confirm-reset">Tout effacer</button>
    </div>`);
  document.getElementById('cancel-reset').addEventListener('click', close);
  document.getElementById('confirm-reset').addEventListener('click', () => {
    state = { lastVisit: null, lastReview: null, objectives: [], onboardingDone: false };
    save(); saveHistory([]); close();
    showOnboarding();
  });
}

// ─── Drag & Drop des cartes (réordonnancement) ────────────────────────────────
function initDragAndDrop() {
  let dragId = null, dragEl = null, placeholder = null;

  document.querySelectorAll('.sortable-list').forEach(list => {
    list.querySelectorAll('.obj-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        if (e.target.closest('button,input,textarea,.journal-preview')) { e.preventDefault(); return; }
        dragId = card.dataset.id; dragEl = card;
        card.classList.add('card-dragging');
        e.dataTransfer.effectAllowed = 'move';
        placeholder = document.createElement('div');
        placeholder.className = 'card-placeholder';
        placeholder.style.height = card.offsetHeight + 'px';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('card-dragging');
        placeholder?.remove(); placeholder = null; dragId = null; dragEl = null;
      });
      card.addEventListener('dragover', e => {
        e.preventDefault(); if (!dragEl || card === dragEl) return;
        const mid = card.getBoundingClientRect().top + card.offsetHeight / 2;
        card.parentNode.insertBefore(placeholder, e.clientY < mid ? card : card.nextSibling);
      });
      card.addEventListener('drop', e => {
        e.preventDefault(); if (!dragId || card.dataset.id === dragId) return;
        saveNewOrder(list);
      });
    });
    list.addEventListener('dragover', e => e.preventDefault());
  });

  // Touch drag
  document.querySelectorAll('.obj-card .drag-handle').forEach(handle => {
    let touchEl = null, clone = null, offY = 0;
    handle.addEventListener('touchstart', e => {
      const card = handle.closest('.obj-card');
      touchEl = card; card.classList.add('card-dragging');
      const rect = card.getBoundingClientRect();
      offY = rect.top - e.touches[0].clientY;
      clone = card.cloneNode(true);
      clone.style.cssText = `position:fixed;left:${rect.left}px;width:${rect.width}px;top:${rect.top}px;z-index:999;pointer-events:none;opacity:.88;transition:none;`;
      document.body.appendChild(clone);
      e.preventDefault();
    }, {passive:false});
    handle.addEventListener('touchmove', e => {
      if (!clone || !touchEl) return;
      const y = e.touches[0].clientY;
      clone.style.top = (y + offY) + 'px';
      clone.style.display = 'none';
      const target = document.elementFromPoint(e.touches[0].clientX, y)?.closest('.obj-card');
      clone.style.display = '';
      if (target && target !== touchEl) {
        const mid = target.getBoundingClientRect().top + target.offsetHeight / 2;
        target.parentNode.insertBefore(touchEl, y < mid ? target : target.nextSibling);
      }
      e.preventDefault();
    }, {passive:false});
    handle.addEventListener('touchend', () => {
      clone?.remove(); clone = null;
      if (touchEl) {
        touchEl.classList.remove('card-dragging');
        saveNewOrder(touchEl.closest('.sortable-list'));
        touchEl = null;
      }
    });
  });
}

function saveNewOrder(list) {
  if (!list) return;
  const period = list.dataset.period;
  const newOrder = [...list.querySelectorAll('.obj-card')].map(c => c.dataset.id);
  const periodObjs = state.objectives.filter(o => !o.archived && o.period === period);
  const reordered  = newOrder.map(id => periodObjs.find(o => o.id === id)).filter(Boolean);
  let pi = 0;
  state.objectives = state.objectives.map(o =>
    (!o.archived && o.period === period) ? reordered[pi++] : o
  );
  save();
}

// ─── Push helpers ─────────────────────────────────────────────────────────────
function urlB64ToUint8(b64){const pad='='.repeat((4-b64.length%4)%4);const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));return new Uint8Array([...raw].map(c=>c.charCodeAt(0)));}
async function enableNotifications(time,time2,closeModal){
  try{
    if(Notification.permission==='denied'){showNotifBlockedHelp();return;}
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){if(perm==='denied')showNotifBlockedHelp();else showToast('Permission refusée — réessaie');return;}
    const{key}=await(await fetch(`${BACKEND_URL}/vapid-public-key`)).json();
    const sw=await navigator.serviceWorker.ready;
    const sub=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64ToUint8(key)});
    const subJson=sub.toJSON();
    await fetch(`${BACKEND_URL}/subscribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subJson,notifyAt:time,notifyAt2:time2||''})});
    notifState.enabled=true;notifState.notifyAt=time;notifState.notifyAt2=time2||'';notifState.endpoint=subJson.endpoint;
    saveNotif();closeModal();showToast(`🔔 Notifications activées à ${time}${time2?' et '+time2:''} ✓`);
  }catch(err){console.error(err);showToast("Erreur lors de l'activation");}
}
async function disableNotifications(){
  try{
    if(notifState.endpoint)await fetch(`${BACKEND_URL}/unsubscribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:notifState.endpoint})});
    const sub=await(await navigator.serviceWorker.ready).pushManager.getSubscription();
    if(sub)await sub.unsubscribe();
  }catch(e){console.error(e);}
}
async function updateNotifTime(time,time2){
  try{await fetch(`${BACKEND_URL}/update-time`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:notifState.endpoint,notifyAt:time,notifyAt2:time2||''})});}
  catch(e){console.error(e);}
}
function showNotifBlockedHelp(){
  const isIOS=/iphone|ipad/i.test(navigator.userAgent);
  showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Notifications bloquées 🚫</h2>
    <p class="modal-subtitle">Pour les activer :</p>
    <ol class="help-steps">
      ${isIOS
        ?'<li>Ouvre <strong>Réglages → Applications → Safari</strong></li><li>Va dans <strong>Réglages des sites web → Notifications</strong></li><li>Trouve ce site et passe en <strong>Autoriser</strong></li>'
        :'<li>Clique sur l\'icône 🔒 dans la barre d\'adresse</li><li>Va dans <strong>Autorisations du site → Notifications</strong></li><li>Passe en <strong>Autoriser</strong></li>'}
      <li>Reviens dans l'app et réessaie</li>
    </ol>
    <style>.help-steps{margin:16px 0 8px 20px;display:flex;flex-direction:column;gap:10px}.help-steps li{color:var(--text2);font-size:.9rem;line-height:1.5}.help-steps strong{color:var(--text)}</style>`);
}

// ─── Export / Import ──────────────────────────────────────────────────────────
function exportData() {
  const history = loadHistory();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    cap_data: state,
    cap_history: history,
    cap_notif: notifState,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href     = url;
  a.download = `cap-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('✓ Données exportées !');
}

function importData(jsonText) {
  const payload = JSON.parse(jsonText);
  if(!payload || payload.version !== 1) throw new Error('Format non reconnu');
  if(!payload.cap_data || !Array.isArray(payload.cap_data.objectives)) throw new Error('Données objectives manquantes');

  // Migration : s'assurer que chaque objectif a les champs requis
  payload.cap_data.objectives.forEach(o=>{
    if(!o.journal)    o.journal=[];
    if(!o.lastResetAt)o.lastResetAt=o.createdAt||new Date().toISOString();
  });

  // Écriture dans localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.cap_data));
  if(payload.cap_history) saveHistory(payload.cap_history);
  if(payload.cap_notif)   localStorage.setItem(NOTIF_KEY, JSON.stringify(payload.cap_notif));

  // Rechargement de l'état en mémoire
  state      = load();
  notifState = loadNotif();

  showToast('✓ Données importées ! Rechargement…');
  setTimeout(()=>{ window.location.reload(); }, 1500);
}

// ─── Toast / Shake ────────────────────────────────────────────────────────────
function showToast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.body.appendChild(t);requestAnimationFrame(()=>t.classList.add('visible'));
  setTimeout(()=>{t.classList.remove('visible');t.addEventListener('transitionend',()=>t.remove(),{once:true});},3000);
}
function shake(el){el.classList.add('shake');el.addEventListener('animationend',()=>el.classList.remove('shake'),{once:true});}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init(){
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

  // Appliquer le thème sauvegardé
  applyTheme();

  // Migration : champs manquants
  if(state.objectives){
    state.objectives.forEach(o=>{
      if(!o.journal)o.journal=[];
      if(!o.lastResetAt)o.lastResetAt=o.createdAt||new Date().toISOString();
    });
    if(!state.lastReview)state.lastReview=state.lastVisit;
    save();
  }

  if(!state.onboardingDone){showOnboarding();return;}

  // Réinitialisation auto silencieuse des périodes écoulées
  autoReset();
  render();

  // ?review=1 depuis notification push → ouvrir le bilan
  const params=new URLSearchParams(window.location.search);
  if(params.get('review')==='1'){
    window.history.replaceState({},'',window.location.pathname);
    setTimeout(()=>startReview(),700);
  } else {
    // Bilan auto si pas encore fait aujourd'hui
    const reviewedToday=state.lastReview?.slice(0,10)===today();
    if(!reviewedToday&&state.objectives.filter(o=>!o.archived).length>0){
      setTimeout(()=>startReview(),700);
    }
  }

  state.lastVisit=new Date().toISOString();save();
}
document.addEventListener('DOMContentLoaded',init);
