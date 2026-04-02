// ─── Cap! — app.js ────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://cap-backend-production-3b1c.up.railway.app';
// const BACKEND_URL = 'https://cap-backend-render.onrender.com';

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
  return { enabled: false, notifyAt: '20:00', endpoint: null };
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

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const periods = ['day','week','month','year'];
  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <div class="logo">Cap<span class="logo-bang">!</span></div>
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
            <div class="objectives-list">
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
}

function renderCard(obj) {
  const pct=objectiveProgress(obj), color=progressColor(pct);
  const journalCount=(obj.journal||[]).filter(e=>e.note).length;
  return `
    <article class="obj-card">
      <div class="obj-card-top">
        <div class="obj-info">
          <span class="obj-period-badge ${obj.period}">${periodName(obj.period)}</span>
          <h3 class="obj-title">${esc(obj.title)}</h3>
        </div>
        <div class="obj-actions">
          <button class="btn-icon-sm journal-btn ${journalCount>0?'has-notes':''}" data-journal="${obj.id}" title="Journal">📓</button>
          <button class="btn-icon-sm" data-action="update" data-id="${obj.id}" title="Modifier">✎</button>
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
    if(action==='update') showUpdateModal(id);
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

// ─── Update ───────────────────────────────────────────────────────────────────
function showUpdateModal(id) {
  const obj=state.objectives.find(o=>o.id===id);if(!obj)return;
  const pct=objectiveProgress(obj);

  // Pour le mode liste : on travaille sur une copie locale des tâches
  let localTasks = obj.mode==='list' ? obj.tasks.map(t=>({...t})) : [];

  function buildModal() {
    return `
      <button class="modal-close">✕</button>
      <h2 class="modal-title">Modifier</h2>
      <p class="modal-subtitle">${esc(obj.title)}</p>
      ${obj.mode==='percent'?`
        <label class="field-label">Progression : <span id="pd">${pct}%</span></label>
        <input type="range" id="pct-slider" class="pct-slider" min="0" max="100" value="${pct}">
      `:`
        <label class="field-label">Tâches</label>
        <div id="edit-tasks-list">
          ${localTasks.map((t,i)=>`
            <div class="task-edit-row">
              <input type="checkbox" class="task-check edit-task-cb" data-i="${i}" ${t.done?'checked':''}>
              <span class="task-edit-label">${esc(t.label)}</span>
              <button class="btn-remove-task edit-task-del" data-i="${i}" title="Supprimer">🗑</button>
            </div>`).join('')}
        </div>
        <div class="task-add-row" style="margin-top:10px">
          <input id="edit-task-input" class="field-input" placeholder="Nouvelle tâche…" maxlength="100">
          <button class="btn-secondary small" id="btn-edit-add-task">Ajouter</button>
        </div>
      `}
      <button class="btn-primary" id="btn-save-upd">Enregistrer</button>`;
  }

  const{close,overlay}=showModal(buildModal());

  function rebindTaskList() {
    const listEl = overlay.querySelector('#edit-tasks-list');
    if(!listEl) return;
    listEl.innerHTML = localTasks.map((t,i)=>`
      <div class="task-edit-row">
        <input type="checkbox" class="task-check edit-task-cb" data-i="${i}" ${t.done?'checked':''}>
        <span class="task-edit-label">${esc(t.label)}</span>
        <button class="btn-remove-task edit-task-del" data-i="${i}" title="Supprimer">🗑</button>
      </div>`).join('');
    listEl.querySelectorAll('.edit-task-cb').forEach(cb=>{
      cb.addEventListener('change',()=>{ localTasks[+cb.dataset.i].done=cb.checked; });
    });
    listEl.querySelectorAll('.edit-task-del').forEach(btn=>{
      btn.addEventListener('click',()=>{ localTasks.splice(+btn.dataset.i,1); rebindTaskList(); });
    });
  }

  if(obj.mode==='percent'){
    overlay.querySelector('#pct-slider').addEventListener('input',e=>{overlay.querySelector('#pd').textContent=e.target.value+'%';});
  } else {
    rebindTaskList();
    const addInput = overlay.querySelector('#edit-task-input');
    overlay.querySelector('#btn-edit-add-task').addEventListener('click',()=>{
      const v=addInput.value.trim();
      if(v){ localTasks.push({id:uid(),label:v,done:false}); addInput.value=''; rebindTaskList(); }
    });
    addInput.addEventListener('keydown',e=>{ if(e.key==='Enter') overlay.querySelector('#btn-edit-add-task').click(); });
  }

  overlay.querySelector('#btn-save-upd').addEventListener('click',()=>{
    if(obj.mode==='percent') obj.progress=+overlay.querySelector('#pct-slider').value;
    else obj.tasks=localTasks;
    obj.updatedAt=new Date().toISOString();save();close();render();
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
  const supported='Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;
  const{close,overlay}=showModal(`
    <button class="modal-close">✕</button>
    <h2 class="modal-title">Paramètres</h2>
    <div class="settings-section">
      <div class="settings-row">
        <div class="settings-label">
          <span class="settings-icon">🔔</span>
          <div><div class="settings-name">Notifications push</div><div class="settings-desc">Rappel quotidien pour faire le point</div></div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="notif-toggle" ${notifState.enabled?'checked':''} ${!supported?'disabled':''}>
          <span class="toggle-track"></span>
        </label>
      </div>
      ${!supported?`<p class="settings-warn">⚠️ Non supporté sur ce navigateur.<br>Sur iOS : installe l'app sur l'écran d'accueil via Safari.</p>`:''}
      <div class="settings-row ${notifState.enabled?'':'dimmed'}" id="time-row">
        <div class="settings-label">
          <span class="settings-icon">🕐</span>
          <div><div class="settings-name">Heure du rappel</div><div class="settings-desc">Chaque jour à cette heure (heure de Paris)</div></div>
        </div>
        <input type="time" id="notif-time" class="time-input" value="${notifState.notifyAt}" ${!notifState.enabled?'disabled':''}>
      </div>
      <div class="notif-status ${notifState.enabled?'on':'off'}">
        ${notifState.enabled?`🔔 Activées — rappel à ${notifState.notifyAt}`:'🔕 Désactivées'}
      </div>
    </div>
    <div class="settings-actions">
      <button class="btn-secondary small" id="btn-test" ${!notifState.enabled?'disabled':''}>Tester</button>
      <button class="btn-primary" id="btn-save-settings">Enregistrer</button>
    </div>
    <div class="settings-clearzone">
      <div class="settings-data-actions">
        <button class="btn-data" id="btn-export">⬆️ Exporter mes données</button>
        <button class="btn-data" id="btn-import">⬇️ Importer des données</button>
      </div>
      <input type="file" id="import-file-input" accept=".json" style="display:none">
      <a href="https://mykado72.github.io/Cap/clear-cache.html" class="btn-clear-cache" target="_blank" rel="noopener">🗑 Vider le cache de l'app</a>
    </div>`);

  const toggle=overlay.querySelector('#notif-toggle');
  const timeRow=overlay.querySelector('#time-row');
  const timeInput=overlay.querySelector('#notif-time');
  const testBtn=overlay.querySelector('#btn-test');
  toggle.addEventListener('change',()=>{timeRow.classList.toggle('dimmed',!toggle.checked);timeInput.disabled=!toggle.checked;testBtn.disabled=!toggle.checked;});
  overlay.querySelector('#btn-save-settings').addEventListener('click',async()=>{
    const want=toggle.checked,time=timeInput.value||'20:00';
    if(want&&!notifState.enabled){await enableNotifications(time,close);}
    else if(!want&&notifState.enabled){await disableNotifications();notifState.enabled=false;notifState.endpoint=null;saveNotif();close();showToast('Notifications désactivées');}
    else if(want&&notifState.enabled&&time!==notifState.notifyAt){await updateNotifTime(time);notifState.notifyAt=time;saveNotif();close();showToast(`🕐 Rappel mis à jour à ${time}`);}
    else{close();}
  });
  testBtn.addEventListener('click',async()=>{
    if(!notifState.endpoint)return;
    testBtn.textContent='Envoi…';testBtn.disabled=true;
    try{
      const r=await fetch(`${BACKEND_URL}/test-push`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:notifState.endpoint})});
      showToast(r.ok?'✓ Notification de test envoyée !':'Erreur lors du test');
    }catch{showToast('Impossible de joindre le serveur');}
    finally{testBtn.textContent='Tester';testBtn.disabled=false;}
  });

  // Export
  overlay.querySelector('#btn-export')?.addEventListener('click',()=>{
    exportData();
  });

  // Import
  const fileInput=overlay.querySelector('#import-file-input');
  overlay.querySelector('#btn-import')?.addEventListener('click',()=>fileInput?.click());
  fileInput?.addEventListener('change',()=>{
    const file=fileInput.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        importData(e.target.result);
        close();
      }catch(err){
        showToast('❌ Fichier invalide ou corrompu');
        console.error(err);
      }
    };
    reader.readAsText(file);
  });
}

// ─── Push helpers ─────────────────────────────────────────────────────────────
function urlB64ToUint8(b64){const pad='='.repeat((4-b64.length%4)%4);const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));return new Uint8Array([...raw].map(c=>c.charCodeAt(0)));}
async function enableNotifications(time,closeModal){
  try{
    if(Notification.permission==='denied'){showNotifBlockedHelp();return;}
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){if(perm==='denied')showNotifBlockedHelp();else showToast('Permission refusée — réessaie');return;}
    const{key}=await(await fetch(`${BACKEND_URL}/vapid-public-key`)).json();
    const sw=await navigator.serviceWorker.ready;
    const sub=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64ToUint8(key)});
    const subJson=sub.toJSON();
    await fetch(`${BACKEND_URL}/subscribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subJson,notifyAt:time})});
    notifState.enabled=true;notifState.notifyAt=time;notifState.endpoint=subJson.endpoint;
    saveNotif();closeModal();showToast(`🔔 Notifications activées à ${time} ✓`);
  }catch(err){console.error(err);showToast("Erreur lors de l'activation");}
}
async function disableNotifications(){
  try{
    if(notifState.endpoint)await fetch(`${BACKEND_URL}/unsubscribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:notifState.endpoint})});
    const sub=await(await navigator.serviceWorker.ready).pushManager.getSubscription();
    if(sub)await sub.unsubscribe();
  }catch(e){console.error(e);}
}
async function updateNotifTime(time){
  try{await fetch(`${BACKEND_URL}/update-time`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:notifState.endpoint,notifyAt:time})});}
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
