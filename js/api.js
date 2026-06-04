/**
 * api.js
 * Capa de acceso a datos. Todas las pantallas leen del backend.
 */

const API = (() => {

  const BASE_URL = (
    window.ONCE_METROS_CONFIG?.API_BASE_URL || 'http://localhost:3000/api'
  ).replace(/\/$/, '');
  const USER_KEY = 'once_metros_user';
  const SELECTED_COMPETENCIA_KEY = 'once_metros_selected_competencia';
  const SELECTED_TORNEO_KEY = 'once_metros_selected_torneo';

  // Access token lives in memory only — never touches any client-readable storage.
  // The HttpOnly refresh cookie is the only persistent credential.
  // restoreSession() recovers the token from the cookie on every page load.
  let accessToken = null;
  let refreshPromise = null;

  function getToken() {
    return accessToken;
  }

  function getCurrentUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
  }

  function setSession({ token, usuario }) {
    accessToken = token;
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    // Sync the app language from the user's persisted preference
    if (usuario?.idioma && typeof I18n !== 'undefined') {
      const stored = localStorage.getItem('once_metros_lang');
      if (stored !== usuario.idioma) {
        localStorage.setItem('once_metros_lang', usuario.idioma);
        window.location.reload();
      }
    }
  }

  function clearSession() {
    accessToken = null;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SELECTED_TORNEO_KEY);
  }

  function getSelectedCompetencia() {
    return readStoredJson(SELECTED_COMPETENCIA_KEY);
  }

  function setSelectedCompetencia(competencia) {
    if (!competencia) {
      localStorage.removeItem(SELECTED_COMPETENCIA_KEY);
      localStorage.removeItem(SELECTED_TORNEO_KEY);
      return;
    }
    localStorage.setItem(SELECTED_COMPETENCIA_KEY, JSON.stringify(competencia));
    const torneo = getSelectedTorneo();
    if (torneo?.competenciaId && torneo.competenciaId !== competencia.id) {
      localStorage.removeItem(SELECTED_TORNEO_KEY);
    }
  }

  function getSelectedTorneo() {
    return readStoredJson(SELECTED_TORNEO_KEY);
  }

  function setSelectedTorneo(torneo) {
    if (!torneo) {
      localStorage.removeItem(SELECTED_TORNEO_KEY);
      return;
    }
    localStorage.setItem(SELECTED_TORNEO_KEY, JSON.stringify(torneo));
    if (torneo.competencia) {
      setSelectedCompetencia(torneo.competencia);
    }
  }

  function readStoredJson(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  async function doRefresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).then(async (res) => {
      if (!res.ok) {
        // Only clear the session on a definitive auth rejection (401).
        // Transient server errors (5xx, network timeouts) should NOT log the
        // user out — the refresh token is still valid and will work on the
        // next attempt.
        if (res.status === 401) clearSession();
        throw new Error('Sesión expirada');
      }
      const json = await res.json();
      accessToken = json.token;
      if (json.usuario) localStorage.setItem(USER_KEY, JSON.stringify(json.usuario));
    }).finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  async function restoreSession() {
    if (accessToken) return getCurrentUser();
    // Always attempt the refresh — the httpOnly cookie may still be valid
    // even if localStorage was cleared (e.g. Android "Clear all" kills the process).
    // doRefresh returns the usuario in the response, so we can re-hydrate fully.
    try {
      await doRefresh();
      return getCurrentUser();
    } catch {
      clearSession();
      return null;
    }
  }

  async function request(endpoint, options = {}, _isRetry = false) {
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    };

    let res;
    try {
      res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      throw new Error('No se pudo conectar con el backend. Revisá que el servidor esté levantado.');
    }

    if (res.status === 401 && !_isRetry) {
      // Only attempt a token refresh if we currently have an access token in memory.
      // If there's no token, this 401 belongs to the request itself (e.g. wrong login
      // credentials) — surfacing "Sesión expirada" in that case is misleading.
      if (accessToken) {
        try {
          await doRefresh();
        } catch {
          throw new Error('Sesión expirada. Iniciá sesión de nuevo.');
        }
        return request(endpoint, options, true);
      }
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'No autorizado');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Error ${res.status}`);
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return res.json();
  }

  function buildQuery(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, value);
      }
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
  }

  // --- PARTIDOS ---

  async function getMatches({ liga, fecha, estado, competenciaId } = {}) {
    return request(`/partidos${buildQuery({ liga, fecha, estado, competenciaId })}`);
  }

  async function getMatch(id) {
    return request(`/partidos/${id}`);
  }

  async function cerrarPartido(id, { golesEquipo1, golesEquipo2 }) {
    return request(`/partidos/${id}/cerrar`, {
      method: 'POST',
      body: JSON.stringify({ golesEquipo1, golesEquipo2 }),
    });
  }

  // --- PREDICCIONES ---

  async function savePrediction({ matchId, scoreEquipo1, scoreEquipo2, scoreLocal, scoreVisitante }) {
    if (!getToken()) throw new Error('Tenés que iniciar sesión para guardar predicciones');

    return request('/predicciones', {
      method: 'POST',
      body: JSON.stringify({
        matchId,
        scoreEquipo1: scoreEquipo1 ?? scoreLocal,
        scoreEquipo2: scoreEquipo2 ?? scoreVisitante,
      }),
    });
  }

  async function updatePrediction(id, { scoreEquipo1, scoreEquipo2 }) {
    return request(`/predicciones/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ scoreEquipo1, scoreEquipo2 }),
    });
  }

  // --- USUARIOS ---

  async function getUsuario(id) {
    return request(`/usuarios/${id}`);
  }

  async function updateUsuario(id, data) {
    return request(`/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async function updateIdioma(id, idioma) {
    const usuario = await request(`/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ idioma }),
    });
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    return usuario;
  }

  async function deleteUsuario(id) {
    return request(`/usuarios/${id}`, { method: 'DELETE' });
  }

  // --- COMPETENCIAS ---

  async function getCompetencias() {
    return request('/competencias');
  }

  async function getCompetencia(id) {
    return request(`/competencias/${id}`);
  }

  // --- EQUIPOS ---

  async function getEquipos({ tipo, q } = {}) {
    return request(`/equipos${buildQuery({ tipo, q })}`);
  }

  async function getEquipo(id) {
    return request(`/equipos/${id}`);
  }

  // --- TORNEOS DE AMIGOS ---

  async function getTorneosDeAmigos({ mias, competenciaId } = {}) {
    if (mias && !getToken()) throw new Error('Tenés que iniciar sesión para ver tus torneos.');
    const torneos = await request(`/torneos${buildQuery({ mias, competenciaId })}`);
    return competenciaId
      ? torneos.filter(t => t.competenciaId === competenciaId)
      : torneos;
  }

  async function getTorneoDeAmigos(id) {
    return request(`/torneos/${id}`);
  }

  async function createTorneoDeAmigos({ nombre, competenciaId }) {
    return request('/torneos', {
      method: 'POST',
      body: JSON.stringify({ nombre, competenciaId }),
    });
  }

  async function unirseATorneoDeAmigos(id) {
    return request(`/torneos/${id}/unirse`, { method: 'POST' });
  }

  async function updateTorneoDeAmigos(id, updates) {
    return request(`/torneos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async function deleteTorneoDeAmigos(id) {
    return request(`/torneos/${id}`, { method: 'DELETE' });
  }

  async function leaveTorneoDeAmigos(id) {
    return request(`/torneos/${id}/salir`, { method: 'DELETE' });
  }

  async function getTablaTorneoDeAmigos(id) {
    return request(`/torneos/${id}/tabla`);
  }

  async function getMisPrediccionesEnTorneoDeAmigos(id) {
    return request(`/torneos/${id}/mis-predicciones`);
  }

  async function getPrediccionesUsuarioEnTorneo(torneoId, usuarioId) {
    return request(`/torneos/${torneoId}/usuarios/${usuarioId}/predicciones`);
  }

  // --- AUTH ---

  async function register({ username, nombre, email, password }) {
    const session = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, nombre, email, password }),
    });
    setSession(session);
    return session;
  }

  async function login({ identificador, username, email, password }) {
    const session = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identificador: identificador ?? username ?? email, password }),
    });
    setSession(session);
    return session;
  }

  async function loginWithGoogle(idToken) {
    const session = await request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    setSession(session);
    return session;
  }

  async function loginWithGoogleCode({ code, codeVerifier, redirectUri }) {
    const session = await request('/auth/google/mobile', {
      method: 'POST',
      body: JSON.stringify({ code, codeVerifier, redirectUri }),
    });
    setSession(session);
    return session;
  }

  async function me() {
    const response = await request('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(response.usuario));
    return response.usuario;
  }

  async function logout() {
    clearSession();
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Best effort — local state already cleared
    }
  }

  async function getLeaderboard({ torneoId, limit = 50 } = {}) {
    const selected = getSelectedTorneo();
    const id = torneoId || selected?.id;
    if (!id) throw new Error('Elegí un Torneo de Amigos para ver el ranking.');
    const tabla = await getTablaTorneoDeAmigos(id);
    return tabla.slice(0, limit).map(entry => ({
      ...entry,
      nombre: entry.usuario?.nombre || entry.usuario?.username || 'Usuario',
      fotoPerfil: entry.usuario?.fotoPerfil || null,
    }));
  }

  async function getUserPredictions({ estado, torneoId } = {}) {
    const selected = getSelectedTorneo();
    const id = torneoId || selected?.id;
    if (!id) throw new Error('Elegí un Torneo de Amigos para ver tus predicciones.');
    const predicciones = await getMisPrediccionesEnTorneoDeAmigos(id);
    return estado
      ? predicciones.filter(p => p.estado === estado)
      : predicciones;
  }

  // --- INVITACIONES ---

  async function invitarAlTorneo(torneoId, identificador) {
    return request(`/torneos/${torneoId}/invitaciones`, {
      method: 'POST',
      body: JSON.stringify({ identificador }),
    });
  }

  async function getInvitacionesDelTorneo(torneoId) {
    return request(`/torneos/${torneoId}/invitaciones`);
  }

  async function getInviteLink(torneoId) {
    const { token } = await request(`/torneos/${torneoId}/invite-link`);
    return token ? { token, url: buildInviteUrl(token) } : { token: null, url: null };
  }

  async function generarInviteLink(torneoId) {
    const { token } = await request(`/torneos/${torneoId}/invite-link`, { method: 'POST' });
    return { token, url: buildInviteUrl(token) };
  }

  async function revocarInviteLink(torneoId) {
    return request(`/torneos/${torneoId}/invite-link`, { method: 'DELETE' });
  }

  function buildInviteUrl(token) {
    if (!token) return null;
    const base = window.location.origin;
    const path = window.location.pathname.includes('/pages/')
      ? 'invitacion.html'
      : 'pages/invitacion.html';
    const dir = window.location.pathname.replace(/[^/]*$/, '');
    return `${base}${dir}${path}?token=${encodeURIComponent(token)}`;
  }

  async function getTorneoPorInviteToken(token) {
    return request(`/invites/${encodeURIComponent(token)}`);
  }

  async function unirseConInviteToken(token) {
    return request(`/invites/${encodeURIComponent(token)}/aceptar`, { method: 'POST' });
  }

  async function getMisInvitacionesPendientes() {
    if (!getToken()) return [];
    return request('/invitaciones');
  }

  async function aceptarInvitacion(id) {
    return request(`/invitaciones/${id}/aceptar`, { method: 'POST' });
  }

  async function rechazarInvitacion(id) {
    return request(`/invitaciones/${id}/rechazar`, { method: 'POST' });
  }

  async function cancelarInvitacion(id) {
    return request(`/invitaciones/${id}`, { method: 'DELETE' });
  }

  return {
    aceptarInvitacion,
    cancelarInvitacion,
    cerrarPartido,
    clearSession,
    createTorneoDeAmigos,
    generarInviteLink,
    getCompetencia,
    getCompetencias,
    getCurrentUser,
    getEquipo,
    getEquipos,
    getInvitacionesDelTorneo,
    getInviteLink,
    getLeaderboard,
    getMatch,
    getMatches,
    getMisInvitacionesPendientes,
    getMisPrediccionesEnTorneoDeAmigos,
    getPrediccionesUsuarioEnTorneo,
    getSelectedCompetencia,
    getSelectedTorneo,
    getTablaTorneoDeAmigos,
    getToken,
    getTorneoDeAmigos,
    getTorneoPorInviteToken,
    getTorneosDeAmigos,
    getUserPredictions,
    getUsuario,
    invitarAlTorneo,
    login,
    loginWithGoogle,
    loginWithGoogleCode,
    logout,
    me,
    rechazarInvitacion,
    register,
    restoreSession,
    revocarInviteLink,
    savePrediction,
    setSelectedCompetencia,
    setSelectedTorneo,
    unirseATorneoDeAmigos,
    unirseConInviteToken,
    updatePrediction,
    updateTorneoDeAmigos,
    deleteTorneoDeAmigos,
    leaveTorneoDeAmigos,
    updateUsuario,
    updateIdioma,
    deleteUsuario,
  };
})();
