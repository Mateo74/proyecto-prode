/**
 * groups.js
 * Renderizado y cálculo de tablas de grupos predichos.
 *
 * Este archivo usa nombres canónicos en español para cruzar con el backend
 * (equipo.nombre), y localiza solo la presentación al idioma activo.
 */

/**
 * Renderiza las tablas de grupos ordenadas por puntos predichos.
 *
 * @param {Object.<string, Array.<Array>>} groups
 *   Diccionario { "A": [ [nombre, jugados, golesFavor, golesContra, puntos, crestUrl?], ...4 filas ], ... }.
 *   Cada fila es una tupla: (teamName, games played, goals scored, goals conceded, predicted points, [crestUrl]).
 * @returns {string} HTML de un grid adaptativo de group-tables.
 */
function renderGroupsGrid(groups) {
  const letters = Object.keys(groups || {}).sort();
  if (!letters.length) return emptyState(t('groups.empty'));

  const cards = letters
    .map(letter => `<div class="groups-grid__cell">${renderGroupTable(letter, groups[letter])}</div>`)
    .join('');

  return `<div class="groups-grid">${cards}</div>`;
}

/**
 * Renderiza la tabla de un grupo ordenada por puntos predichos (desc).
 * Desempate: diferencia de gol y luego goles a favor.
 */
function renderGroupTable(letter, teams = []) {
  const sorted = [...teams].sort((a, b) => {
    const byPoints = (b[4] ?? 0) - (a[4] ?? 0);
    if (byPoints !== 0) return byPoints;
    const diffA = (a[2] ?? 0) - (a[3] ?? 0);
    const diffB = (b[2] ?? 0) - (b[3] ?? 0);
    if (diffB !== diffA) return diffB - diffA;
    return (b[2] ?? 0) - (a[2] ?? 0);
  });

  const body = sorted.map(([nombre, jugados, golesFavor, golesContra, puntos, crestUrl]) => {
    const completo = Number(jugados ?? 0) >= 3;
    const display = localizeTeamName(nombre);
    return `
        <tr class="${completo ? 'is-complete' : ''}">
          <td class="group-table__team">
            <span class="group-table__crest">${Predictions.teamCrest(display, crestUrl)}</span>
            <span class="group-table__name">${escapeHtml(display)}</span>
          </td>
          <td>${Number(jugados ?? 0)}</td>
          <td>${Number(golesFavor ?? 0)}</td>
          <td>${Number(golesContra ?? 0)}</td>
          <td class="group-table__pts">${Number(puntos ?? 0)}</td>
        </tr>`;
  }).join('');

  return `
      <table class="group-table">
        <thead>
          <tr><th colspan="5" class="group-table__title">${t('groups.title', { letter })}</th></tr>
          <tr>
            <th class="group-table__team">${t('groups.team')}</th>
            <th title="${t('groups.playedTitle')}">${t('groups.played')}</th>
            <th title="${t('groups.gfTitle')}">${t('groups.gf')}</th>
            <th title="${t('groups.gcTitle')}">${t('groups.gc')}</th>
            <th title="${t('groups.pointsTitle')}">${t('groups.points')}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
}

/** Normaliza un nombre de equipo para comparaciones (sin acentos, minúsculas). */
function normalizeTeamName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Devuelve el nombre del equipo para mostrar según el idioma activo.
 * El backend y WORLD_CUP_2026_GROUPS usan el nombre canónico en español;
 * cuando el idioma es 'en' se traduce solo para mostrar.
 */
function localizeTeamName(name) {
  if (typeof I18n === 'undefined' || I18n.getLang() !== 'en') return name;
  if (typeof WORLD_CUP_2026_TEAM_NAMES_EN === 'undefined') return name;
  return WORLD_CUP_2026_TEAM_NAMES_EN[name] || name;
}

/**
 * Construye las posiciones predichas de cada grupo a partir de los partidos del
 * backend y las predicciones del usuario (Win=3, Draw=1, Lose=0).
 *
 * Solo cuentan los partidos de fase de grupos: ambos equipos deben pertenecer al
 * mismo grupo y existir una predicción del usuario para ese partido.
 *
 * @param {Array}  matches       Partidos del backend (con userPred, equipo1/2, escudos).
 * @param {Object} groupsDef     { "A": [nombre,...4], ... } composición oficial.
 * @param {Object} [crestByName] Mapa nombreNormalizado -> escudoUrl.
 * @returns {Object} { "A": [ [nombre, pj, gf, gc, pts, crestUrl], ...4 ], ... }
 */
function buildPredictedGroups(matches = [], groupsDef = {}, crestByName = {}) {
  const teamToGroup = {};
  const stats = {};
  for (const [letter, teams] of Object.entries(groupsDef)) {
    stats[letter] = {};
    for (const team of teams) {
      const key = normalizeTeamName(team);
      teamToGroup[key] = letter;
      stats[letter][key] = { name: team, pj: 0, gf: 0, gc: 0, pts: 0 };
    }
  }

  const crest = { ...crestByName };
  const rememberCrest = (name, url) => {
    const key = normalizeTeamName(name);
    if (key && url && !crest[key]) crest[key] = url;
  };

  for (const m of matches) {
    rememberCrest(m.equipo1, m.equipo1EscudoUrl);
    rememberCrest(m.equipo2, m.equipo2EscudoUrl);

    const pred = m.userPred;
    if (!pred || pred.scoreEquipo1 == null || pred.scoreEquipo2 == null) continue;

    const n1 = normalizeTeamName(m.equipo1);
    const n2 = normalizeTeamName(m.equipo2);
    const grupo = teamToGroup[n1];
    if (!grupo || grupo !== teamToGroup[n2]) continue;

    const row1 = stats[grupo][n1];
    const row2 = stats[grupo][n2];
    if (!row1 || !row2) continue;

    const s1 = Number(pred.scoreEquipo1);
    const s2 = Number(pred.scoreEquipo2);
    row1.pj++; row2.pj++;
    row1.gf += s1; row1.gc += s2;
    row2.gf += s2; row2.gc += s1;
    if (s1 > s2) row1.pts += 3;
    else if (s2 > s1) row2.pts += 3;
    else { row1.pts++; row2.pts++; }
  }

  const out = {};
  for (const [letter, teams] of Object.entries(groupsDef)) {
    out[letter] = teams.map(team => {
      const key = normalizeTeamName(team);
      const s = stats[letter][key];
      return [s.name, s.pj, s.gf, s.gc, s.pts, crest[key] || null];
    });
  }
  return out;
}

async function initGrupos() {
  const root = document.getElementById('grupos-root');
  if (!root) return;
  showSkeleton(root, 4);
  try {
    const competencia = await resolveMundialCompetencia();
    if (!competencia) {
      root.innerHTML = emptyState(t('groups.empty'));
      return;
    }
    await loadGrupos(competencia.id, root);
  } catch (error) {
    root.innerHTML = errorState(error.message);
  }
}

async function resolveMundialCompetencia() {
  const competencias = await API.getCompetencias();
  return (
    competencias.find(c => c.slug === WORLD_CUP_2026_SLUG) ||
    competencias.find(c => normalizeTeamName(c.nombre).includes('mundial')) ||
    null
  );
}

async function loadGrupos(competenciaId, root) {
  const partidos = await API.getMatches({ competenciaId });
  const groups = buildPredictedGroups(partidos, WORLD_CUP_2026_GROUPS);
  root.innerHTML = renderGroupsGrid(groups);
}
