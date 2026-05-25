/**
 * app.js
 * Controlador principal. Detecta la pagina actual y orquesta
 * la carga de datos reales desde el backend.
 */

document.addEventListener('DOMContentLoaded', () => {
  updateAuthNav();
  initAccountMenu();
  const page = detectPage();
  switch (page) {
    case 'home':           initHome();          break;
    case 'partidos':       initPartidos();      break;
    case 'predicciones':   initPredicciones();  break;
    case 'clasificacion':  initClasificacion(); break;
    case 'auth':           initAuth();          break;
    case 'invitaciones':   initInvitaciones();  break;
    case 'invitacion':     initInviteLanding(); break;
  }
});

let matchesPollingId = null;

function detectPage() {
  const p = window.location.pathname;
  if (p.includes('invitaciones.html')) return 'invitaciones';
  if (p.includes('invitacion.html'))   return 'invitacion';
  if (p.includes('partidos'))          return 'partidos';
  if (p.includes('predicciones'))      return 'predicciones';
  if (p.includes('clasificacion'))     return 'clasificacion';
  if (p.includes('auth'))              return 'auth';
  return 'home';
}

function updateAuthNav() {
  const user = API.getCurrentUser();
  document.querySelectorAll('[data-auth-link]').forEach(link => {
    link.textContent = user ? user.nombre || user.username : 'Ingresar';
    link.href = link.dataset.authHref || 'auth.html';
  });

  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.classList.toggle('hidden', !user);
    btn.addEventListener('click', () => {
      API.logout();
      window.location.href = authRelativePath('auth.html');
    });
  });
}

function initAccountMenu() {
  document.querySelectorAll('.navbar').forEach(navbar => {
    if (navbar.querySelector('[data-menu-toggle]')) return;

    const user = API.getCurrentUser();
    const menu = document.createElement('div');
    menu.className = 'account-menu';
    menu.innerHTML = `
      <button class="account-menu__button" data-menu-toggle aria-label="Abrir menú">
        <span>${initial(user?.nombre || user?.username || 'U')}</span>
      </button>
      <div class="account-drawer" data-menu-drawer>
        <div class="account-drawer__head">
          <strong>${escapeHtml(user?.nombre || user?.username || 'Invitado')}</strong>
          <small>${user ? 'Sesión activa' : 'Sin sesión'}</small>
        </div>
        <a href="${authRelativePath('auth.html')}">${user ? 'Mi cuenta' : 'Ingresar'}</a>
        <a href="${homeRelativePath()}">Competencias</a>
        <a class="${user ? '' : 'hidden'}" href="${authRelativePath('invitaciones.html')}">Invitaciones</a>
        <button class="${user ? '' : 'hidden'}" data-menu-logout>Cerrar Sesión</button>
      </div>
    `;
    navbar.appendChild(menu);
  });

  document.querySelectorAll('[data-menu-toggle]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      button.closest('.account-menu')?.classList.toggle('open');
    });
  });

  document.querySelectorAll('[data-menu-logout]').forEach(button => {
    button.addEventListener('click', () => {
      API.logout();
      window.location.href = authRelativePath('auth.html');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.account-menu.open').forEach(menu => menu.classList.remove('open'));
  });
}

function authRelativePath(path) {
  return window.location.pathname.includes('/pages/') ? path : `pages/${path}`;
}

function pagePath(path) {
  return window.location.pathname.includes('/pages/') ? path : `pages/${path}`;
}

function homeRelativePath(hash = '') {
  const base = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
  return `${base}${hash}`;
}

/* --------------------------------------------------------
   AUTH
   -------------------------------------------------------- */
function initAuth() {
  if (API.getToken()) {
    API.me().then(() => updateAuthNav()).catch(() => API.logout());
  }

  initGoogleAuth();

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    setAuthError('');

    const form = new FormData(loginForm);
    try {
      await API.login({
        identificador: form.get('identificador'),
        password: form.get('password'),
      });
      redirectAfterAuth();
    } catch (error) {
      setAuthError(error.message);
    }
  });

  registerForm?.addEventListener('submit', async event => {
    event.preventDefault();
    setAuthError('');

    const form = new FormData(registerForm);
    try {
      await API.register({
        username: form.get('username'),
        nombre: form.get('nombre'),
        email: form.get('email'),
        password: form.get('password'),
      });
      redirectAfterAuth();
    } catch (error) {
      setAuthError(error.message);
    }
  });
}

function safeNextHref(next) {
  if (!next) return null;
  if (/^[a-z]+:\/\//i.test(next)) return null;
  if (next.startsWith('//')) return null;
  return next;
}

function redirectAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  const next = safeNextHref(params.get('next'));
  window.location.href = next || '../index.html';
}

function initGoogleAuth() {
  const wrapper = document.getElementById('google-auth');
  const target = document.getElementById('google-signin');
  const clientId = window.ONCE_METROS_CONFIG?.GOOGLE_CLIENT_ID?.trim();
  if (!wrapper || !target || !clientId) return;

  wrapper.classList.remove('hidden');

  const render = () => {
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(target, {
      theme: 'filled_black',
      size: 'large',
      type: 'standard',
      text: 'continue_with',
      shape: 'rectangular',
      width: Math.min(target.offsetWidth || 360, 400),
    });
  };

  if (window.google?.accounts?.id) {
    render();
  } else {
    window.addEventListener('load', render, { once: true });
  }
}

async function handleGoogleCredential(response) {
  setAuthError('');
  try {
    await API.loginWithGoogle(response.credential);
    redirectAfterAuth();
  } catch (error) {
    setAuthError(error.message);
  }
}

function setAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('hidden', !message);
}

/* --------------------------------------------------------
   HOME: COMPETENCIAS -> PREDICCIONES / TORNEOS DE AMIGOS
   -------------------------------------------------------- */
function initHome() {
  loadCompetencias();
  document.getElementById('create-torneo-form')?.addEventListener('submit', handleCreateTorneo);
  document.querySelector('[data-back-to-competencias]')?.addEventListener('click', () => showCompetitionPicker());
  document.querySelectorAll('[data-home-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchHomeTab(btn.dataset.homeTab));
  });
  document.querySelectorAll('.filter-chip[data-group="estado"]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-group="estado"]')
        .forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadPartidos();
    });
  });
  window.addEventListener('hashchange', () => {
    const competencia = API.getSelectedCompetencia();
    if (!competencia) return;
    selectCompetencia(competencia, window.location.hash.replace('#', ''));
  });
}

async function loadCompetencias() {
  const listEl = document.getElementById('competencias-list');
  if (!listEl) return;

  showSkeleton(listEl, 3);
  setHomeError('');

  try {
    const competencias = await API.getCompetencias();
    if (!competencias.length) {
      listEl.innerHTML = emptyState('No hay competencias disponibles.');
      return;
    }

    const selected = API.getSelectedCompetencia();
    const active = competencias.find(c => c.id === selected?.id);
    listEl.innerHTML = competencias.map(c => renderCompetenciaCard(c, c.id === active?.id)).join('');
    listEl.querySelectorAll('[data-competencia-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const competencia = competencias.find(c => c.id === btn.dataset.competenciaId);
        selectCompetencia(competencia);
      });
    });

    if (active && window.location.hash) {
      selectCompetencia(active, window.location.hash.replace('#', ''));
    } else {
      showCompetitionPicker();
    }
  } catch (error) {
    listEl.innerHTML = errorState(error.message);
    setHomeError(error.message);
  }
}

function showCompetitionPicker() {
  stopMatchesPolling();
  document.getElementById('competition-picker')?.classList.remove('hidden');
  document.getElementById('competencia-workspace')?.classList.add('hidden');
  history.replaceState(null, '', 'index.html');
}

async function selectCompetencia(competencia, preferredTab = 'predicciones') {
  if (!competencia) return;
  API.setSelectedCompetencia(competencia);
  document.getElementById('competition-picker')?.classList.add('hidden');
  document.getElementById('competencia-workspace')?.classList.remove('hidden');
  setText('competencia-title', competencia.nombre);
  switchHomeTab(preferredTab === 'torneos' ? 'torneos' : 'predicciones');
  await loadPartidos();
  startMatchesPolling();
  await loadTorneosForCompetencia(competencia);
}

function renderCompetenciaCard(competencia, active) {
  return `
    <button class="competition-card ${active ? 'active' : ''}" data-competencia-id="${competencia.id}">
      <span class="competition-card__name">${escapeHtml(competencia.nombre)}</span>
      <span class="competition-card__slug">${escapeHtml(competencia.slug)}</span>
    </button>
  `;
}

async function loadTorneosForCompetencia(competencia = API.getSelectedCompetencia()) {
  const listEl = document.getElementById('torneos-list');
  const formEl = document.getElementById('create-torneo-form');
  if (!listEl || !competencia) return;

  showSkeleton(listEl, 2);
  formEl?.classList.toggle('hidden', !API.getToken());

  try {
    const torneos = await API.getTorneosDeAmigos({ competenciaId: competencia.id });
    if (!torneos.length) {
      listEl.innerHTML = emptyState('Todavía no hay Torneos de Amigos para esta competencia.');
      return;
    }

    const selected = API.getSelectedTorneo();
    listEl.innerHTML = torneos.map(t => renderTorneoCard(t, t.id === selected?.id)).join('');
    listEl.querySelectorAll('[data-torneo-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const torneo = torneos.find(t => t.id === btn.dataset.torneoId);
        API.setSelectedTorneo(torneo);
        window.location.href = pagePath('clasificacion.html');
      });
    });
  } catch (error) {
    listEl.innerHTML = errorState(error.message);
  }
}

function switchHomeTab(tab) {
  const next = tab === 'torneos' ? 'torneos' : 'predicciones';
  document.querySelectorAll('[data-home-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.homeTab === next);
  });
  document.getElementById('home-tab-predicciones')?.classList.toggle('hidden', next !== 'predicciones');
  document.getElementById('home-tab-torneos')?.classList.toggle('hidden', next !== 'torneos');
  if (!document.getElementById('competencia-workspace')?.classList.contains('hidden')) {
    history.replaceState(null, '', `index.html#${next}`);
  }
}

function renderTorneoCard(torneo, active) {
  const miembros = torneo.miembrosCount === 1 ? '1 miembro' : `${torneo.miembrosCount ?? 0} miembros`;
  return `
    <button class="tournament-card ${active ? 'active' : ''}" data-torneo-id="${torneo.id}">
      <span>
        <strong>${escapeHtml(torneo.nombre)}</strong>
        <small>${escapeHtml(torneo.competencia?.nombre || '')}</small>
      </span>
      <span class="tournament-card__meta">${miembros}</span>
    </button>
  `;
}

async function handleCreateTorneo(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const input = form.querySelector('[name="nombre"]');
  const competencia = API.getSelectedCompetencia();
  const listEl = document.getElementById('torneos-list');
  if (!competencia || !input?.value.trim()) return;

  submit.disabled = true;
  submit.textContent = 'Creando...';

  try {
    const torneo = await API.createTorneoDeAmigos({
      nombre: input.value.trim(),
      competenciaId: competencia.id,
    });
    API.setSelectedTorneo(torneo);
    form.reset();
    await loadTorneosForCompetencia(competencia);
  } catch (error) {
    if (listEl) listEl.innerHTML = errorState(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Crear';
  }
}

function setHomeError(message) {
  const el = document.getElementById('home-error');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('hidden', !message);
}

/* --------------------------------------------------------
   PARTIDOS
   -------------------------------------------------------- */
function initPartidos() {
  renderSelectedContext();
  loadPartidos();
  startMatchesPolling();

  document.querySelectorAll('.filter-chip[data-group="estado"]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-group="estado"]')
        .forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadPartidos();
    });
  });
}

function startMatchesPolling() {
  stopMatchesPolling();
  matchesPollingId = setInterval(() => loadPartidos({ quiet: true }), 30000);
}

function stopMatchesPolling() {
  if (!matchesPollingId) return;
  clearInterval(matchesPollingId);
  matchesPollingId = null;
}

async function loadPartidos({ quiet = false } = {}) {
  const el = document.getElementById('matches-list');
  if (!el) return;

  const competencia = API.getSelectedCompetencia();
  if (!competencia) {
    el.innerHTML = emptyState('Elegí una competencia para ver partidos.');
    return;
  }

  const active = document.querySelector('.filter-chip[data-group="estado"].active');
  const estado = active?.dataset.value || '';

  if (!quiet) showSkeleton(el, 4);

  try {
    const matches = await API.getMatches({ competenciaId: competencia.id, estado });
    el.innerHTML = '';
    if (!matches.length) {
      el.innerHTML = emptyState('No hay partidos para este filtro.');
      return;
    }
    matches.forEach(m => el.appendChild(Predictions.createMatchCard(m)));
  } catch (error) {
    el.innerHTML = errorState(error.message);
  }
}

/* --------------------------------------------------------
   MIS PREDICCIONES
   -------------------------------------------------------- */
function initPredicciones() {
  renderSelectedContext();
  loadUserStats();
  loadPendingPredictions();
  loadHistoryPredictions();

  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
}

async function loadUserStats() {
  try {
    const preds = await API.getUserPredictions();
    const aciertos = preds.filter(p => p.estado === 'acierto').length;
    const puntos   = preds.reduce((a, p) => a + (p.puntos || 0), 0);
    const racha    = calcularRacha(preds);
    const cerradas = preds.filter(p => p.estado !== 'pendiente').length;
    const pct      = cerradas ? Math.round(aciertos / cerradas * 100) : 0;

    setText('stat-puntos',   puntos);
    setText('stat-aciertos', aciertos);
    setText('stat-pct',      pct + '%');
    setText('stat-racha',    racha);
  } catch (error) {
    setPrediccionesError(error.message);
  }
}

async function loadPendingPredictions() {
  const el = document.getElementById('predictions-pending');
  if (!el) return;
  try {
    const preds = await API.getUserPredictions({ estado: 'pendiente' });
    el.className = preds.length ? 'pred-list' : '';
    el.innerHTML = preds.length
      ? preds.map(renderPredRow).join('')
      : emptyState('No tenés predicciones pendientes.');
  } catch (error) { el.innerHTML = errorState(error.message); }
}

async function loadHistoryPredictions() {
  const el = document.getElementById('predictions-history');
  if (!el) return;
  try {
    const preds = (await API.getUserPredictions()).filter(p => p.estado !== 'pendiente');
    el.className = preds.length ? 'pred-list' : '';
    el.innerHTML = preds.length
      ? preds.map(renderPredRow).join('')
      : emptyState('Todavía no tenés historial.');
  } catch (error) { el.innerHTML = errorState(error.message); }
}

function setPrediccionesError(message) {
  const pending = document.getElementById('predictions-pending');
  const history = document.getElementById('predictions-history');
  if (pending) pending.innerHTML = errorState(message);
  if (history) history.innerHTML = errorState(message);
}

function renderPredRow(pred) {
  const cls   = pred.estado === 'acierto' ? 'hit' : pred.estado === 'fallo' ? 'miss' : 'pending';
  const label = pred.estado === 'acierto' ? 'Acierto' : pred.estado === 'fallo' ? 'Fallo' : 'Pendiente';
  const pts   = pred.puntos > 0 ? `+${pred.puntos}` : '-';
  const score = `${pred.scoreEquipo1Pred ?? '?'}-${pred.scoreEquipo2Pred ?? '?'}`;

  const rowCls = pred.estado === 'acierto' ? 'is-hit' : pred.estado === 'fallo' ? 'is-miss' : '';
  return `
    <div class="pred-row ${rowCls}">
      <div class="pred-match">
        <div class="pred-match-name">${escapeHtml(pred.equipo1)} vs ${escapeHtml(pred.equipo2)}</div>
        <div class="pred-match-meta">${escapeHtml(pred.liga || '')} · Mi pred: ${score}</div>
      </div>
      <span class="pred-tag ${cls}">${label}</span>
      <span class="pred-pts ${pred.puntos > 0 ? 'positive' : ''}">${pts}</span>
    </div>
  `;
}

function calcularRacha(preds) {
  let r = 0;
  for (const p of [...preds].reverse()) { if (p.estado === 'acierto') r++; else if (p.estado === 'fallo') break; }
  return r;
}

/* --------------------------------------------------------
   CLASIFICACION
   -------------------------------------------------------- */
function initClasificacion() {
  renderSelectedContext();
  loadSelectedTorneoHeader();
  loadLeaderboard();
  initInvitePanel();
}

async function initInvitePanel() {
  const toggleBtn = document.getElementById('invite-toggle');
  const panel = document.getElementById('invite-panel');
  if (!toggleBtn || !panel) return;

  const selected = API.getSelectedTorneo();
  const user = API.getCurrentUser();
  if (!selected || !user) return;

  let torneo;
  try {
    torneo = await API.getTorneoDeAmigos(selected.id);
  } catch { return; }

  if (torneo.creadorId !== user.id) return;

  toggleBtn.classList.remove('hidden');
  toggleBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
  document.getElementById('invite-close')?.addEventListener('click', () => panel.classList.add('hidden'));

  const form = document.getElementById('invite-search-form');
  const input = document.getElementById('invite-identificador');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    setInviteFeedback('');
    try {
      await API.invitarAlTorneo(torneo.id, value);
      setInviteFeedback(`Invitación enviada a ${value}.`, 'success');
      input.value = '';
      await refreshInviteSentList(torneo.id);
    } catch (err) {
      setInviteFeedback(err.message, 'error');
    }
  });

  document.getElementById('invite-link-generate')?.addEventListener('click', async () => {
    try {
      const { url } = await API.generarInviteLink(torneo.id);
      setInviteLinkUrl(url);
    } catch (err) { setInviteFeedback(err.message, 'error'); }
  });
  document.getElementById('invite-link-rotate')?.addEventListener('click', async () => {
    try {
      const { url } = await API.generarInviteLink(torneo.id);
      setInviteLinkUrl(url);
      setInviteFeedback('Enlace regenerado.', 'success');
    } catch (err) { setInviteFeedback(err.message, 'error'); }
  });
  document.getElementById('invite-link-revoke')?.addEventListener('click', async () => {
    if (!confirm('¿Revocar el enlace? Quien lo tenga no va a poder usarlo.')) return;
    try {
      await API.revocarInviteLink(torneo.id);
      setInviteLinkUrl(null);
      setInviteFeedback('Enlace revocado.', 'success');
    } catch (err) { setInviteFeedback(err.message, 'error'); }
  });
  document.getElementById('invite-link-copy')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('invite-link-url');
    if (!urlInput?.value) return;
    try {
      await navigator.clipboard.writeText(urlInput.value);
      setInviteFeedback('Enlace copiado.', 'success');
    } catch {
      urlInput.select();
      document.execCommand('copy');
      setInviteFeedback('Enlace copiado.', 'success');
    }
  });

  try {
    const { url } = await API.getInviteLink(torneo.id);
    setInviteLinkUrl(url);
  } catch {}
  await refreshInviteSentList(torneo.id);
}

function setInviteLinkUrl(url) {
  const urlInput = document.getElementById('invite-link-url');
  const copyBtn = document.getElementById('invite-link-copy');
  const generateBtn = document.getElementById('invite-link-generate');
  const rotateBtn = document.getElementById('invite-link-rotate');
  const revokeBtn = document.getElementById('invite-link-revoke');
  if (urlInput) urlInput.value = url || '';
  if (copyBtn) copyBtn.disabled = !url;
  if (url) {
    generateBtn?.classList.add('hidden');
    rotateBtn?.classList.remove('hidden');
    revokeBtn?.classList.remove('hidden');
  } else {
    generateBtn?.classList.remove('hidden');
    rotateBtn?.classList.add('hidden');
    revokeBtn?.classList.add('hidden');
  }
}

function setInviteFeedback(message, type) {
  const el = document.getElementById('invite-feedback');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('error', 'success');
  el.classList.toggle('hidden', !message);
  if (type) el.classList.add(type);
}

async function refreshInviteSentList(torneoId) {
  const list = document.getElementById('invite-sent-list');
  if (!list) return;
  try {
    const invitaciones = await API.getInvitacionesDelTorneo(torneoId);
    if (!invitaciones.length) {
      list.innerHTML = emptyState('Todavía no enviaste invitaciones.');
      return;
    }
    list.innerHTML = invitaciones.map(renderInviteSentRow).join('');
    list.querySelectorAll('[data-cancel-invitacion]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Cancelar esta invitación?')) return;
        try {
          await API.cancelarInvitacion(btn.dataset.cancelInvitacion);
          await refreshInviteSentList(torneoId);
        } catch (err) {
          setInviteFeedback(err.message, 'error');
        }
      });
    });
  } catch (err) {
    list.innerHTML = errorState(err.message);
  }
}

function renderInviteSentRow(inv) {
  const u = inv.invitado || {};
  const name = u.nombre || u.username || 'Usuario';
  const action = inv.estado === 'PENDIENTE'
    ? `<button class="btn btn-outline btn-sm" data-cancel-invitacion="${inv.id}">Cancelar</button>`
    : '';
  return `
    <div class="invite-row">
      <div class="invite-row__who">
        <span class="invite-row__name">${escapeHtml(name)}</span>
        <span class="invite-row__meta">@${escapeHtml(u.username || '')}</span>
      </div>
      <span class="invite-row__state ${inv.estado}">${labelEstadoInvitacion(inv.estado)}</span>
      ${action}
    </div>
  `;
}

function labelEstadoInvitacion(estado) {
  return ({
    PENDIENTE: 'Pendiente',
    ACEPTADA: 'Aceptada',
    RECHAZADA: 'Rechazada',
    CANCELADA: 'Cancelada',
  })[estado] || estado;
}

/* --------------------------------------------------------
   INVITACIONES INBOX
   -------------------------------------------------------- */
async function initInvitaciones() {
  if (!API.getToken()) {
    const next = encodeURIComponent('invitaciones.html');
    window.location.href = `auth.html?next=${next}`;
    return;
  }
  await loadInvitacionesPendientes();
}

async function loadInvitacionesPendientes() {
  const list = document.getElementById('invitaciones-list');
  if (!list) return;
  showSkeleton(list, 2);
  try {
    const invitaciones = await API.getMisInvitacionesPendientes();
    if (!invitaciones.length) {
      list.innerHTML = emptyState('No tenés invitaciones pendientes.');
      return;
    }
    list.innerHTML = invitaciones.map(renderInviteInboxCard).join('');
    list.querySelectorAll('[data-accept]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.aceptarInvitacion(btn.dataset.accept);
          setInvitacionesFeedback('Te uniste al torneo.', 'success');
          await loadInvitacionesPendientes();
        } catch (err) { setInvitacionesFeedback(err.message, 'error'); }
      });
    });
    list.querySelectorAll('[data-reject]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.rechazarInvitacion(btn.dataset.reject);
          await loadInvitacionesPendientes();
        } catch (err) { setInvitacionesFeedback(err.message, 'error'); }
      });
    });
  } catch (err) {
    list.innerHTML = errorState(err.message);
  }
}

function renderInviteInboxCard(inv) {
  const torneo = inv.torneoDeAmigos || {};
  const competencia = torneo.competencia || {};
  const sender = inv.invitadoPor || {};
  return `
    <div class="invite-inbox-card">
      <div class="invite-inbox-card__head">
        <strong>${escapeHtml(torneo.nombre || 'Torneo')}</strong>
        <small>${escapeHtml(competencia.nombre || '')} · te invitó @${escapeHtml(sender.username || '?')}</small>
      </div>
      <div class="invite-inbox-card__actions">
        <button class="btn btn-primary" data-accept="${inv.id}">Aceptar</button>
        <button class="btn btn-outline" data-reject="${inv.id}">Rechazar</button>
      </div>
    </div>
  `;
}

function setInvitacionesFeedback(msg, type) {
  const el = document.getElementById('invitaciones-feedback');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('error', 'success');
  el.classList.toggle('hidden', !msg);
  if (type) el.classList.add(type);
}

/* --------------------------------------------------------
   INVITE LINK LANDING
   -------------------------------------------------------- */
async function initInviteLanding() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const title = document.getElementById('invite-landing-title');
  const meta = document.getElementById('invite-landing-meta');
  const actions = document.getElementById('invite-landing-actions');

  if (!token) {
    title.textContent = 'Invitación inválida';
    meta.textContent = 'Falta el token de la invitación.';
    actions.innerHTML = `<a class="btn btn-primary" href="../index.html">Ir al inicio</a>`;
    return;
  }

  let torneo;
  try {
    torneo = await API.getTorneoPorInviteToken(token);
  } catch (err) {
    title.textContent = 'Invitación inválida o revocada';
    meta.textContent = err.message;
    actions.innerHTML = `<a class="btn btn-primary" href="../index.html">Ir al inicio</a>`;
    return;
  }

  title.textContent = `Sumate a "${torneo.nombre}"`;
  meta.textContent = torneo.competencia?.nombre || '';

  if (!API.getToken()) {
    const next = encodeURIComponent(`invitacion.html?token=${token}`);
    actions.innerHTML = `
      <a class="btn btn-primary" href="auth.html?next=${next}">Ingresar para unirme</a>
      <a class="btn btn-outline" href="../index.html">Ver competencias</a>
    `;
    return;
  }

  actions.innerHTML = `<button class="btn btn-primary" id="invite-landing-join">Unirme al torneo</button>`;
  document.getElementById('invite-landing-join')?.addEventListener('click', async () => {
    try {
      const result = await API.unirseConInviteToken(token);
      API.setSelectedTorneo(result);
      window.location.href = 'clasificacion.html';
    } catch (err) {
      setInviteLandingFeedback(err.message, 'error');
    }
  });
}

function setInviteLandingFeedback(msg, type) {
  const el = document.getElementById('invite-landing-feedback');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('error', 'success');
  el.classList.toggle('hidden', !msg);
  if (type) el.classList.add(type);
}

async function loadSelectedTorneoHeader() {
  const title = document.getElementById('torneo-title');
  const subtitle = document.getElementById('torneo-subtitle');
  const selected = API.getSelectedTorneo();
  if (!selected) return;
  try {
    const torneo = await API.getTorneoDeAmigos(selected.id);
    API.setSelectedTorneo(torneo);
    if (title) title.textContent = torneo.nombre;
    if (subtitle) subtitle.textContent = torneo.competencia?.nombre || 'Torneo de Amigos';
  } catch {
    if (title) title.textContent = selected.nombre || 'Torneo de Amigos';
  }
}

async function loadLeaderboard() {
  const podiumEl  = document.getElementById('podium');
  const rankingEl = document.getElementById('ranking-list');
  if (!rankingEl) return;

  if (!API.getSelectedTorneo()) {
    if (podiumEl) podiumEl.innerHTML = '';
    rankingEl.innerHTML = emptyState('Elegí un Torneo de Amigos para ver el ranking.');
    return;
  }

  try {
    const ranking = await API.getLeaderboard();

    if (!ranking.length) {
      if (podiumEl) podiumEl.innerHTML = '';
      rankingEl.innerHTML = emptyState('Todavía no hay puntajes en este torneo.');
      return;
    }

    if (podiumEl) {
      const top = ranking.slice(0, 3);
      const order   = [top[1], top[0], top[2]];
      const mClasses = ['medal medal-2', 'medal medal-1', 'medal medal-3'];
      const mNums    = ['2', '1', '3'];
      const classes  = ['podium-item--2', 'podium-item--1', 'podium-item--3'];

      podiumEl.innerHTML = order.map((r, i) => r ? `
        <div class="podium-item ${classes[i]}">
          <span class="${mClasses[i]}">${mNums[i]}</span>
          <div class="podium-avatar">${initial(r.nombre)}</div>
          <div class="podium-name">${escapeHtml(r.nombre)}</div>
          <div class="podium-pts">${r.puntos} pts</div>
          <div class="podium-bar"></div>
        </div>
      ` : '').join('');
    }

    const rest = ranking.slice(3);
    rankingEl.innerHTML = rest.length
      ? rest.map((r, i) => renderRankRow(r, i + 3)).join('')
      : '';

  } catch (error) {
    if (podiumEl) podiumEl.innerHTML = '';
    rankingEl.innerHTML = errorState(error.message);
  }
}

function renderRankRow(r, i) {
  const posEl = i === 0 ? `<span class="medal medal-1">1</span>`
              : i === 1 ? `<span class="medal medal-2">2</span>`
              : i === 2 ? `<span class="medal medal-3">3</span>`
              : `<span class="rank-pos">${i + 1}</span>`;
  return `
    <div class="ranking-row">
      ${posEl}
      <div class="rank-avatar">${initial(r.nombre)}</div>
      <div class="rank-info">
        <div class="rank-name">${escapeHtml(r.nombre)}</div>
        <div class="rank-sub">${r.aciertos ?? 0} aciertos · ${r.exactos ?? 0} exactos</div>
      </div>
      <div class="rank-right">
        <div class="rank-pts">${r.puntos}</div>
        <span class="rank-pts-label">pts</span>
      </div>
    </div>
  `;
}

function renderSelectedContext() {
  const el = document.getElementById('selected-context');
  if (!el) return;
  const competencia = API.getSelectedCompetencia();
  const torneo = API.getSelectedTorneo();
  const isPredictionsView = window.location.pathname.includes('partidos');

  if (isPredictionsView) {
    el.innerHTML = `
      <span>${escapeHtml(competencia?.nombre || 'Sin competencia')}</span>
      <a class="btn btn-outline btn-sm" href="${homeRelativePath('#predicciones')}">Cambiar</a>
    `;
    return;
  }

  el.innerHTML = `
    <span>${escapeHtml(competencia?.nombre || 'Sin competencia')}</span>
    <strong>${escapeHtml(torneo?.nombre || 'Sin torneo')}</strong>
    <a class="btn btn-outline btn-sm" href="${homeRelativePath('#torneos')}">Cambiar</a>
  `;
}

/* --------------------------------------------------------
   UTILS
   -------------------------------------------------------- */
function showSkeleton(container, count) {
  container.innerHTML = `
    <div class="skeleton-wrap">
      ${Array.from({ length: count }).map(() => `
        <div class="skeleton-card">
          <div class="skel" style="width:42%;height:10px;margin-bottom:.75rem;border-radius:4px"></div>
          <div class="skel" style="width:100%;height:36px;border-radius:8px"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function emptyState(msg) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">!</div>
      <p>${escapeHtml(msg)}</p>
    </div>
  `;
}

function errorState(msg) {
  return `
    <div class="empty-state error-state">
      <div class="empty-state-icon">!</div>
      <p>${escapeHtml(msg)}</p>
    </div>
  `;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function initial(value) {
  return String(value || '?').trim()[0]?.toUpperCase() || '?';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
