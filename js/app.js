/**
 * app.js
 * Controlador principal. Detecta la pagina actual y orquesta
 * la carga de datos reales desde el backend.
 */

/* --------------------------------------------------------
   APP CONFIRM — in-app confirmation dialog (replaces confirm())
   -------------------------------------------------------- */
function appConfirm(message, { confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
  return new Promise(resolve => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';

    const lines = message.split('\n').filter(Boolean);
    const body = lines.length > 1
      ? `<p class="app-dialog__msg">${lines[0]}</p><p class="app-dialog__sub">${lines.slice(1).join(' ')}</p>`
      : `<p class="app-dialog__msg">${message}</p>`;

    overlay.innerHTML = `
      <div class="app-dialog" role="dialog" aria-modal="true">
        ${body}
        <div class="app-dialog__actions">
          <button class="btn btn-ghost app-dialog__cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} app-dialog__confirm">${confirmText}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      overlay.classList.remove('app-dialog-overlay--visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      resolve(result);
    };

    overlay.querySelector('.app-dialog__confirm').addEventListener('click', () => close(true));
    overlay.querySelector('.app-dialog__cancel').addEventListener('click', () => close(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });

    document.body.appendChild(overlay);
    // trigger transition on next frame
    requestAnimationFrame(() => overlay.classList.add('app-dialog-overlay--visible'));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Detect React Native WebView early so CSS can adapt
  if (window.__ONCE_METROS_NATIVE_WEBVIEW__) {
    document.body.classList.add('native-webview');
  }

  const page = detectPage();

  // Start session restore without blocking — pages that need auth will handle the
  // not-yet-authenticated state gracefully once the promise resolves
  const sessionPromise = API.restoreSession().then(user => {
    // Sync language from the user's persisted idioma preference (only if it
    // differs from what's currently stored, to avoid an infinite reload loop).
    if (user?.idioma) {
      const stored = localStorage.getItem('once_metros_lang');
      if (stored !== user.idioma) {
        localStorage.setItem('once_metros_lang', user.idioma);
        window.location.reload();
      }
    }
    return user;
  });

  // Pages that must know auth state before rendering anything
  const authBlockingPages = ['home', 'auth', 'invitacion', 'torneo-edit', 'partido-detalle'];

  if (authBlockingPages.includes(page)) {
    await sessionPromise;
  }

  updateAuthNav();
  initAccountMenu();

  // Redirect unauthenticated users from home to login
  if (!API.getToken() && page === 'home') {
    window.location.href = authRelativePath('auth.html');
    return;
  }

  switch (page) {
    case 'partido-detalle':  initPartidoDetalle(); break;
    case 'home':           initHome();          break;
    case 'partidos':       initPartidos();      break;
    case 'predicciones':   initPredicciones();  break;
    case 'clasificacion':  initClasificacion(); break;
    case 'auth':           initAuth();          break;
    case 'invitaciones':   initInvitaciones();  break;
    case 'invitacion':     initInviteLanding(); break;
    case 'torneos':        initTorneos();       break;
    case 'invitar':        initInvitar();       break;
    case 'perfil':         initPerfil();        break;
    case 'torneo-edit':    initTorneoEdit();    break;
  }

  // For non-blocking pages: once the session resolves, update the nav/account menu
  // so the avatar/Ingresar button reflects the real auth state
  if (!authBlockingPages.includes(page)) {
    sessionPromise.then(() => {
      updateAuthNav();
      initAccountMenu();
    });
  }
});

let matchesPollingId = null;

function detectPage() {
  const p = window.location.pathname;
  if (p.includes('partido-detalle'))  return 'partido-detalle';
  if (p.includes('invitaciones.html')) return 'invitaciones';
  if (p.includes('invitacion.html'))   return 'invitacion';
  if (p.includes('invitar.html'))      return 'invitar';
  if (p.includes('torneo-edit.html')) return 'torneo-edit';
  if (p.includes('partidos'))          return 'partidos';
  if (p.includes('predicciones'))      return 'predicciones';
  if (p.includes('clasificacion'))     return 'clasificacion';
  if (p.includes('torneos.html'))      return 'torneos';
  if (p.includes('auth'))              return 'auth';
  if (p.includes('perfil'))            return 'perfil';
  return 'home';
}

function updateAuthNav() {
  const user = API.getCurrentUser();
  document.querySelectorAll('[data-auth-link]').forEach(link => {
    link.textContent = user ? user.nombre || user.username : t('nav.signIn');
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
    // Always remove any existing menu so re-calling (e.g. after session restore)
    // replaces guest link with avatar — and prevents duplicates.
    navbar.querySelector('.account-menu')?.remove();
    navbar.querySelector('.nav-info-btn')?.remove();

    // ⓘ button — always visible, to the left of the hamburger/avatar
    const infoBtnEl = document.createElement('a');
    infoBtnEl.className = 'icon-btn nav-info-btn';
    infoBtnEl.href = pagePath('puntos.html');
    infoBtnEl.textContent = 'ⓘ';
    infoBtnEl.title = t('nav.howPoints');
    infoBtnEl.setAttribute('aria-label', t('nav.howPoints'));

    const user = API.getCurrentUser();
    const isNative = document.body.classList.contains('native-webview');
    const menu = document.createElement('div');
    menu.className = 'account-menu';

    if (isNative) {
      // ── Native WebView: hamburger + full-height right-side drawer ──
      // The drawer and backdrop are appended to document.body, NOT inside the
      // navbar, because the navbar's backdrop-filter creates a new stacking
      // context in Android WebView that clips position:fixed children even
      // when z-index is high.

      // Remove any leftover drawer from a previous call
      document.getElementById('native-side-drawer')?.remove();
      document.getElementById('native-side-drawer-backdrop')?.remove();

      // Hamburger button lives in the navbar
      menu.innerHTML = `
        <button class="account-menu__button" id="native-drawer-toggle" aria-label="${t('nav.menu')}">☰</button>
      `;
      navbar.appendChild(infoBtnEl);
      navbar.appendChild(menu);

      const avatarHtml = user
        ? fotoImg(user.fotoPerfil, user.nombre || user.username || 'U', 'width:100%;height:100%;object-fit:cover;border-radius:50%;')
        : '';

      const profileSection = user ? `
        <a class="native-side-drawer__profile" href="${pagePath('perfil.html')}">
          <div class="native-side-drawer__avatar">${avatarHtml}</div>
          <div>
            <div class="native-side-drawer__name">${escapeHtml(user.nombre || user.username)}</div>
            <div class="native-side-drawer__status">${t('nav.activeSession')}</div>
          </div>
        </a>` : '';

      const footerHtml = user
        ? `<button class="native-side-drawer__logout" id="native-drawer-logout">${t('nav.signOut')}</button>`
        : `<a class="btn btn-primary" style="width:100%;justify-content:center;" href="${authRelativePath('auth.html')}">${t('nav.signIn')}</a>`;

      // Backdrop
      const backdrop = document.createElement('div');
      backdrop.id = 'native-side-drawer-backdrop';
      backdrop.className = 'native-side-drawer__backdrop';

      // Drawer panel
      const drawer = document.createElement('div');
      drawer.id = 'native-side-drawer';
      drawer.className = 'native-side-drawer';
      drawer.innerHTML = `
        <div class="native-side-drawer__header">
          <span class="logo"><span class="logo-pulse"></span>Once Metros</span>
          <button class="icon-btn" id="native-drawer-close" aria-label="${t('nav.close')}" style="font-size:1rem;flex-shrink:0;">✕</button>
        </div>
        ${profileSection}
        <nav class="native-side-drawer__nav">
          <a href="${homeRelativePath()}">${t('nav.competitions')}</a>
          <a href="${pagePath('torneos.html')}">${t('nav.friendTournaments')}</a>
          ${user ? `<a href="${pagePath('perfil.html')}">${t('nav.myAccount')}</a>` : ''}
          <a href="${pagePath('ajustes.html')}">${t('nav.settings')}</a>
          <a href="${pagePath('puntos.html')}">${t('nav.howPoints')}</a>
        </nav>
        <div class="native-side-drawer__footer">
          ${footerHtml}
        </div>
      `;

      document.body.appendChild(backdrop);
      document.body.appendChild(drawer);

      function openDrawer()  { drawer.classList.add('open');    backdrop.classList.add('open'); }
      function closeDrawer() { drawer.classList.remove('open'); backdrop.classList.remove('open'); }

      document.getElementById('native-drawer-toggle').addEventListener('click', e => { e.stopPropagation(); openDrawer(); });
      document.getElementById('native-drawer-close')?.addEventListener('click', closeDrawer);
      backdrop.addEventListener('click', closeDrawer);
      document.getElementById('native-drawer-logout')?.addEventListener('click', () => {
        API.logout();
        window.location.href = authRelativePath('auth.html');
      });

      return;
    }

    if (!user) {
      // Guest: show a plain text link instead of the avatar circle
      menu.innerHTML = `
        <a class="account-menu__button account-menu__button--guest" href="${authRelativePath('auth.html')}">${t('nav.signIn')}</a>
      `;
      navbar.appendChild(infoBtnEl);
      navbar.appendChild(menu);
      return;
    }

    menu.innerHTML = `
      <button class="account-menu__button" data-menu-toggle aria-label="${t('nav.menu')}">
        ${fotoImg(user.fotoPerfil, user.nombre || user.username || 'U')}
      </button>
      <div class="account-drawer" data-menu-drawer>
        <div class="account-drawer__head">
          <strong>${escapeHtml(user.nombre || user.username)}</strong>
          <small>${t('nav.activeSession')}</small>
        </div>
        <a href="${authRelativePath('perfil.html')}">${t('nav.myAccount')}</a>
        <a href="${authRelativePath('ajustes.html')}">${t('nav.settings')}</a>
        <button data-menu-logout>${t('nav.signOut')}</button>
      </div>
    `;
    navbar.appendChild(infoBtnEl);
    navbar.appendChild(menu);
  });

  document.querySelectorAll('[data-menu-toggle]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      button.closest('.account-menu')?.classList.toggle('open');
    });
  });

  // Prevent clicks inside the desktop account drawer from bubbling and closing it immediately
  document.querySelectorAll('.account-drawer').forEach(drawer => {
    drawer.addEventListener('click', event => event.stopPropagation());
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
function translateAuthError(msg) {
  if (!msg) return msg;
  const m = msg.toLowerCase();
  if (m.includes('credenciales')) return t('auth.error.invalidCredentials');
  if (m.includes('ya existe una cuenta')) return t('auth.error.duplicateAccount');
  return msg; // pass through (already translated by api.js, or unknown)
}

function initAuth() {
  document.title = `${t('page.signIn')} | Once Metros`;

  // Support ?tab=login or ?tab=register to open a specific tab on load
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  if (tabParam) switchTab(tabParam);

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
      setAuthError(translateAuthError(error.message));
    }
  });

  registerForm?.addEventListener('submit', async event => {
    event.preventDefault();
    setAuthError('');

    const form = new FormData(registerForm);
    try {
      await API.register({
        username: form.get('username'),
        nombre:   form.get('nombre'),
        apellido: form.get('apellido'),
        email:    form.get('email'),
        password: form.get('password'),
      });
      redirectAfterAuth();
    } catch (error) {
      setAuthError(translateAuthError(error.message));
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
  // Google Sign-In doesn't work inside Android/iOS WebViews — the GSI script
  // intentionally blocks button rendering in embedded browsers.
  if (window.__ONCE_METROS_NATIVE_WEBVIEW__) return;
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
    setAuthError(translateAuthError(error.message));
  }
}

function setAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('hidden', !message);
}

/**
 * Returns the competition name in the current UI language.
 * Falls back to `nombre` (Spanish) when `nombreEn` is not set.
 */
function competenciaNombre(competencia) {
  if (!competencia) return '';
  if (I18n.getLang() === 'en' && competencia.nombreEn) return competencia.nombreEn;
  return competencia.nombre || '';
}

function equipoNombre(partido, num) {
  if (I18n.getLang() === 'en') {
    const en = num === 1 ? partido.equipo1NombreEn : partido.equipo2NombreEn;
    if (en) return en;
  }
  return num === 1 ? partido.equipo1 : partido.equipo2;
}

/**
 * Returns the display name for a torneo.
 * Global (Once Metros) torneos are shown as "Once Metros - <competition>".
 */
function torneoNombre(torneo) {
  if (!torneo) return '';
  if (torneo.esGlobal) return `Once Metros - ${competenciaNombre(torneo.competencia)}`;
  return torneo.nombre || '';
}

/* --------------------------------------------------------
   HOME: COMPETENCIAS -> PREDICCIONES / TORNEOS DE AMIGOS
   -------------------------------------------------------- */
function initHome() {
  // Always start on "Próximos" filter regardless of HTML defaults
  document.querySelectorAll('.filter-chip[data-group="estado"]')
    .forEach(c => c.classList.remove('active'));
  document.querySelector('.filter-chip[data-group="estado"][data-value="proximo"]')
    ?.classList.add('active');

  loadCompetencias();
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
      listEl.innerHTML = emptyState(t('empty.noCompetitions'));
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

    if (active && !new URLSearchParams(window.location.search).has('reset') && window.location.hash) {
      selectCompetencia(active, window.location.hash.replace('#', '') || 'predicciones');
    } else {
      API.setSelectedCompetencia(null);
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
  setText('competencia-title', competenciaNombre(competencia));
  switchHomeTab(preferredTab === 'torneos' ? 'torneos' : 'predicciones');
  await loadPartidos();
  startMatchesPolling();
  await loadTorneosForCompetencia(competencia);
}

function renderCompetenciaCard(competencia, active) {
  return `
    <button class="competition-card ${active ? 'active' : ''}" data-competencia-id="${competencia.id}">
      <span class="competition-card__name">${escapeHtml(competenciaNombre(competencia))}</span>
    </button>
  `;
}

async function loadTorneosForCompetencia(competencia = API.getSelectedCompetencia()) {
  const listEl = document.getElementById('torneos-list');
  const createBtn = document.getElementById('create-torneo-btn');
  if (!listEl || !competencia) return;

  showSkeleton(listEl, 2);

  if (createBtn) {
    const show = !!API.getToken();
    createBtn.style.display = show ? '' : 'none';
    createBtn.classList.toggle('hidden', !show);
    if (show) createBtn.href = `pages/torneo-edit.html?competenciaId=${encodeURIComponent(competencia.id)}`;
  }

  if (!API.getToken()) {
    listEl.innerHTML = emptyState('Iniciá sesión para ver los Torneos de Amigos.');
    return;
  }

  try {
    const torneos = await API.getTorneosDeAmigos({ mias: 'true', competenciaId: competencia.id });
    if (!torneos.length) {
      listEl.innerHTML = emptyState('Todavía no sos parte de ningún Torneo de Amigos para esta competencia.');
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
  const n = torneo.miembrosCount ?? 0;
  const miembros = torneo.esGlobal
    ? (n === 1 ? `👤 ${t('members.one')}` : `👥 ${t('members.many', { n })}`)
    : (n === 1 ? `👤 ${t('members.one')}` : `👥 ${t('members.many', { n })}`);
  return `
    <button class="tournament-card ${active ? 'active' : ''}" data-torneo-id="${torneo.id}">
      <span>
        <strong>${escapeHtml(torneoNombre(torneo))}</strong>
        ${torneo.esGlobal ? '' : `<small>${escapeHtml(competenciaNombre(torneo.competencia) || '')}</small>`}
      </span>
      <span class="tournament-card__meta">${miembros}</span>
    </button>
  `;
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

  // Always start on "Próximos" regardless of HTML defaults or browser cache
  document.querySelectorAll('.filter-chip[data-group="estado"]')
    .forEach(c => c.classList.remove('active'));
  document.querySelector('.filter-chip[data-group="estado"][data-value="proximo"]')
    ?.classList.add('active');

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

  // Don't re-render while the user is actively filling in a prediction
  if (quiet && el.querySelector('.score-box:focus')) return;

  const competencia = API.getSelectedCompetencia();
  if (!competencia) {
    el.innerHTML = emptyState(t('empty.chooseCompetition'));
    return;
  }

  const active = document.querySelector('.filter-chip[data-group="estado"].active');
  const estado = active?.dataset.value || '';

  if (!quiet) showSkeleton(el, 4);

  try {
    const matches = await API.getMatches({ competenciaId: competencia.id, estado });
    el.innerHTML = '';
    if (!matches.length) {
      el.innerHTML = emptyState(t('empty.noMatches'));
      return;
    }
    matches.forEach(m => {
      const card = Predictions.createMatchCard(m);
      card.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        const torneo = API.getSelectedTorneo();
        const dest = pagePath('partido-detalle');
        const params = new URLSearchParams({ partidoId: m.id });
        if (torneo) params.set('torneoId', torneo.id);
        else if (m.competenciaId) params.set('competenciaId', m.competenciaId);
        window.location.href = `${dest}?${params}`;
      });
      el.appendChild(card);
    });
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
      : emptyState(t('empty.noPendingPreds'));
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
      : emptyState(t('empty.noHistory'));
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
  const label = pred.estado === 'acierto' ? t('pred.hit') : pred.estado === 'fallo' ? t('pred.miss') : t('pred.pending');
  const pts   = pred.puntos > 0 ? `+${pred.puntos}` : '-';
  const score = `${pred.scoreEquipo1Pred ?? '?'}-${pred.scoreEquipo2Pred ?? '?'}`;
  const ligaDisplay = I18n.getLang() === 'en' && pred.ligaEn ? pred.ligaEn : (pred.liga || '');
  const metaNote = `${escapeHtml(ligaDisplay)} · ${t('pred.myPred', { score })}`;
  const rowCls = pred.estado === 'acierto' ? 'is-hit' : pred.estado === 'fallo' ? 'is-miss' : '';
  return `
    <div class="pred-row ${rowCls}">
      <div class="pred-match">
        <div class="pred-match-name">${escapeHtml(I18n.getLang() === 'en' && pred.equipo1NombreEn ? pred.equipo1NombreEn : pred.equipo1)} vs ${escapeHtml(I18n.getLang() === 'en' && pred.equipo2NombreEn ? pred.equipo2NombreEn : pred.equipo2)}</div>
        <div class="pred-match-meta">${metaNote}</div>
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
async function initClasificacion() {
  renderSelectedContext();
  await loadSelectedTorneoHeader();
  initClasifTabs();
  loadLeaderboard();
  initTorneoActionMenu();
}

function initClasifTabs() {
  document.querySelectorAll('[data-clasif-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchClasifTab(btn.dataset.clasifTab));
  });
}

function switchClasifTab(tab) {
  document.querySelectorAll('[data-clasif-tab]').forEach(b => b.classList.toggle('active', b.dataset.clasifTab === tab));
  document.getElementById('clasif-tab-posiciones')?.classList.toggle('hidden', tab !== 'posiciones');
  const predTab = document.getElementById('clasif-tab-predicciones');
  if (predTab) {
    predTab.classList.toggle('hidden', tab !== 'predicciones');
    if (tab === 'predicciones' && !predTab.dataset.loaded) {
      predTab.dataset.loaded = '1';
      loadMisPrediccionesEnTorneo();
    }
  }
}

async function loadMisPrediccionesEnTorneo() {
  const el = document.getElementById('mis-predicciones-list');
  if (!el) return;
  const torneo = API.getSelectedTorneo();
  if (!torneo) {
    el.innerHTML = emptyState(t('empty.chooseTorneo'));
    return;
  }
  if (!API.getToken()) {
    el.innerHTML = emptyState(t('empty.signInForPreds'));
    return;
  }
  showSkeleton(el, 4);
  const competenciaId = torneo.competenciaId || torneo.competencia?.id;
  try {
    // Show upcoming matches for this competition so the user can make predictions
    const matches = await API.getMatches({ competenciaId, estado: 'proximo' });
    el.innerHTML = '';
    if (!matches.length) {
      el.innerHTML = emptyState(t('empty.noUpcoming'));
      return;
    }
    matches.forEach(m => {
      const card = Predictions.createMatchCard(m);
      card.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        const dest = pagePath('partido-detalle');
        window.location.href = `${dest}?torneoId=${encodeURIComponent(torneo.id)}&partidoId=${encodeURIComponent(m.id)}`;
      });
      el.appendChild(card);
    });
  } catch (err) {
    el.innerHTML = errorState(err.message);
  }
}

function initInviteButton() { /* kept for compat — logic moved to initTorneoActionMenu */ }

async function initInvitePanel() {
  // Legacy: no-op, kept for safety
}

function initEditTorneoButton() { /* kept for compat — logic moved to initTorneoActionMenu */ }

async function initTorneoActionMenu() {
  const toggleBtn  = document.getElementById('torneo-action-toggle');
  const menuEl     = document.getElementById('torneo-action-menu');
  const inviteBtn  = document.getElementById('invite-btn');
  const editBtn    = document.querySelector('[data-torneo-action="edit"]');
  const leaveBtn   = document.querySelector('[data-torneo-action="leave"]');
  const deleteBtn  = document.querySelector('[data-torneo-action="delete"]');

  const selected = API.getSelectedTorneo();
  if (!selected) return;

  // Ensure token is in memory before checking auth
  if (!API.getToken()) {
    try { await API.restoreSession(); } catch { /* not logged in */ }
  }
  const user = API.getCurrentUser();

  let torneo;
  try {
    torneo = await API.getTorneoDeAmigos(selected.id);
  } catch { return; }

  const isCreador = user && torneo.creadorId === user.id;
  const isMember  = user && (isCreador || torneo.usuarios?.some(u => u.id === user.id));

  // Global torneos: no invite link, no edit/leave/delete
  if (torneo.esGlobal) {
    inviteBtn?.classList.add('hidden');
    menuEl?.classList.add('hidden');
    return;
  }

  // Show relevant actions based on role
  if (isCreador) {
    editBtn?.classList.remove('hidden');
    deleteBtn?.classList.remove('hidden');
  }
  if (isMember && !isCreador) {
    leaveBtn?.classList.remove('hidden');
  }

  // Show invite button for all members
  if (isMember) {
    inviteBtn?.classList.remove('hidden');
  }

  let inviteUrl = null;
  let inviteLinkReady = false;
  let nativeShareRequestId = null;
  let nativeShareFallbackTimer = null;

  // Pre-load (and auto-generate for creators) the invite link in the background
  // so the share sheet opens instantly when the user taps Invite.
  async function preloadInviteLink() {
    try {
      const r = await API.getInviteLink(torneo.id);
      inviteUrl = r.url || null;
    } catch {}
    if (!inviteUrl && isCreador) {
      try {
        const r = await API.generarInviteLink(torneo.id);
        inviteUrl = r.url || null;
      } catch {}
    }
    inviteLinkReady = true;
    // Re-enable the button if it was put in loading state while we were fetching
    if (inviteBtn && inviteBtn.dataset.inviteLoading) {
      delete inviteBtn.dataset.inviteLoading;
      inviteBtn.disabled = false;
      inviteBtn.textContent = t('action.invite');
      if (inviteUrl) triggerShare();
    }
  }

  function nativeAlert(msg) {
    if (window.__ONCE_METROS_NATIVE_WEBVIEW__) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ALERT', message: msg })); } catch {}
    } else {
      alert(msg);
    }
  }

  function showInviteCopiedFeedback() {
    if (!inviteBtn) return;
    const orig = inviteBtn.textContent;
    inviteBtn.textContent = t('action.linkCopied');
    inviteBtn.disabled = true;
    setTimeout(() => { inviteBtn.textContent = orig; inviteBtn.disabled = false; }, 2000);
  }

  async function copyInviteUrlToClipboard() {
    if (!inviteUrl) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        return true;
      }
    } catch {}

    const ta = document.createElement('textarea');
    ta.value = inviteUrl;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }

  async function fallbackCopyInviteUrl() {
    if (!inviteUrl) return;
    if (await copyInviteUrlToClipboard()) {
      showInviteCopiedFeedback();
    } else {
      prompt(t('share.promptCopy'), inviteUrl);
    }
  }

  function finishNativeShareRequest(requestId, shouldFallback) {
    if (!requestId || requestId !== nativeShareRequestId) return;
    nativeShareRequestId = null;
    if (nativeShareFallbackTimer) {
      clearTimeout(nativeShareFallbackTimer);
      nativeShareFallbackTimer = null;
    }
    if (shouldFallback) fallbackCopyInviteUrl();
  }

  window.__ONCE_METROS_NATIVE_SHARE_RESULT__ = result => {
    if (!result || result.type !== 'SHARE_RESULT') return;
    if (result.status === 'received') {
      if (result.requestId !== nativeShareRequestId) return;
      if (nativeShareFallbackTimer) {
        clearTimeout(nativeShareFallbackTimer);
        nativeShareFallbackTimer = null;
      }
      return;
    }
    finishNativeShareRequest(result.requestId, result.status === 'error');
  };

  function triggerShare() {
    if (!inviteUrl) return;
    const shareTitle = t('share.title', { name: torneoNombre(torneo) });
    const shareText  = t('share.text', { competition: competenciaNombre(torneo.competencia) || 'Fútbol' });
    if (window.__ONCE_METROS_NATIVE_WEBVIEW__) {
      const bridge = window.ReactNativeWebView;
      if (!bridge?.postMessage) {
        fallbackCopyInviteUrl();
        return;
      }
      const requestId = `share-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      nativeShareRequestId = requestId;
      if (nativeShareFallbackTimer) clearTimeout(nativeShareFallbackTimer);
      nativeShareFallbackTimer = setTimeout(() => {
        finishNativeShareRequest(requestId, true);
      }, 2000);
      try {
        bridge.postMessage(JSON.stringify({
          type: 'SHARE', requestId, title: shareTitle, text: shareText, url: inviteUrl,
        }));
      } catch {
        finishNativeShareRequest(requestId, true);
      }
    } else {
      fallbackCopyInviteUrl();
    }
  }

  if (isMember) preloadInviteLink();

  // Toggle open/close
  toggleBtn?.addEventListener('click', e => {
    e.stopPropagation();
    menuEl?.classList.toggle('open');
  });
  document.addEventListener('click', () => menuEl?.classList.remove('open'), { capture: false });

  // Rename (navigate to edit page)
  editBtn?.addEventListener('click', () => {
    window.location.href = `torneo-edit.html?id=${encodeURIComponent(torneo.id)}`;
  });

  // Invite button (standalone)
  inviteBtn?.addEventListener('click', () => {
    if (inviteLinkReady) {
      if (!inviteUrl) {
        nativeAlert(isCreador ? t('alert.inviteLinkError') : t('alert.noInviteLink'));
        return;
      }
      triggerShare();
    } else {
      // Still fetching — show loading state; triggerShare() will fire once ready
      inviteBtn.dataset.inviteLoading = '1';
      inviteBtn.disabled = true;
      inviteBtn.textContent = '...';
    }
  });
  leaveBtn?.addEventListener('click', async () => {
    menuEl?.classList.remove('open');
    if (!await appConfirm(t('confirm.leaveTorneo', { name: torneoNombre(torneo) }), { confirmText: t('action.leave'), cancelText: t('action.cancel') })) return;
    leaveBtn.disabled = true;
    try {
      await API.leaveTorneoDeAmigos(torneo.id);
      API.setSelectedTorneo(null);
      window.location.href = 'torneos.html';
    } catch (err) {
      alert(err.message || t('alert.leaveTorneoError'));
      leaveBtn.disabled = false;
    }
  });

  // Delete torneo (creators only)
  deleteBtn?.addEventListener('click', async () => {
    menuEl?.classList.remove('open');
    if (!await appConfirm(t('confirm.deleteTorneo', { name: torneoNombre(torneo) }), { confirmText: t('action.delete'), cancelText: t('action.cancel'), danger: true })) return;
    deleteBtn.disabled = true;
    try {
      await API.deleteTorneoDeAmigos(torneo.id);
      API.setSelectedTorneo(null);
      window.location.href = '../index.html#torneos';
    } catch (err) {
      alert(err.message || t('alert.deleteTorneoError'));
      deleteBtn.disabled = false;
    }
  });
}

/* --------------------------------------------------------
   INVITAR (standalone page)
   -------------------------------------------------------- */
async function initInvitar() {
  const params = new URLSearchParams(window.location.search);
  const torneoId = params.get('torneo');

  if (!API.getToken()) {
    const next = encodeURIComponent(`invitar.html?torneo=${torneoId}`);
    window.location.href = `auth.html?next=${next}`;
    return;
  }

  if (!torneoId) {
    window.location.href = 'torneos.html';
    return;
  }

  let torneo;
  try {
    torneo = await API.getTorneoDeAmigos(torneoId);
  } catch {
    window.location.href = 'torneos.html';
    return;
  }

  const user = API.getCurrentUser();
  if (torneo.creadorId !== user?.id) {
    window.location.href = `clasificacion.html`;
    return;
  }

  const titleEl = document.getElementById('invite-torneo-title');
  const labelEl = document.getElementById('invite-torneo-label');
  if (titleEl) titleEl.textContent = torneoNombre(torneo);
  if (labelEl) labelEl.innerHTML = `<span class="dot"></span>${escapeHtml(competenciaNombre(torneo.competencia) || 'Torneo de amigos')}`;

  const backBtn = document.getElementById('invite-back-btn');
  if (backBtn) backBtn.href = 'clasificacion.html';

  const form = document.getElementById('invite-search-form');
  const input = document.getElementById('invite-identificador');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    setInviteFeedback('');
    try {
      await API.invitarAlTorneo(torneo.id, value);
      setInviteFeedback(t('feedback.invitationSent', { value }), 'success');
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
      setInviteFeedback(t('feedback.linkRegenerated'), 'success');
    } catch (err) { setInviteFeedback(err.message, 'error'); }
  });
  document.getElementById('invite-link-revoke')?.addEventListener('click', async () => {
    if (!await appConfirm(t('confirm.revokeLink'), { confirmText: t('action.revoke'), cancelText: t('action.cancel'), danger: true })) return;
    try {
      await API.revocarInviteLink(torneo.id);
      setInviteLinkUrl(null);
      setInviteFeedback(t('feedback.linkRevoked'), 'success');
    } catch (err) { setInviteFeedback(err.message, 'error'); }
  });
  document.getElementById('invite-link-copy')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('invite-link-url');
    if (!urlInput?.value) return;
    try {
      await navigator.clipboard.writeText(urlInput.value);
      setInviteFeedback(t('feedback.linkCopied'), 'success');
    } catch {
      urlInput.select();
      document.execCommand('copy');
      setInviteFeedback(t('feedback.linkCopied'), 'success');
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
      list.innerHTML = emptyState(t('empty.noSentInvitations'));
      return;
    }
    list.innerHTML = invitaciones.map(renderInviteSentRow).join('');
    list.querySelectorAll('[data-cancel-invitacion]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!await appConfirm(t('confirm.cancelInvite'), { confirmText: t('action.cancelInvitation'), cancelText: t('action.back') })) return;
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
    ? `<button class="btn btn-outline btn-sm" data-cancel-invitacion="${inv.id}">${t('action.cancel')}</button>`
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
    PENDIENTE: t('inviteStatus.pending'),
    ACEPTADA: t('inviteStatus.accepted'),
    RECHAZADA: t('inviteStatus.rejected'),
    CANCELADA: t('inviteStatus.cancelled'),
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
      list.innerHTML = emptyState(t('empty.noInvitations'));
      return;
    }
    list.innerHTML = invitaciones.map(renderInviteInboxCard).join('');
    list.querySelectorAll('[data-accept]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.aceptarInvitacion(btn.dataset.accept);
          setInvitacionesFeedback(t('feedback.joined'), 'success');
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
        <strong>${escapeHtml(torneoNombre(torneo) || 'Torneo')}</strong>
        <small>${escapeHtml(competenciaNombre(competencia) || '')} · te invitó @${escapeHtml(sender.username || '?')}</small>
      </div>
      <div class="invite-inbox-card__actions">
        <button class="btn btn-primary" data-accept="${inv.id}">${t('action.accept')}</button>
        <button class="btn btn-outline" data-reject="${inv.id}">${t('action.reject')}</button>
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
/* --------------------------------------------------------
   PARTIDO DETALLE — match card + per-match ranking
   -------------------------------------------------------- */
async function initPartidoDetalle() {
  const params     = new URLSearchParams(window.location.search);
  let   torneoId   = params.get('torneoId');
  const partidoId  = params.get('partidoId');
  const competenciaId = params.get('competenciaId');

  document.getElementById('back-btn')?.addEventListener('click', () => history.back());

  const cardContainer = document.getElementById('match-card-container');
  const rankingList   = document.getElementById('match-ranking-list');

  // Guard against invalid/missing params (e.g. direct URL navigation without query string)
  const validId = id => id && id !== 'null' && id !== 'undefined';
  if (!validId(partidoId)) {
    if (cardContainer) cardContainer.innerHTML = emptyState(t('empty.noMatches'));
    if (rankingList) rankingList.innerHTML = '';
    return;
  }

  // If no torneoId was passed (e.g. clicked from partidos.html without a torneo
  // selected), try to find the global torneo for this competition.
  if (!torneoId && competenciaId) {
    try {
      const torneos = await API.getTorneosDeAmigos({ competenciaId });
      const global = torneos.find(t => t.esGlobal);
      if (global) torneoId = global.id;
    } catch { /* leave torneoId null */ }
  }

  if (!torneoId) {
    // No torneo available — still render the match card without a ranking
    rankingList && (rankingList.innerHTML = emptyState(t('empty.chooseTorneo')));
    if (cardContainer) {
      showSkeleton(cardContainer, 1);
      try {
        const partido = await API.getMatch(partidoId);
        cardContainer.innerHTML = '';
        cardContainer.appendChild(Predictions.createMatchCard(partido));
      } catch (err) {
        cardContainer.innerHTML = errorState(err.message);
      }
    }
    return;
  }

  showSkeleton(cardContainer, 1);
  rankingList && showSkeleton(rankingList, 5);

  let data;
  try {
    data = await API.getMatchPredicciones(torneoId, partidoId);
  } catch (err) {
    cardContainer && (cardContainer.innerHTML = errorState(err.message));
    rankingList   && (rankingList.innerHTML   = '');
    return;
  }

  const { partido, entries, torneo: torneoData } = data;

  // Update page title with competition name + torneo name
  if (torneoData) {
    document.title = `${torneoNombre(torneoData)} | Once Metros`;
  }

  // Match card
  cardContainer && (cardContainer.innerHTML = '');
  if (cardContainer) cardContainer.appendChild(Predictions.createMatchCard(partido));

  const podiumEl   = document.getElementById('match-podium');
  if (!rankingList) return;

  if (!entries.length) {
    if (podiumEl) podiumEl.innerHTML = '';
    rankingList.innerHTML = emptyState(t('empty.noScoresYet'));
    return;
  }

  // Predictions are private until the match starts (prediccionEditable === false means locked)
  const locked = partido.prediccionEditable === false ||
                 partido.estado === 'en-vivo' ||
                 partido.estado === 'finalizado';

  // Build ranking array. Before kick-off: alphabetical, no pts shown. After: sorted by pts.
  const ranked = entries
    .map(e => ({
      usuarioId:  e.usuario.id,
      nombre:     e.usuario.nombre || e.usuario.username,
      fotoPerfil: e.usuario.fotoPerfil || null,
      puntos:     locked ? (e.prediccion?.puntos ?? null) : null,
      aciertos:   0,
      exactos:    0,
      predScore:  e.prediccion ? `${e.prediccion.golesEquipo1}-${e.prediccion.golesEquipo2}` : null,
      hasPred:    !!e.prediccion,
    }))
    .sort((a, b) => {
      if (!locked) return (a.nombre || '').localeCompare(b.nombre || '');
      if (a.puntos === null && b.puntos === null) return 0;
      if (a.puntos === null) return 1;
      if (b.puntos === null) return -1;
      return b.puntos - a.puntos;
    });

  const positions = computePositions(ranked);

  // Notice shown above the list before kick-off
  const noticeEl = document.getElementById('match-ranking-notice');
  if (noticeEl) noticeEl.classList.toggle('hidden', locked);

  const matchSubLine = r => locked
    ? (r.hasPred ? escapeHtml(r.predScore) : `<span style="color:var(--text-3)">${t('match.noPred')}</span>`)
    : `<span style="color:var(--text-3)">${t('match.predsHidden')}</span>`;

  renderRankingInto(podiumEl, rankingList, ranked, positions, {
    subLineFn: matchSubLine,
    clickable: false,
  });
}

async function initInviteLanding() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const title = document.getElementById('invite-landing-title');
  const meta = document.getElementById('invite-landing-meta');
  const actions = document.getElementById('invite-landing-actions');

  if (!token) {
    title.textContent = t('torneo.invalidInvite');
    meta.textContent = t('torneo.missingToken');
    actions.innerHTML = `<a class="btn btn-primary" href="../index.html">${t('action.goHome')}</a>`;
    return;
  }

  let torneo;
  try {
    torneo = await API.getTorneoPorInviteToken(token);
  } catch (err) {
    title.textContent = t('torneo.invalidInviteRevoked');
    meta.textContent = err.message;
    actions.innerHTML = `<a class="btn btn-primary" href="../index.html">${t('action.goHome')}</a>`;
    return;
  }

  title.textContent = t('torneo.joinTitle', { name: torneoNombre(torneo) });
  meta.textContent = competenciaNombre(torneo.competencia) || '';

  if (!API.getToken()) {
    const next = encodeURIComponent(`invitacion.html?token=${token}`);
    actions.innerHTML = `
      <a class="btn btn-primary" href="auth.html?next=${next}">${t('action.signInToJoin')}</a>
      <a class="btn btn-outline" href="../index.html">${t('action.seeCompetitions')}</a>
    `;
    return;
  }

  actions.innerHTML = `<button class="btn btn-primary" id="invite-landing-join">${t('action.joinTournament')}</button>`;
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
    if (title) title.textContent = torneoNombre(torneo);
    if (subtitle) subtitle.textContent = competenciaNombre(torneo.competencia) || t('section.friendTournamentCap');
  } catch {
    if (title) title.textContent = torneoNombre(selected) || t('section.friendTournamentCap');
  }
}

function computePositions(ranking) {
  const positions = [];
  for (let i = 0; i < ranking.length; i++) {
    if (i === 0) {
      positions.push(1);
    } else {
      const prev = ranking[i - 1];
      const curr = ranking[i];
      const tied = curr.puntos === prev.puntos &&
                   curr.aciertos === prev.aciertos &&
                   curr.exactos === prev.exactos;
      positions.push(tied ? positions[i - 1] : i + 1);
    }
  }
  return positions;
}

async function loadLeaderboard() {
  const podiumEl  = document.getElementById('podium');
  const rankingEl = document.getElementById('ranking-list');
  if (!rankingEl) return;

  if (!API.getSelectedTorneo()) {
    if (podiumEl) podiumEl.innerHTML = '';
    rankingEl.innerHTML = emptyState(t('empty.chooseTorneoRank'));
    return;
  }

  try {
    const ranking = await API.getLeaderboard();
    const positions = computePositions(ranking);

    if (!ranking.length) {
      if (podiumEl) podiumEl.innerHTML = '';
      rankingEl.innerHTML = emptyState(t('empty.noScoresYet'));
      return;
    }

    renderRankingInto(podiumEl, rankingEl, ranking, positions);

  } catch (error) {
    if (podiumEl) podiumEl.innerHTML = '';
    rankingEl.innerHTML = errorState(error.message);
  }
}

async function loadTournamentUpcomingMatches() {
  const el = document.getElementById('torneo-upcoming-matches');
  if (!el) return;

  const torneo = API.getSelectedTorneo();
  const competenciaId = torneo?.competenciaId || torneo?.competencia?.id || API.getSelectedCompetencia()?.id;

  if (!torneo || !competenciaId) {
    el.innerHTML = emptyState(t('empty.chooseTorneoMatch'));
    return;
  }

  showSkeleton(el, 3);

  try {
    const matches = await API.getMatches({ competenciaId, estado: 'proximo' });
    const upcoming = matches
      .filter(match => new Date(match.fecha) >= new Date())
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .slice(0, 3);

    el.innerHTML = '';
    if (!upcoming.length) {
      el.innerHTML = emptyState(t('empty.noUpcomingTorneo'));
      return;
    }

    upcoming.forEach(match => el.appendChild(Predictions.createMatchCard(match)));
  } catch (error) {
    el.innerHTML = errorState(error.message);
  }
}

/**
 * Renders a single ranking row.
 * @param {object} r - ranking entry (usuarioId, nombre, fotoPerfil, puntos, aciertos, exactos)
 * @param {number} pos - display position (1-based, accounts for ties)
 * @param {(r: object) => string} [subLineFn] - optional override for the sub-line text; defaults to hits/exact
 */
function renderRankRow(r, pos, subLineFn) {
  const posEl = pos === 1 ? `<span class="medal medal-1">1</span>`
              : pos === 2 ? `<span class="medal medal-2">2</span>`
              : pos === 3 ? `<span class="medal medal-3">3</span>`
              : `<span class="rank-pos">${pos}</span>`;
  const avatarInner = fotoImg(r.fotoPerfil, r.nombre);
  const sub = subLineFn
    ? subLineFn(r)
    : `${r.aciertos ?? 0} ${t('stat.hitsLc')} · ${r.exactos ?? 0} ${t('stat.exactLc')}`;
  return `
    <div class="ranking-row" data-user-id="${escapeHtml(r.usuarioId || '')}" data-user-name="${escapeHtml(r.nombre)}">
      ${posEl}
      <div class="rank-avatar">${avatarInner}</div>
      <div class="rank-info">
        <div class="rank-name">${escapeHtml(r.nombre)}</div>
        <div class="rank-sub">${sub}</div>
      </div>
      <div class="rank-right">
        <div class="rank-pts">${r.puntos ?? '—'}</div>
        <span class="rank-pts-label">${t('stat.pts')}</span>
      </div>
    </div>
  `;
}

/**
 * Renders a full podium + ranking list into the given DOM elements.
 * Both loadLeaderboard and initPartidoDetalle call this.
 * @param {HTMLElement|null} podiumEl
 * @param {HTMLElement} rankingEl
 * @param {object[]} ranked - sorted ranking entries
 * @param {number[]} positions - parallel position array from computePositions
 * @param {{ subLineFn?: (r: object) => string, clickable?: boolean }} opts
 */
function renderRankingInto(podiumEl, rankingEl, ranked, positions, { subLineFn, clickable = true } = {}) {
  if (podiumEl) {
    const top    = ranked.slice(0, 3);
    const order  = [top[1], top[0], top[2]];
    const topPos = [positions[1], positions[0], positions[2]];
    const mCls   = ['medal medal-2', 'medal medal-1', 'medal medal-3'];
    const pCls   = ['podium-item--2', 'podium-item--1', 'podium-item--3'];
    podiumEl.innerHTML = order.map((r, i) => r ? `
      <div class="podium-item ${pCls[i]}"${clickable ? ` data-user-id="${escapeHtml(r.usuarioId || '')}" data-user-name="${escapeHtml(r.nombre)}"` : ''}>
        <span class="${mCls[i]}">${topPos[i] ?? i + 1}</span>
        <div class="podium-avatar">${fotoImg(r.fotoPerfil, r.nombre)}</div>
        <div class="podium-name">${escapeHtml(r.nombre)}</div>
        <div class="podium-pts">${r.puntos ?? '—'} ${t('stat.pts')}</div>
        <div class="podium-bar"></div>
      </div>` : '').join('');
  }

  const rest = ranked.slice(3);
  rankingEl.innerHTML = rest.length
    ? rest.map((r, i) => renderRankRow(r, positions[i + 3], subLineFn)).join('')
    : '';

  if (clickable) {
    const root = podiumEl ? podiumEl.parentElement : rankingEl.parentElement;
    root?.querySelectorAll('[data-user-id]').forEach(el => {
      el.addEventListener('click', () => {
        const userId = el.dataset.userId;
        const userName = el.dataset.userName;
        if (userId) openUserPredsDrawer(userId, userName);
      });
    });
  }
}

function renderSelectedContext() {
  const el = document.getElementById('selected-context');
  if (!el) return;
  const competencia = API.getSelectedCompetencia();
  const torneo = API.getSelectedTorneo();
  const isPredictionsView = window.location.pathname.includes('partidos');

  if (isPredictionsView) {
    el.innerHTML = `<span>${escapeHtml(competencia?.nombre || t('empty.noCompetencia'))}</span>`;
    return;
  }

  el.innerHTML = `
    <span>${escapeHtml(competencia?.nombre || t('empty.noCompetencia'))}</span>
    <strong>${escapeHtml(torneo?.nombre || t('empty.noTorneo'))}</strong>
    <a class="btn btn-outline btn-sm" href="${homeRelativePath('#torneos')}">${t('action.change')}</a>
  `;
}

/* --------------------------------------------------------
   USER PREDICTIONS DRAWER
   -------------------------------------------------------- */
function openUserPredsDrawer(userId, userName) {
  const overlay = document.getElementById('user-preds-overlay');
  const drawer = document.getElementById('user-preds-drawer');
  const nameEl = document.getElementById('user-preds-name');
  const listEl = document.getElementById('user-preds-list');
  if (!overlay || !drawer || !listEl) return;

  if (nameEl) nameEl.textContent = userName;
  overlay.classList.remove('hidden');
  overlay.removeAttribute('aria-hidden');
  drawer.classList.remove('hidden');
  drawer.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';

  showSkeleton(listEl, 4);

  const torneo = API.getSelectedTorneo();
  if (!torneo?.id) {
    listEl.innerHTML = emptyState(t('empty.tournamentNotFound'));
    return;
  }

  API.getPrediccionesUsuarioEnTorneo(torneo.id, userId)
    .then(partidos => {
      if (!partidos.length) {
        listEl.innerHTML = emptyState(t('empty.noClosedMatches'));
        return;
      }
      listEl.innerHTML = '';
      partidos.forEach(p => listEl.appendChild(Predictions.createMatchCard(p)));
    })
    .catch(err => {
      listEl.innerHTML = errorState(err.message);
    });

  overlay.onclick = closeUserPredsDrawer;
  document.getElementById('user-preds-close')?.addEventListener('click', closeUserPredsDrawer, { once: true });
}

function closeUserPredsDrawer() {
  const overlay = document.getElementById('user-preds-overlay');
  const drawer = document.getElementById('user-preds-drawer');
  overlay?.classList.add('hidden');
  overlay?.setAttribute('aria-hidden', 'true');
  drawer?.classList.add('hidden');
  drawer?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function renderUserPredRow(partido) {
  const pred = partido.userPred;
  const fecha = partido.fecha ? new Date(partido.fecha).toLocaleDateString(t('localeDate'), { day: '2-digit', month: 'short' }) : '';
  const resultadoReal = partido.scoreEquipo1 != null ? `${partido.scoreEquipo1}-${partido.scoreEquipo2}` : '-';
  const predScore = pred ? `${pred.scoreEquipo1}-${pred.scoreEquipo2}` : '?-?';
  const cls = !pred ? 'no-pred' : pred.estado === 'acierto' ? 'is-hit' : 'is-miss';
  const tag = !pred
    ? `<span class="pred-tag no-pred">${t('pred.noPred')}</span>`
    : pred.estado === 'acierto'
      ? `<span class="pred-tag hit">${t('pred.hit')}</span>`
      : `<span class="pred-tag miss">${t('pred.miss')}</span>`;

  return `
    <div class="user-pred-row ${cls}">
      <div class="user-pred-match">
        <div class="user-pred-teams">${escapeHtml(equipoNombre(partido, 1))} vs ${escapeHtml(equipoNombre(partido, 2))}</div>
        <div class="user-pred-meta">${fecha} · ${escapeHtml(partido.liga || '')}</div>
      </div>
      <div class="user-pred-scores">
        <span class="user-pred-result">${resultadoReal}</span>
        <span class="user-pred-sep">›</span>
        <span class="user-pred-pick">${predScore}</span>
      </div>
      ${tag}
    </div>
  `;
}

/* --------------------------------------------------------
   TORNEOS (standalone page)
   -------------------------------------------------------- */
async function initTorneos() {
  const listEl = document.getElementById('torneos-list');
  const feedbackEl = document.getElementById('torneos-feedback');
  if (!listEl) return;

  // If restoreSession on page load failed (e.g. rotated token race),
  // try once more before giving up.
  if (!API.getToken() && API.getCurrentUser()) {
    await API.restoreSession();
  }

  if (!API.getToken()) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">!</div>
        <p>${escapeHtml(t('empty.signInForTorneoPage'))}</p>
        <a href="auth.html?next=torneos.html" class="btn btn-primary" style="margin-top:.75rem">${t('nav.signIn')}</a>
      </div>
    `;
    return;
  }

  showSkeleton(listEl, 3);

  try {
    const torneos = await API.getTorneosDeAmigos({ mias: 'true' });
    if (!torneos.length) {
      listEl.innerHTML = emptyState(t('empty.noTorneos'));
      return;
    }
    listEl.innerHTML = torneos.map(t => renderTorneoCard(t, false)).join('');
    listEl.querySelectorAll('[data-torneo-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const torneo = torneos.find(t => t.id === btn.dataset.torneoId);
        API.setSelectedTorneo(torneo);
        window.location.href = 'clasificacion.html';
      });
    });
  } catch (err) {
    listEl.innerHTML = errorState(err.message);
    if (feedbackEl) {
      feedbackEl.textContent = err.message;
      feedbackEl.classList.remove('hidden');
    }
  }
}

/* --------------------------------------------------------
   TORNEO EDIT / CREATE
   -------------------------------------------------------- */
async function initTorneoEdit() {
  const params = new URLSearchParams(window.location.search);
  const torneoId = params.get('id');
  const competenciaId = params.get('competenciaId');
  const isEdit = !!torneoId;

  // Auth already guaranteed by authBlockingPages, but guard just in case
  if (!API.getToken()) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `auth.html?next=${next}`;
    return;
  }

  const titleEl    = document.getElementById('torneo-edit-title');
  const subtitleEl = document.getElementById('torneo-edit-subtitle');
  const nameInput  = document.getElementById('torneo-nombre');
  const saveBtn    = document.getElementById('torneo-edit-save');
  const deleteBtn  = document.getElementById('torneo-edit-delete');
  const backBtn    = document.getElementById('torneo-edit-back');
  const feedbackEl = document.getElementById('torneo-edit-feedback');

  let torneo = null;

  if (isEdit) {
    try {
      torneo = await API.getTorneoDeAmigos(torneoId);
    } catch {
      window.location.href = 'torneos.html';
      return;
    }
    const user = API.getCurrentUser();
    if (torneo.creadorId !== user?.id) {
      window.location.href = 'clasificacion.html';
      return;
    }
    if (titleEl)    titleEl.textContent = t('action.editTournament');
    if (subtitleEl) subtitleEl.textContent = torneo.competencia?.nombre || t('section.friendTournamentCap');
    if (nameInput)  nameInput.value = torneo.nombre;
    if (deleteBtn)  deleteBtn.classList.remove('hidden');
    if (backBtn)    backBtn.href = 'clasificacion.html';
    API.setSelectedTorneo(torneo);
  } else {
    if (!competenciaId) {
      window.location.href = '../index.html#torneos';
      return;
    }
    const stored = API.getSelectedCompetencia();
    if (titleEl)    titleEl.textContent = t('action.createTournament');
    if (subtitleEl) subtitleEl.textContent = stored?.nombre || '';
    if (deleteBtn)  deleteBtn.classList.add('hidden');
    if (backBtn)    backBtn.href = '../index.html#torneos';
  }

  document.getElementById('torneo-edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = nameInput?.value.trim();
    if (!nombre) return;
    saveBtn.disabled = true;
    saveBtn.textContent = isEdit ? t('action.saving') : t('action.creating');
    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.classList.add('hidden'); }

    try {
      if (isEdit) {
        const updated = await API.updateTorneoDeAmigos(torneoId, { nombre });
        API.setSelectedTorneo(updated);
      } else {
        const nuevo = await API.createTorneoDeAmigos({ nombre, competenciaId });
        API.setSelectedTorneo(nuevo);
      }
      window.location.href = 'clasificacion.html';
    } catch (err) {
      if (feedbackEl) {
        feedbackEl.textContent = err.message;
        feedbackEl.classList.remove('hidden', 'error');
        feedbackEl.classList.add('error');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? t('action.save') : t('action.createTournament');
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    if (!await appConfirm(t('confirm.deleteTorneo', { name: torneo?.nombre }), { confirmText: t('action.delete'), cancelText: t('action.cancel'), danger: true })) return;
    deleteBtn.disabled = true;
    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.classList.add('hidden'); }
    try {
      await API.deleteTorneoDeAmigos(torneoId);
      API.setSelectedTorneo(null);
      window.location.href = '../index.html#torneos';
    } catch (err) {
      if (feedbackEl) {
        feedbackEl.textContent = err.message;
        feedbackEl.classList.remove('hidden', 'error');
        feedbackEl.classList.add('error');
      }
      deleteBtn.disabled = false;
    }
  });
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
  return escapeHtml(String(value || '?').trim()[0]?.toUpperCase() || '?');
}

/** Renders a profile picture img with a letter fallback on broken URL. */
function fotoImg(src, name, styleStr = 'width:100%;height:100%;object-fit:cover;border-radius:50%;') {
  if (!src) return `<span>${initial(name)}</span>`;
  const ini = initial(name);
  return `<img src="${escapeHtml(src)}" alt="" data-ini="${ini}" style="${styleStr}" onerror="this.onerror=null;var s=document.createElement('span');s.textContent=this.dataset.ini||'?';this.parentNode.replaceChild(s,this)">`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* --------------------------------------------------------
   PERFIL
   -------------------------------------------------------- */
async function initPerfil() {
  // Ensure we have a valid access token before calling getUsuario —
  // without it the server returns usuarioPublico (no email).
  if (!API.getToken()) {
    try { await API.restoreSession(); } catch { /* ignore */ }
  }

  const user = API.getCurrentUser();
  if (!user) {
    window.location.replace('auth.html');
    return;
  }

  function showMsg(text, type) {
    const el = document.getElementById('perfil-msg');
    if (!el) return;
    el.textContent = text;
    el.className = type;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => { el.style.display = 'none'; el.className = ''; }, 4000);
  }

  function setPerfilHead(u) {
    const avatarEl = document.getElementById('perfil-avatar');
    const nameEl = document.getElementById('perfil-display-name');
    const usernameEl = document.getElementById('perfil-display-username');
    avatarEl.innerHTML = fotoImg(u.fotoPerfil, u.nombre || u.username);
    if (nameEl) nameEl.textContent = u.nombre || u.username;
    if (usernameEl) usernameEl.textContent = '@' + u.username;
  }

  let profile;
  try {
    profile = await API.getUsuario(user.id);
  } catch {
    showMsg(t('profile.loadError'), 'error');
    return;
  }

  setPerfilHead(profile);
  const fieldUsername = document.getElementById('field-username');
  const fieldNombre   = document.getElementById('field-nombre');
  const fieldApellido = document.getElementById('field-apellido');
  const fieldEmail    = document.getElementById('field-email');
  if (fieldUsername) fieldUsername.value = profile.username || '';
  if (fieldNombre)   fieldNombre.value   = profile.nombre || '';
  if (fieldApellido) fieldApellido.value = profile.apellido || '';
  if (fieldEmail)    fieldEmail.value    = profile.email || '';

  // Avatar photo picker
  const photoInput  = document.getElementById('perfil-photo-input');
  const changePhotoBtn = document.getElementById('perfil-change-photo');
  changePhotoBtn?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    // Some Android browsers leave MIME type empty for camera captures — only reject
    // if the type is explicitly set to something non-image.
    if (file.type && !file.type.startsWith('image/')) { showMsg(t('feedback.photoNotImage'), 'error'); return; }
    changePhotoBtn.disabled = true;
    changePhotoBtn.textContent = t('action.processing');
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      const updated = await API.updateUsuario(user.id, { fotoPerfil: dataUrl });
      setPerfilHead(updated);
      showMsg(t('feedback.photoUpdated'), 'success');
    } catch (err) {
      showMsg(err.message || 'Error al actualizar la foto.', 'error');
    } finally {
      changePhotoBtn.disabled = false;
      changePhotoBtn.textContent = t('action.changePhoto');
      photoInput.value = '';
    }
  });

  // Save form
  document.getElementById('perfil-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('perfil-save-btn');
    btn.disabled = true;
    btn.textContent = t('action.savingChanges');
    try {
      const updated = await API.updateUsuario(user.id, {
        nombre:   fieldNombre?.value.trim()   || undefined,
        apellido: fieldApellido?.value.trim() || undefined,
      });
      setPerfilHead(updated);
      showMsg(t('feedback.changesSaved'), 'success');
    } catch (err) {
      showMsg(err.message || 'Error al guardar.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('action.saveChanges');
    }
  });

  // Logout
  document.getElementById('perfil-logout-btn')?.addEventListener('click', () => {
    API.logout();
    window.location.replace('auth.html');
  });

  // Delete account
  document.getElementById('perfil-delete-btn')?.addEventListener('click', async () => {
    const confirmed = await appConfirm(
      t('confirm.deleteAccount'),
      { confirmText: t('action.deleteAccount2'), cancelText: t('action.cancel'), danger: true }
    );
    if (!confirmed) return;
    const btn = document.getElementById('perfil-delete-btn');
    btn.disabled = true;
    btn.textContent = t('action.deleting');
    try {
      await API.deleteUsuario(user.id);
      API.logout();
      window.location.replace('auth.html');
    } catch (err) {
      showMsg(err.message || 'Error al eliminar la cuenta.', 'error');
      btn.disabled = false;
      btn.textContent = t('action.deleteAccount');
    }
  });
}

function resizeImageToDataUrl(file, maxSize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      if (dataUrl.length > 200_000) {
        reject(new Error(t('feedback.photoTooLarge')));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('feedback.photoReadError'))); };
    img.src = url;
  });
}
