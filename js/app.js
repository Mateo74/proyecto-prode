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
    // Skip on auth page so the user can change language freely before logging in.
    if (user?.idioma && page !== 'auth') {
      const stored = localStorage.getItem('once_metros_lang');
      if (stored !== user.idioma) {
        localStorage.setItem('once_metros_lang', user.idioma);
        window.location.reload();
      }
    }
    return user;
  });

  // Pages that must know auth state before rendering anything
  const authBlockingPages = ['home', 'auth', 'invitacion', 'torneo-edit', 'partido-detalle', 'grupos', 'torneos'];

  if (authBlockingPages.includes(page)) {
    await sessionPromise;
  }

  updateAuthNav();
  initAccountMenu();

  // Redirect unauthenticated users from home to login
  if (!API.getToken() && page === 'home') {
    window.location.href = authRelativePath('auth');
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
    case 'grupos':         initGrupos();        break;
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

// Últimos partidos traídos por loadPartidos(); el overlay los reutiliza junto
// con el estado vivo de Predictions, evitando leer datos del DOM o repetir fetch.
let lastLoadedMatches = [];

// Estado de la pestaña "Grupos": todos los partidos de la competencia (todos los
// estados) y el índice del grupo visible en el carrusel.
let predictionsViewMatches = [];
let currentGroupIndex = 0;
let predictionsViewWired = false;
let groupsPollingId = null;

function detectPage() {
  const p = window.location.pathname;
  if (p.includes('partido-detalle'))  return 'partido-detalle';
  if (p.includes('invitaciones'))     return 'invitaciones';
  if (p.includes('invitacion'))        return 'invitacion';
  if (p.includes('invitar'))           return 'invitar';
  if (p.includes('torneo-edit'))       return 'torneo-edit';
  if (p.includes('partidos'))          return 'partidos';
  if (p.includes('predicciones'))      return 'predicciones';
  if (p.includes('clasificacion'))     return 'clasificacion';
  if (p.includes('torneos'))           return 'torneos';
  if (p.includes('grupos'))            return 'grupos';
  if (p.includes('auth'))              return 'auth';
  if (p.includes('perfil'))            return 'perfil';
  return 'home';
}

function updateAuthNav() {
  const user = API.getCurrentUser();
  document.querySelectorAll('[data-auth-link]').forEach(link => {
    link.textContent = user ? user.nombre || user.username : t('nav.signIn');
    link.href = link.dataset.authHref || 'auth';
  });

  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.classList.toggle('hidden', !user);
    btn.addEventListener('click', () => {
      API.logout();
      window.location.href = authRelativePath('auth');
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
    infoBtnEl.href = pagePath('puntos');
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
        <a class="native-side-drawer__profile" href="${pagePath('perfil')}">
          <div class="native-side-drawer__avatar">${avatarHtml}</div>
          <div>
            <div class="native-side-drawer__name">${escapeHtml(user.nombre || user.username)}</div>
            <div class="native-side-drawer__status">${t('nav.activeSession')}</div>
          </div>
        </a>` : '';

      const footerHtml = user
        ? `<button class="native-side-drawer__logout" id="native-drawer-logout">${t('nav.signOut')}</button>`
        : `<a class="btn btn-primary" style="width:100%;justify-content:center;" href="${authRelativePath('auth')}">${t('nav.signIn')}</a>`;

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
          <a href="${pagePath('torneos')}">${t('nav.friendTournaments')}</a>
          ${user ? `<a href="${pagePath('perfil')}">${t('nav.myAccount')}</a>` : ''}
          <a href="${pagePath('ajustes')}">${t('nav.settings')}</a>
          <a href="${pagePath('puntos')}">${t('nav.howPoints')}</a>
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
        window.location.href = authRelativePath('auth');
      });

      return;
    }

    if (!user) {
      // Guest: show a plain text link instead of the avatar circle
      menu.innerHTML = `
        <a class="account-menu__button--guest" href="${authRelativePath('auth')}">${t('nav.signIn')}</a>
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
        <a href="${authRelativePath('perfil')}">${t('nav.myAccount')}</a>
        <a href="${authRelativePath('ajustes')}">${t('nav.settings')}</a>
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
      window.location.href = authRelativePath('auth');
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
  return `/${hash}`;
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
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '';
    const inviteToken = new URLSearchParams(next).get('token');
    try {
      await API.login({
        identificador: form.get('identificador'),
        password: form.get('password'),
        inviteToken: inviteToken || undefined,
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
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || '';
    const inviteToken = new URLSearchParams(next).get('token');
    try {
      await API.register({
        username: form.get('username'),
        nombre:   form.get('nombre'),
        apellido: form.get('apellido'),
        email:    form.get('email'),
        password: form.get('password'),
        inviteToken: inviteToken || undefined,
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
  window.location.href = next || '/';
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

  setupPredictionsView();
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

    // PROTOTYPE: hide the notification-test competencia from everyone except whitelisted accounts
    const NOTIF_TEST_COMP_ID = 'cmq77rlak0000uw5q54z76uju';
    const NOTIF_TEST_WHITELIST = ['mateomarenco74@gmail.com', 'pruebita'];
    const me = API.getCurrentUser();
    const canSeeNotifTest = me && (NOTIF_TEST_WHITELIST.includes(me.email) || NOTIF_TEST_WHITELIST.includes(me.username));
    const visibleCompetencias = competencias.filter(c => c.id !== NOTIF_TEST_COMP_ID || canSeeNotifTest);

    const selected = API.getSelectedCompetencia();
    const active = visibleCompetencias.find(c => c.id === selected?.id);
    listEl.innerHTML = visibleCompetencias.map(c => renderCompetenciaCard(c, c.id === active?.id)).join('');
    listEl.querySelectorAll('[data-competencia-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const competencia = visibleCompetencias.find(c => c.id === btn.dataset.competenciaId);
        selectCompetencia(competencia);
      });
    });

    if (active && !new URLSearchParams(window.location.search).has('reset') && window.location.hash) {
      selectCompetencia(active, window.location.hash.replace('#', ''));
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
  stopGroupsPolling();
  document.getElementById('competition-picker')?.classList.remove('hidden');
  document.getElementById('competencia-workspace')?.classList.add('hidden');
  history.replaceState(null, '', '/');
}

async function selectCompetencia(competencia, preferredTab = '') {
  if (!competencia) return;
  API.setSelectedCompetencia(competencia);
  document.getElementById('competition-picker')?.classList.add('hidden');
  document.getElementById('competencia-workspace')?.classList.remove('hidden');
  setText('competencia-title', competenciaNombre(competencia));

  // The "Grupos" view only applies to the World Cup; hide its tab otherwise.
  const isMundial = competencia.slug === WORLD_CUP_2026_SLUG;
  document.querySelector('[data-home-tab="grupos"]')?.classList.toggle('hidden', !isMundial);

  let tab = HOME_TABS.includes(preferredTab) ? preferredTab : 'partidos';
  if (tab === 'grupos' && !isMundial) tab = 'partidos';
  switchHomeTab(tab);

  await loadPartidos();
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
    if (show) createBtn.href = `pages/torneo-edit?competenciaId=${encodeURIComponent(competencia.id)}`;
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
        window.location.href = pagePath('clasificacion');
      });
    });
  } catch (error) {
    listEl.innerHTML = errorState(error.message);
  }
}

const HOME_TABS = ['grupos', 'partidos', 'torneos'];

function switchHomeTab(tab) {
  const next = HOME_TABS.includes(tab) ? tab : 'partidos';
  document.querySelectorAll('[data-home-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.homeTab === next);
  });
  document.getElementById('home-tab-grupos')?.classList.toggle('hidden', next !== 'grupos');
  document.getElementById('home-tab-partidos')?.classList.toggle('hidden', next !== 'partidos');
  document.getElementById('home-tab-torneos')?.classList.toggle('hidden', next !== 'torneos');
  if (!document.getElementById('competencia-workspace')?.classList.contains('hidden')) {
    history.replaceState(null, '', `/#${next}`);
  }

  // Matches polling only while the match list is visible. Returning to the
  // Matches tab also re-syncs its cards from the shared in-memory prediction
  // state, so an edit made in the Grupos tab is reflected here too.
  if (next === 'partidos') {
    syncMatchesListFromState();
    startMatchesPolling();
  } else {
    stopMatchesPolling();
  }

  // Render + live-poll the group standings only while the Grupos tab is visible.
  if (next === 'grupos') {
    loadPredictionsView();
    startGroupsPolling();
  } else {
    stopGroupsPolling();
  }
}

function renderTorneoCard(torneo, active) {
  const n = torneo.miembrosCount ?? 0;
  const miembros = torneo.esGlobal
    ? (n === 1 ? `👤 ${t('members.one')}` : `👥 ${t('members.many', { n })}`)
    : (n === 1 ? `👤 ${t('members.one')}` : `👥 ${t('members.many', { n })}`);
  const bgStyle = torneo.imagen
    ? ` style="background-image:linear-gradient(to right,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.48) 100%),url(${CSS.escape(torneo.imagen)})"`
    : '';
  const hasBg = torneo.imagen ? ' has-bg' : '';
  return `
    <button class="tournament-card ${active ? 'active' : ''}${hasBg}" data-torneo-id="${torneo.id}"${bgStyle}>
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

  setupGroupsOverlay();
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

  // Don't re-render while the user is actively filling in a prediction.
  if (quiet && el.querySelector('.score-box:focus')) return;
  if (quiet && isGroupsTabActive()) return;

  const competencia = API.getSelectedCompetencia();
  if (!competencia) {
    el.innerHTML = emptyState(t('empty.chooseCompetition'));
    return;
  }

  const active = document.querySelector('.filter-chip[data-group="estado"].active');
  const estado = active?.dataset.value || '';

  if (!quiet) showSkeleton(el, 4);

  try {
    const fetchEstado = estado === 'proximo' ? 'proximo' : estado;
    let matches = await API.getMatches({ competenciaId: competencia.id, estado: fetchEstado });
    // Always include live games alongside upcoming ones
    if (estado === 'proximo' || estado === '') {
      try {
        const live = await API.getMatches({ competenciaId: competencia.id, estado: 'en-vivo' });
        const existingIds = new Set(matches.map(m => m.id));
        live.forEach(m => { if (!existingIds.has(m.id)) matches.push(m); });
      } catch { /* ignore */ }
    }
    // Sort: upcoming+live chronologically asc; finished most-recent-first
    if (estado === 'finalizado') {
      matches.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } else {
      matches.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }
    lastLoadedMatches = matches;
    el.innerHTML = '';
    if (!matches.length) {
      el.innerHTML = emptyState(t('empty.noMatches'));
      return;
    }
    matches.forEach(m => {
      const card = Predictions.createMatchCard(m);
      attachMatchCardNavigation(card, m);
      el.appendChild(card);
    });
  } catch (error) {
    el.innerHTML = errorState(error.message);
  }
}

/**
 * Vuelca las predicciones en memoria (Predictions) sobre los inputs ya
 * renderizados de #matches-list. La lista de partidos no se vuelve a renderizar
 * al cambiar de pestaña, así que una edición hecha en la pestaña "Grupos"
 * (que comparte el mismo estado) no se vería al volver a "Partidos" sin esto.
 * Solo toca el DOM; el estado de Predictions ya es la fuente de verdad.
 */
function syncMatchesListFromState() {
  const el = document.getElementById('matches-list');
  if (!el) return;
  el.querySelectorAll('.match-card').forEach(card => {
    const live = Predictions.getCurrentScores(card.dataset.matchId);
    if (!live) return;
    card.querySelectorAll('.score-box').forEach(input => {
      const value = live[input.dataset.side];
      input.value = value == null ? '' : value;
      input.classList.toggle('has-value', value != null);
    });
    card.classList.toggle('pred-saved', live.equipo1 != null && live.equipo2 != null);
  });
}

function attachMatchCardNavigation(card, match) {
  card.addEventListener('click', e => {
    if (e.target.tagName === 'INPUT') return;
    const torneo = API.getSelectedTorneo();
    const dest = pagePath('partido-detalle');
    const params = new URLSearchParams({ partidoId: match.id });
    if (torneo) params.set('torneoId', torneo.id);
    else if (match.competenciaId) params.set('competenciaId', match.competenciaId);
    window.location.href = `${dest}?${params}`;
  });
}

/* --------------------------------------------------------
   PARTIDOS · PESTAÑA "PREDICCIONES" (tabla por grupo + carrusel)
   -------------------------------------------------------- */

/** Letras de grupo oficiales en orden (A…L). */
function groupLetters() {
  return typeof WORLD_CUP_2026_GROUPS !== 'undefined'
    ? Object.keys(WORLD_CUP_2026_GROUPS).sort()
    : [];
}

function currentGroupLetter() {
  const letters = groupLetters();
  return letters[currentGroupIndex] || letters[0] || null;
}

/** True cuando la pestaña "Grupos" del workspace está visible. */
function isGroupsTabActive() {
  const pane = document.getElementById('home-tab-grupos');
  return !!pane && !pane.classList.contains('hidden') && pane.offsetParent !== null;
}

/**
 * Cablea (una vez por carga) el carrusel de grupos y el listener que refresca la
 * tabla de posiciones en vivo cuando se edita una predicción del grupo visible.
 */
function setupPredictionsView() {
  if (predictionsViewWired) return;
  const prev = document.querySelector('.group-carousel__prev');
  const next = document.querySelector('.group-carousel__next');
  if (!prev && !next && !document.getElementById('group-standings')) return;
  predictionsViewWired = true;

  prev?.addEventListener('click', () => stepGroup(-1));
  next?.addEventListener('click', () => stepGroup(1));

  // Editar una predicción solo cambia la columna de puntos predichos (el orden
  // y los stats reales no dependen de la predicción), así que refrescamos la
  // tabla sin animación.
  document.addEventListener('prediction:change', event => {
    if (!isGroupsTabActive()) return;
    const matchId = event.detail?.matchId;
    const match = predictionsViewMatches.find(m => m.id === matchId);
    if (!match || groupLetterForMatch(match) !== currentGroupLetter()) return;
    renderGroupStandings(currentGroupLetter());
  });
}

/** Avanza el carrusel con wrap (tras la última letra vuelve a la primera). */
function stepGroup(delta) {
  const letters = groupLetters();
  if (!letters.length) return;
  currentGroupIndex = (currentGroupIndex + delta + letters.length) % letters.length;
  renderCurrentGroup({ animateSwitch: true });
}

async function loadPredictionsView() {
  const standings = document.getElementById('group-standings');
  const matchesEl = document.getElementById('group-matches');
  if (!standings || !matchesEl) return;

  const competencia = API.getSelectedCompetencia();
  if (!competencia) {
    standings.innerHTML = emptyState(t('empty.chooseCompetition'));
    matchesEl.innerHTML = '';
    return;
  }
  showSkeleton(standings, 1);
  matchesEl.innerHTML = '';

  try {
    predictionsViewMatches = await fetchGroupsMatches(competencia.id);
    renderCurrentGroup();
  } catch (error) {
    standings.innerHTML = errorState(error.message);
  }
}

/**
 * Trae todos los partidos de la competencia (todos los estados) y los deduplica.
 * Los partidos en vivo van primero para que el marcador real más fresco gane.
 */
async function fetchGroupsMatches(competenciaId) {
  const [upcoming, live, finished] = await Promise.all([
    API.getMatches({ competenciaId, estado: 'proximo' }).catch(() => []),
    API.getMatches({ competenciaId, estado: 'en-vivo' }).catch(() => []),
    API.getMatches({ competenciaId, estado: 'finalizado' }).catch(() => []),
  ]);
  const seen = new Set();
  return [...live, ...finished, ...upcoming].filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function startGroupsPolling() {
  stopGroupsPolling();
  groupsPollingId = setInterval(refreshGroupsLive, 30000);
}

function stopGroupsPolling() {
  if (!groupsPollingId) return;
  clearInterval(groupsPollingId);
  groupsPollingId = null;
}

/** Refresca los resultados en vivo sin interrumpir una edición. */
async function refreshGroupsLive() {
  if (!isGroupsTabActive()) return;
  if (document.querySelector('#home-tab-grupos input:focus')) return;
  const competencia = API.getSelectedCompetencia();
  if (!competencia) return;
  try {
    predictionsViewMatches = await fetchGroupsMatches(competencia.id);
    renderCurrentGroup();
  } catch { /* conserva el snapshot anterior */ }
}

/**
 * Enriquece los partidos con la predicción en memoria del usuario (Predictions).
 * Así las ediciones persisten al moverse por el carrusel y al refrescar en vivo:
 * aunque las tarjetas se recreen, la predicción escrita se relee del estado.
 * No toca el marcador real del partido (scoreEquipo1/2), solo userPred.
 */
function enrichWithUserPredictions(matches) {
  return matches.map(match => {
    const live = Predictions.getCurrentScores(match.id);
    if (!live) return match;
    return {
      ...match,
      userPred: { ...(match.userPred || {}), scoreEquipo1: live.equipo1, scoreEquipo2: live.equipo2 },
    };
  });
}

function renderCurrentGroup({ animateSwitch = false } = {}) {
  const letter = currentGroupLetter();
  const label = document.getElementById('group-carousel-label');
  if (label && letter) label.textContent = t('groups.title', { letter });
  renderGroupStandings(letter);
  renderGroupMatches(letter, { animateSwitch });
}

/** Pinta la tabla de posiciones reales del grupo. El carrusel actúa de
 *  encabezado, así que la tabla se renderiza sin su fila de título. Ordena por
 *  resultados reales (finalizados + en vivo); los puntos predichos van aparte. */
function renderGroupStandings(letter) {
  const el = document.getElementById('group-standings');
  if (!el || !letter) return;
  const enriched = enrichWithUserPredictions(predictionsViewMatches);
  const groups = buildGroupStandings(enriched, WORLD_CUP_2026_GROUPS);
  el.innerHTML = renderGroupStandingsTable(letter, groups[letter] || []);
}

/** Pinta las tarjetas de partido del grupo (debajo de la tabla). */
function renderGroupMatches(letter, { animateSwitch = false } = {}) {
  const el = document.getElementById('group-matches');
  if (!el || !letter) return;
  const enriched = enrichWithUserPredictions(predictionsViewMatches);
  const byGroup = splitMatchesByGroup(enriched, WORLD_CUP_2026_GROUPS);
  const matches = byGroup[letter] || [];

  el.innerHTML = '';
  el.classList.toggle('predictions-split__matches--switch', animateSwitch);
  if (animateSwitch) void el.offsetWidth;

  if (!matches.length) {
    el.innerHTML = emptyState(t('empty.noMatches'));
    return;
  }
  matches
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .forEach(m => {
      const card = Predictions.createMatchCard(m);
      attachMatchCardNavigation(card, m);
      el.appendChild(card);
    });
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
  let ligaDisplay = I18n.getLang() === 'en' && pred.ligaEn ? pred.ligaEn : (pred.liga || '');
  if (I18n.getLang() === 'en' && ligaDisplay === 'Copa Mundial FIFA') ligaDisplay = 'FIFA World Cup';
  const group = typeof groupLetterForMatch === 'function' ? groupLetterForMatch(pred) : null;
  const metaNote = [ligaDisplay, group ? t('groups.title', { letter: group }) : null, t('pred.myPred', { score })]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  const rowCls = pred.estado === 'acierto' ? 'is-hit' : pred.estado === 'fallo' ? 'is-miss' : '';
  const equipo1Display = typeof localizeTeamName === 'function'
    ? localizeTeamName(pred.equipo1Id, pred.equipo1)
    : (I18n.getLang() === 'en' && pred.equipo1NombreEn ? pred.equipo1NombreEn : pred.equipo1);
  const equipo2Display = typeof localizeTeamName === 'function'
    ? localizeTeamName(pred.equipo2Id, pred.equipo2)
    : (I18n.getLang() === 'en' && pred.equipo2NombreEn ? pred.equipo2NombreEn : pred.equipo2);
  return `
    <div class="pred-row ${rowCls}">
      <div class="pred-match">
        <div class="pred-match-name">${escapeHtml(equipo1Display)} vs ${escapeHtml(equipo2Display)}</div>
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
  // Show groups overlay FAB only on the predictions tab (Mundial only)
  if (tab === 'predicciones') {
    setupGroupsOverlay();
  } else {
    document.getElementById('grupos-fab')?.remove();
    document.getElementById('grupos-overlay')?.remove();
  }
}

async function loadMisPrediccionesEnTorneo(estado = '') {
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

  // Build filter chips if not yet present
  const tab = document.getElementById('clasif-tab-predicciones');
  if (tab && !tab.querySelector('.pred-filters')) {
    const filtersDiv = document.createElement('div');
    filtersDiv.className = 'pred-filters filter-chips';
    const chips = [
      { value: 'proximo', label: t('filter.upcoming') },
      { value: 'en-vivo', label: t('filter.live') },
      { value: 'finalizado', label: t('filter.finished') },
      { value: '', label: t('filter.all') },
    ];
    chips.forEach(({ value, label }) => {
      const btn = document.createElement('button');
      btn.className = 'filter-chip' + (value === estado ? ' active' : '');
      btn.dataset.estadoPred = value;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        tab.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        loadMisPrediccionesEnTorneo(btn.dataset.estadoPred);
      });
      filtersDiv.appendChild(btn);
    });
    const section = tab.querySelector('.section');
    section?.insertBefore(filtersDiv, section.firstChild);
  } else if (tab) {
    // Sync active chip with current estado
    tab.querySelectorAll('.filter-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.estadoPred === estado)
    );
  }

  try {
    // For 'proximo' filter, also fetch live matches and merge them in.
    // For 'all' (''), fetch proximo + live. Other filters pass through directly.
    const apiEstado = (estado === '' || estado === 'proximo') ? 'proximo' : estado;
    let matches = await API.getMatches({ competenciaId, estado: apiEstado });
    // Merge in live games for 'proximo' and 'all' filters
    if (estado === '' || estado === 'proximo') {
      try {
        const live = await API.getMatches({ competenciaId, estado: 'en-vivo' });
        const existingIds = new Set(matches.map(m => m.id));
        live.forEach(m => { if (!existingIds.has(m.id)) matches.push(m); });
      } catch { /* ignore */ }
    }
    // Sort: upcoming+live chronologically asc; finished most-recent-first
    if (estado === 'finalizado') {
      matches.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } else {
      matches.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }
    lastLoadedMatches = matches;
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
        window.location.href = `${dest}?torneoId=${encodeURIComponent(torneo.id)}&partidoId=${encodeURIComponent(m.id)}&from=clasificacion`;
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
    window.location.href = `torneo-edit?id=${encodeURIComponent(torneo.id)}`;
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
      window.location.href = 'torneos';
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
      window.location.href = '/#torneos';
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
    const next = encodeURIComponent(`invitar?torneo=${torneoId}`);
    window.location.href = `auth?next=${next}`;
    return;
  }

  if (!torneoId) {
    window.location.href = 'torneos';
    return;
  }

  let torneo;
  try {
    torneo = await API.getTorneoDeAmigos(torneoId);
  } catch {
    window.location.href = 'torneos';
    return;
  }

  const user = API.getCurrentUser();
  if (torneo.creadorId !== user?.id) {
    window.location.href = 'clasificacion';
    return;
  }

  const titleEl = document.getElementById('invite-torneo-title');
  const labelEl = document.getElementById('invite-torneo-label');
  if (titleEl) titleEl.textContent = torneoNombre(torneo);
  if (labelEl) labelEl.innerHTML = `<span class="dot"></span>${escapeHtml(competenciaNombre(torneo.competencia) || 'Torneo de amigos')}`;

  const backBtn = document.getElementById('invite-back-btn');
  if (backBtn) backBtn.href = 'clasificacion';

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
    const next = encodeURIComponent('invitaciones');
    window.location.href = `auth?next=${next}`;
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

  document.getElementById('back-btn')?.addEventListener('click', () => {
    // Only go to clasificacion when we explicitly arrived from there.
    // Otherwise just use history.back() to preserve the correct back flow.
    const from = params.get('from');
    if (torneoId && (from === 'clasificacion' || from === 'invite')) {
      // In invite flow, ensure at least the torneo id is selected before navigating.
      if (from === 'invite' && !API.getSelectedTorneo()) {
        API.setSelectedTorneo({ id: torneoId });
      }
      window.location.href = pagePath('clasificacion');
    } else {
      history.back();
    }
  });

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

  const lang = (typeof I18n !== 'undefined') ? I18n.getLang() : 'es';
  const resolveTeamName = (teamNumber) => {
    if (!partido) return '';
    const id = teamNumber === 1 ? partido.equipo1Id : partido.equipo2Id;
    const base = teamNumber === 1 ? partido.equipo1 : partido.equipo2;
    const en = teamNumber === 1 ? partido.equipo1NombreEn : partido.equipo2NombreEn;
    if (typeof localizeTeamName === 'function') return localizeTeamName(id, base || '');
    return (lang === 'en' && en) ? en : (base || '');
  };
  const team1 = resolveTeamName(1);
  const team2 = resolveTeamName(2);

  // Update page title with match teams
  if (partido) {
    if (team1 && team2) {
      const title = `${team1} ${t('match.vs')} ${team2}`;
      document.title = `${title} | Once Metros`;
      const pageTitleEl = document.getElementById('match-page-title');
      if (pageTitleEl) pageTitleEl.textContent = title;
    } else if (torneoData) {
      document.title = `${torneoNombre(torneoData)} | Once Metros`;
    }
  } else if (torneoData) {
    document.title = `${torneoNombre(torneoData)} | Once Metros`;
  }

  // Match card
  cardContainer && (cardContainer.innerHTML = '');
  if (cardContainer) cardContainer.appendChild(Predictions.createMatchCard(partido));

  // Dev utility: call window.__matchInviteLink() from the browser console to get
  // a shareable invite link for the current match+torneo (not exposed in the UI).
  window.__matchInviteLink = async () => {
    try {
      let { token } = await API.getInviteLink(torneoId);
      if (!token) ({ token } = await API.generarInviteLink(torneoId));
      if (!token) { console.warn('No invite token available'); return; }
      const lang = (typeof I18n !== 'undefined') ? I18n.getLang() : 'es';
      const url = `${window.location.origin}/api/invites/${encodeURIComponent(token)}/og-preview?lang=${encodeURIComponent(lang)}&partidoId=${encodeURIComponent(partidoId)}`;
      console.log('%cMatch invite link:', 'font-weight:bold', url);
      await navigator.clipboard.writeText(url).catch(() => {});
      return url;
    } catch (err) {
      console.error('__matchInviteLink failed', err);
    }
  };

  const podiumEl = document.getElementById('match-podium');
  if (!rankingList) return;

  // Predictions are private until the match starts (prediccionEditable === false means locked)
  const locked = partido.prediccionEditable === false ||
                 partido.estado === 'en-vivo' ||
                 partido.estado === 'finalizado';

  // When match is live, calculate provisional points based on current score
  const liveScore = partido.estado === 'en-vivo'
    ? { g1: partido.scoreEquipo1 ?? null, g2: partido.scoreEquipo2 ?? null }
    : null;

  const tabsWrap = document.getElementById('match-detail-tabs');
  const tabRanking = document.getElementById('match-tab-ranking');
  const tabStats = document.getElementById('match-tab-stats');
  const rankingSection = document.getElementById('match-section-ranking');
  const statsSection = document.getElementById('match-section-stats');
  const statsBody = document.getElementById('match-stats-body');

  function switchMatchTab(tabName) {
    if (!rankingSection || !statsSection || !tabRanking || !tabStats) return;
    const showStats = tabName === 'stats';
    rankingSection.classList.toggle('hidden', showStats);
    statsSection.classList.toggle('hidden', !showStats);
    tabRanking.classList.toggle('active', !showStats);
    tabStats.classList.toggle('active', showStats);
  }

  if (tabsWrap && tabRanking && tabStats) {
    tabStats.classList.remove('hidden');
    tabRanking.addEventListener('click', () => switchMatchTab('ranking'));
    tabStats.addEventListener('click', () => switchMatchTab('stats'));
    switchMatchTab('ranking');
  }

  function calcProvisionalPoints(pred) {
    if (!pred || liveScore?.g1 == null || liveScore?.g2 == null) return null;
    const p1 = pred.golesEquipo1, p2 = pred.golesEquipo2;
    if (p1 == null || p2 == null) return null;
    const r1 = liveScore.g1, r2 = liveScore.g2;
    const predResult = Math.sign(p1 - p2);
    const realResult = Math.sign(r1 - r2);
    if (predResult !== realResult) return 0;
    if (p1 === r1 && p2 === r2) return Math.max(3, p1 + p2);
    if (p1 - p2 === r1 - r2) return 2;
    return 1;
  }

  // Build ranking array. Before kick-off: alphabetical, no pts shown. After: sorted by pts.
  const ranked = entries
    .map(e => {
      let puntos = null;
      if (locked) {
        puntos = partido.estado === 'en-vivo'
          ? calcProvisionalPoints(e.prediccion)
          : (e.prediccion?.puntos ?? null);
      }
      return {
        usuarioId:  e.usuario.id,
        nombre:     e.usuario.nombre || e.usuario.username,
        fotoPerfil: e.usuario.fotoPerfil || null,
        puntos,
        aciertos:   0,
        exactos:    0,
        predScore:  e.prediccion ? `${e.prediccion.golesEquipo1}-${e.prediccion.golesEquipo2}` : null,
        hasPred:    !!e.prediccion,
      };
    })
    .sort((a, b) => {
      if (!locked) return (a.nombre || '').localeCompare(b.nombre || '');
      if (a.puntos === null && b.puntos === null) return 0;
      if (a.puntos === null) return 1;
      if (b.puntos === null) return -1;
      return b.puntos - a.puntos;
    });

  function formatAvg(value) {
    if (!Number.isFinite(value)) return '-';
    return (Math.round(value * 10) / 10).toFixed(1);
  }

  function renderMatchStats() {
    if (!statsBody) return;

    if (!locked) {
      statsBody.innerHTML = emptyState(t('match.stats.availableWhenLocked'));
      return;
    }

    const predictionEntries = entries
      .filter(e => e.prediccion && Number.isFinite(e.prediccion.golesEquipo1) && Number.isFinite(e.prediccion.golesEquipo2))
      .map(e => ({ pred: e.prediccion, usuario: e.usuario || {} }));

    if (!predictionEntries.length) {
      statsBody.innerHTML = emptyState(t('match.stats.noPredictions'));
      return;
    }

    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let totalG1 = 0;
    let totalG2 = 0;
    const scoreCounts = new Map();

    for (const item of predictionEntries) {
      const p = item.pred;
      const g1 = p.golesEquipo1;
      const g2 = p.golesEquipo2;
      totalG1 += g1;
      totalG2 += g2;
      if (g1 > g2) homeWins += 1;
      else if (g1 < g2) awayWins += 1;
      else draws += 1;

      const scoreKey = `${g1}-${g2}`;
      scoreCounts.set(scoreKey, (scoreCounts.get(scoreKey) || 0) + 1);
    }

    const total = predictionEntries.length;
    const pct = (n) => Math.round((n / total) * 100);
    const homePct = pct(homeWins);
    const drawPct = pct(draws);
    const awayPct = Math.max(0, 100 - homePct - drawPct);

    const commonScores = [...scoreCounts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        const [a1, a2] = a[0].split('-').map(Number);
        const [b1, b2] = b[0].split('-').map(Number);
        if (a1 !== b1) return a1 - b1;
        return a2 - b2;
      });

    const barItems = commonScores.slice(0, 6).map(([score, count]) => ({
      score,
      count,
      isOther: false,
    }));
    const otherCount = commonScores.slice(6).reduce((acc, item) => acc + item[1], 0);
    if (otherCount > 0) {
      barItems.push({ score: t('match.stats.other'), count: otherCount, isOther: true });
    }
    const maxBarCount = Math.max(...barItems.map(item => item.count), 1);
    const usePercentBars = !!torneoData?.esGlobal;
    const maxBarPct = Math.max(...barItems.map(item => (item.count / total) * 100), 0);
    const percentBase = usePercentBars
      ? (maxBarPct > 60 ? 100 : 60)
      : 100;

    function findExtreme(direction) {
      let best = null;
      for (const item of predictionEntries) {
        const p = item.pred;
        const g1 = p.golesEquipo1;
        const g2 = p.golesEquipo2;
        const diff = direction === 'home' ? (g1 - g2) : (g2 - g1);
        const teamGoals = direction === 'home' ? g1 : g2;
        if (diff <= 0) continue;
        if (!best || diff > best.diff || (diff === best.diff && teamGoals > best.teamGoals)) {
          best = { g1, g2, diff, usuario: item.usuario };
          best.teamGoals = teamGoals;
        }
      }
      return best;
    }

    const extremeHome = findExtreme('home');
    const extremeAway = findExtreme('away');
    const homeTeamLabel = team1 || t('match.stats.homeSide');
    const awayTeamLabel = team2 || t('match.stats.awaySide');
    const outcomeLegend = [
      { key: 'home', count: homeWins, pct: homePct, label: t('match.stats.homeWin', { team: homeTeamLabel }), dotClass: 'match-pie-dot--home' },
      { key: 'draw', count: draws, pct: drawPct, label: t('match.stats.draw'), dotClass: 'match-pie-dot--draw' },
      { key: 'away', count: awayWins, pct: awayPct, label: t('match.stats.awayWin', { team: awayTeamLabel }), dotClass: 'match-pie-dot--away' },
    ].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.pct - a.pct;
    });

    const teamBadge = (name, crestUrl) => {
      if (crestUrl) {
        return `<img class="team__badge team__badge-img" src="${escapeHtml(crestUrl)}" alt="" loading="lazy">`;
      }
      return `<div class="team__badge">${initial(name || '?')}</div>`;
    };

    const userDisplayName = (user) => {
      const fullName = [user?.nombre, user?.apellido].filter(Boolean).join(' ').trim();
      return fullName || user?.username || 'Usuario';
    };

    function renderExtremeCard(directionLabel, extremeValue) {
      if (!extremeValue) {
        return `
          <div class="match-extreme-card">
            <div class="match-extreme-head">
              <span class="match-extreme-label">${escapeHtml(directionLabel)}</span>
              <span class="match-extreme-score">${escapeHtml(t('match.stats.none'))}</span>
            </div>
          </div>
        `;
      }

      const u = extremeValue.usuario || {};
      const displayName = userDisplayName(u);
      return `
        <div class="match-extreme-card">
          <div class="match-extreme-head">
            <span class="match-extreme-label">${escapeHtml(directionLabel)}</span>
          </div>
          <div class="match-extreme-user">
            <div class="match-extreme-user-main">
              <div class="match-extreme-avatar">${fotoImg(u.fotoPerfil, displayName)}</div>
              <div class="match-extreme-user-text">
                <strong>${escapeHtml(displayName)}</strong>
                <span>${escapeHtml(t('match.stats.by', { name: u.username ? `@${u.username}` : displayName }))}</span>
              </div>
            </div>
            <span class="match-extreme-score">${escapeHtml(`${extremeValue.g1}-${extremeValue.g2}`)}</span>
          </div>
        </div>
      `;
    }

    statsBody.innerHTML = `
      <div class="match-stats-grid">
        <article class="match-stats-card">
          <h3 class="match-stats-title">${escapeHtml(t('match.stats.avgPredictedScore'))}</h3>
          <div class="match-stats-scorecard">
            <div class="team">
              ${teamBadge(team1, partido.equipo1EscudoUrl)}
              <div class="team__name">${escapeHtml(team1 || '-')}</div>
            </div>
            <div class="match-stats-score">
              <span>${formatAvg(totalG1 / total)}</span>
              <span class="match-stats-vs">:</span>
              <span>${formatAvg(totalG2 / total)}</span>
            </div>
            <div class="team">
              ${teamBadge(team2, partido.equipo2EscudoUrl)}
              <div class="team__name">${escapeHtml(team2 || '-')}</div>
            </div>
          </div>
        </article>

        <article class="match-stats-card">
          <h3 class="match-stats-title">${escapeHtml(t('match.stats.outcomeDistribution'))}</h3>
          <div class="match-pie-wrap">
            <div class="match-pie" style="--home:${homePct};--draw:${drawPct};--away:${awayPct}" aria-hidden="true"></div>
            <div class="match-pie-legend">
              ${outcomeLegend.map(item => `
                <div class="match-pie-row">
                  <span class="match-pie-dot ${item.dotClass}"></span>
                  <span class="match-pie-label">${escapeHtml(item.label)}</span>
                  <span class="match-pie-value">${item.pct}%</span>
                </div>
              `).join('')}
            </div>
          </div>
        </article>

        <article class="match-stats-card match-stats-card--full">
          <h3 class="match-stats-title">${escapeHtml(t('match.stats.commonPredictions'))}</h3>
          <div class="match-bars">
            ${barItems.map(item => `
              <div class="match-bar">
                <span class="match-bar-label">${escapeHtml(item.score)}</span>
                <div class="match-bar-track"><div class="match-bar-fill ${item.isOther ? 'match-bar-fill--other' : ''}" style="--w:${usePercentBars ? Math.min(100, Math.round(((item.count / total) * 100 / percentBase) * 100)) : Math.round((item.count / maxBarCount) * 100)}"></div></div>
                <span class="match-bar-value">${usePercentBars ? `${Math.round((item.count / total) * 100)}%` : item.count}</span>
              </div>
            `).join('')}
          </div>
        </article>

        <article class="match-stats-card match-stats-card--full">
          <h3 class="match-stats-title">${escapeHtml(t('match.stats.extremePredictions'))}</h3>
          <div class="match-extremes">
            ${renderExtremeCard(t('match.stats.homeWin', { team: homeTeamLabel }), extremeHome)}
            ${renderExtremeCard(t('match.stats.awayWin', { team: awayTeamLabel }), extremeAway)}
          </div>
        </article>
      </div>
    `;
  }

  // Notice shown above the list before kick-off or during live
  const noticeEl = document.getElementById('match-ranking-notice');
  if (noticeEl) {
    if (partido.estado === 'en-vivo') {
      noticeEl.textContent = t('match.liveScoresNotice');
      noticeEl.classList.remove('hidden');
    } else {
      noticeEl.classList.toggle('hidden', locked);
    }
  }

  const matchSubLine = r => locked
    ? (r.hasPred ? escapeHtml(r.predScore) : `<span style="color:var(--text-3)">${t('match.noPred')}</span>`)
    : `<span style="color:var(--text-3)">${t('match.predsHidden')}</span>`;

  // Don't show podium on match detail page — just the flat ranked list with pred scores
  if (podiumEl) podiumEl.innerHTML = '';
  const positions = computePositions(ranked);

  const PAGE = 50;
  let shown = PAGE;

  function renderMatchRankPage() {
    const currentUser = API.getCurrentUser();
    rankingList.innerHTML = ranked.length
      ? ranked.slice(0, shown).map((r, i) => {
        const row = renderRankRow(r, positions[i], matchSubLine);
        // Mark current user for highlighting
        if (currentUser?.id === r.usuarioId) {
          return row.replace('class="ranking-row"', 'class="ranking-row ranking-row--current-user"');
        }
        return row;
      }).join('')
      : emptyState(t('empty.noScoresYet'));

    document.getElementById('match-ranking-load-more')?.remove();
    if (shown < ranked.length) {
      const btn = document.createElement('button');
      btn.id = 'match-ranking-load-more';
      btn.className = 'btn btn-outline btn-sm';
      btn.style.cssText = 'display:block;margin:1rem auto';
      btn.textContent = t('action.loadMore');
      btn.addEventListener('click', () => {
        shown = Math.min(shown + PAGE, ranked.length);
        renderMatchRankPage();
      });
      rankingList.insertAdjacentElement('afterend', btn);
    }
  }

  if (!rankingList.dataset.userClickBound) {
    rankingList.addEventListener('click', e => {
      const row = e.target.closest('[data-user-id]');
      if (!row) return;
      const userId = row.dataset.userId;
      const userName = row.dataset.userName;
      if (userId) openUserPredsDrawer(userId, userName, torneoId);
    });
    rankingList.dataset.userClickBound = 'true';
  }

  renderMatchRankPage();
  renderMatchStats();
}

async function initInviteLanding() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const partidoId = params.get('partidoId'); // optional: redirect to match after joining
  const title = document.getElementById('invite-landing-title');
  const meta = document.getElementById('invite-landing-meta');
  const actions = document.getElementById('invite-landing-actions');

  if (!token) {
    title.textContent = t('torneo.invalidInvite');
    meta.textContent = t('torneo.missingToken');
    actions.innerHTML = `<a class="btn btn-primary" href="/">${t('action.goHome')}</a>`;
    return;
  }

  let torneo;
  try {
    torneo = await API.getTorneoPorInviteToken(token);
  } catch (err) {
    title.textContent = t('torneo.invalidInviteRevoked');
    meta.textContent = err.message;
    actions.innerHTML = `<a class="btn btn-primary" href="/">${t('action.goHome')}</a>`;
    return;
  }

  const joinTitle = t('torneo.joinTitle', { name: torneoNombre(torneo) });
  title.textContent = joinTitle;
  document.getElementById('page-title').textContent = `${joinTitle} | Once Metros`;
  meta.textContent = competenciaNombre(torneo.competencia) || '';

  if (!API.getToken()) {
    const nextParams = new URLSearchParams({ token });
    if (partidoId) nextParams.set('partidoId', partidoId);
    const next = encodeURIComponent(`invitacion?${nextParams}`);
    actions.innerHTML = `
      <a class="btn btn-primary" href="auth?next=${next}">${t('action.signInToJoin')}</a>
      <a class="btn btn-outline" href="/">${t('action.seeCompetitions')}</a>
    `;
    return;
  }

  actions.innerHTML = `<button class="btn btn-primary" id="invite-landing-join">${t('action.joinTournament')}</button>`;
  document.getElementById('invite-landing-join')?.addEventListener('click', async () => {
    try {
      const result = await API.unirseConInviteToken(token);
      API.setSelectedTorneo(result);
      if (partidoId) {
        window.location.href = `partido-detalle?torneoId=${encodeURIComponent(result.id)}&partidoId=${encodeURIComponent(partidoId)}&from=invite`;
      } else {
        window.location.href = 'clasificacion';
      }
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
  const pageHeaderEl = document.querySelector('.page-header');
  const selected = API.getSelectedTorneo();
  if (!selected) return;
  try {
    const torneo = await API.getTorneoDeAmigos(selected.id);
    API.setSelectedTorneo(torneo);
    if (title) title.textContent = torneoNombre(torneo);
    if (subtitle) subtitle.textContent = competenciaNombre(torneo.competencia) || t('section.friendTournamentCap');
    if (pageHeaderEl && torneo.imagen) {
      pageHeaderEl.style.backgroundImage = `linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.75) 100%),url(${CSS.escape(torneo.imagen)})`;
      pageHeaderEl.classList.add('has-bg');
    }
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
    const ranking = await API.getLeaderboard({ limit: 9999 });
    const positions = computePositions(ranking);

    if (!ranking.length) {
      if (podiumEl) podiumEl.innerHTML = '';
      rankingEl.innerHTML = emptyState(t('empty.noScoresYet'));
      return;
    }

    const PAGE = 50;
    let shown = PAGE;

    function renderPage() {
      renderRankingInto(podiumEl, rankingEl, ranking.slice(0, shown), positions.slice(0, shown));

      // Remove old load-more button if present
      document.getElementById('ranking-load-more')?.remove();

      if (shown < ranking.length) {
        const btn = document.createElement('button');
        btn.id = 'ranking-load-more';
        btn.className = 'btn btn-outline btn-sm';
        btn.style.cssText = 'display:block;margin:1rem auto';
        btn.textContent = t('action.loadMore');
        btn.addEventListener('click', () => {
          shown = Math.min(shown + PAGE, ranking.length);
          renderPage();
        });
        rankingEl.insertAdjacentElement('afterend', btn);
      }
    }

    renderPage();

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
  const currentUser = API.getCurrentUser();
  
  if (podiumEl) {
    const top    = ranked.slice(0, 3);
    const order  = [top[1], top[0], top[2]];
    const topPos = [positions[1], positions[0], positions[2]];
    const mCls   = ['medal medal-2', 'medal medal-1', 'medal medal-3'];
    const pCls   = ['podium-item--2', 'podium-item--1', 'podium-item--3'];
    podiumEl.innerHTML = order.map((r, i) => r ? `
      <div class="podium-item ${pCls[i]}${currentUser?.id === r.usuarioId ? ' podium-item--current-user' : ''}"${clickable ? ` data-user-id="${escapeHtml(r.usuarioId || '')}" data-user-name="${escapeHtml(r.nombre)}"` : ''}>
        <span class="${mCls[i]}">${topPos[i] ?? i + 1}</span>
        <div class="podium-avatar">${fotoImg(r.fotoPerfil, r.nombre)}</div>
        <div class="podium-name">${escapeHtml(r.nombre)}</div>
        <div class="podium-pts">${r.puntos ?? '—'} ${t('stat.pts')}</div>
        <div class="podium-bar"></div>
      </div>` : '').join('');
  }

  const rest = ranked.slice(3);
  rankingEl.innerHTML = rest.length
    ? rest.map((r, i) => {
      const row = renderRankRow(r, positions[i + 3], subLineFn);
      // Mark current user for highlighting
      if (currentUser?.id === r.usuarioId) {
        return row.replace('class="ranking-row"', 'class="ranking-row ranking-row--current-user"');
      }
      return row;
    }).join('')
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
function openUserPredsDrawer(userId, userName, torneoIdOverride = null) {
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

  const torneoFromSelection = API.getSelectedTorneo();
  const torneoFromUrl = new URLSearchParams(window.location.search).get('torneoId');
  const torneoIdResolved = torneoIdOverride || torneoFromSelection?.id || torneoFromUrl;

  if (!torneoIdResolved) {
    listEl.innerHTML = emptyState(t('empty.tournamentNotFound'));
    return;
  }

  API.getPrediccionesUsuarioEnTorneo(torneoIdResolved, userId)
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

  // On fast back-navigation the initial restore may still be in flight.
  // Try once more before deciding the user is logged out.
  if (!API.getToken()) {
    try { await API.restoreSession(); } catch { /* keep fallback below */ }
  }

  if (!API.getToken()) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">!</div>
        <p>${escapeHtml(t('empty.signInForTorneoPage'))}</p>
        <a href="auth?next=torneos" class="btn btn-primary" style="margin-top:.75rem">${t('nav.signIn')}</a>
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
        window.location.href = 'clasificacion';
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
    window.location.href = `auth?next=${next}`;
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
      window.location.href = 'torneos';
      return;
    }
    const user = API.getCurrentUser();
    if (torneo.creadorId !== user?.id) {
      window.location.href = 'clasificacion';
      return;
    }
    if (titleEl)    titleEl.textContent = t('action.editTournament');
    if (subtitleEl) subtitleEl.textContent = torneo.competencia?.nombre || t('section.friendTournamentCap');
    if (nameInput)  nameInput.value = torneo.nombre;
    if (deleteBtn)  deleteBtn.classList.remove('hidden');
    if (backBtn)    backBtn.href = 'clasificacion';
    API.setSelectedTorneo(torneo);
  } else {
    if (!competenciaId) {
      window.location.href = '/#torneos';
      return;
    }
    const stored = API.getSelectedCompetencia();
    if (titleEl)    titleEl.textContent = t('action.createTournament');
    if (subtitleEl) subtitleEl.textContent = stored?.nombre || '';
    if (deleteBtn)  deleteBtn.classList.add('hidden');
    if (backBtn)    backBtn.href = '/#torneos';
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
      window.location.href = 'clasificacion';
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
      window.location.href = '/#torneos';
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
    window.location.replace('auth');
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
    window.location.replace('auth');
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
      window.location.replace('auth');
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

/* --------------------------------------------------------
   GRUPOS — overlay flotante sobre la página de predicciones
   Reutiliza los partidos ya traídos del backend (lastLoadedMatches)
   y los marcadores en memoria del módulo Predictions (incluyendo
   ediciones del usuario aún sin guardar). No lee el DOM.
   -------------------------------------------------------- */

/**
 * Construye la lista de partidos para el overlay combinando:
 *  - los partidos cacheados del último fetch (equipos, escudos, competencia)
 *  - los marcadores vivos en memoria de Predictions (ediciones sin guardar)
 * Si un partido no tiene marcador vivo, se usa su predicción del backend.
 */
function matchesWithLivePredictions() {
  return (lastLoadedMatches || []).map(match => {
    const live = Predictions.getCurrentScores(match.id);
    let userPred = match.userPred || null;
    if (live) {
      userPred = (live.equipo1 != null && live.equipo2 != null)
        ? { scoreEquipo1: live.equipo1, scoreEquipo2: live.equipo2 }
        : null;
    }
    return { ...match, userPred };
  });
}

/**
 * Monta (una sola vez) el botón flotante y el overlay de grupos en las páginas
 * que muestran #matches-list. Solo aparece para la competencia del Mundial.
 * Idempotente: se puede llamar en cada render de partidos.
 */
function setupGroupsOverlay() {
  if (typeof WORLD_CUP_2026_GROUPS === 'undefined') return;

  // Works on both the home predictions page (#matches-list) and the
  // clasificacion predictions tab (#mis-predicciones-list)
  const hasMatchList = document.getElementById('matches-list') || document.getElementById('mis-predicciones-list');
  if (!hasMatchList) return;

  // On home page: use the selected competencia.
  // On clasificacion page: use only the torneo's embedded competencia (never the global
  // selectedCompetencia which may belong to a different page's context).
  const onClasific = !!document.getElementById('mis-predicciones-list');
  const comp = onClasific
    ? API.getSelectedTorneo()?.competencia
    : API.getSelectedCompetencia();
  const isMundial = comp && comp.slug === WORLD_CUP_2026_SLUG;

  const existingFab = document.getElementById('grupos-fab');
  if (!isMundial) {
    existingFab?.remove();
    document.getElementById('grupos-overlay')?.remove();
    return;
  }
  if (existingFab) return; // ya montado

  const fab = document.createElement('button');
  fab.id = 'grupos-fab';
  fab.className = 'grupos-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', t('groups.fab'));
  fab.title = t('groups.fab');
  fab.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="4" width="6" height="16" rx="1.5"></rect>
      <rect x="3" y="10" width="6" height="10" rx="1.5"></rect>
      <rect x="15" y="13" width="6" height="7" rx="1.5"></rect>
      <path d="M10.7 8.2h2.6"></path>
      <path d="M5 13.7h2"></path>
      <path d="M17 16.2h2"></path>
    </svg>`;
  document.body.appendChild(fab);

  const overlay = document.createElement('div');
  overlay.id = 'grupos-overlay';
  overlay.className = 'grupos-overlay';
  overlay.innerHTML = `
    <div class="grupos-overlay__panel" role="dialog" aria-modal="true" aria-label="${t('groups.overlayTitle')}">
      <div class="grupos-overlay__head">
        <h2 class="grupos-overlay__title">${t('groups.overlayTitle')}</h2>
        <button class="icon-btn grupos-overlay__close" type="button" aria-label="${t('action.close')}" title="${t('action.close')}">×</button>
      </div>
      <div class="grupos-overlay__body" id="grupos-overlay-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  const open = async () => {
    const body = document.getElementById('grupos-overlay-body');
    body.innerHTML = '<p style="padding:1rem;text-align:center">…</p>';
    overlay.classList.add('grupos-overlay--visible');

    // Fetch ALL matches for this competencia (all states) so the groups table
    // is correct regardless of which filter tab is currently active
    let allMatches = lastLoadedMatches || [];
    try {
      const [upcoming, live, finished] = await Promise.all([
        API.getMatches({ competenciaId: comp.id, estado: 'proximo' }).catch(() => []),
        API.getMatches({ competenciaId: comp.id, estado: 'en-vivo' }).catch(() => []),
        API.getMatches({ competenciaId: comp.id, estado: 'finalizado' }).catch(() => []),
      ]);
      // Merge, dedup by id
      const seen = new Set();
      allMatches = [...upcoming, ...live, ...finished].filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    } catch { /* use lastLoadedMatches as fallback */ }

    const enriched = allMatches.map(match => {
      const livePred = Predictions.getCurrentScores(match.id);
      let userPred = match.userPred || null;
      if (livePred) {
        userPred = (livePred.equipo1 != null && livePred.equipo2 != null)
          ? { scoreEquipo1: livePred.equipo1, scoreEquipo2: livePred.equipo2 }
          : null;
      }
      return { ...match, userPred };
    });

    const groups = buildPredictedGroups(enriched, WORLD_CUP_2026_GROUPS);
    body.innerHTML = renderGroupsGrid(groups);
  };
  const close = () => overlay.classList.remove('grupos-overlay--visible');

  fab.addEventListener('click', open);
  overlay.querySelector('.grupos-overlay__close').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}
